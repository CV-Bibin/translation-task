export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is missing' });
  }

  const { textArray, sourceLangCode } = req.body;

  if (!Array.isArray(textArray)) {
    return res.status(400).json({ error: 'textArray must be an array' });
  }

  const prompt = `
You are an expert TryRating map localization, transliteration, and spelling review assistant.

Input is a JSON array of map task strings.
The source language code is: ${sourceLangCode || 'AUTO'}.
The source language may be Malayalam, Tamil, Hindi, Spanish, English, or mixed.

Input array order:
- index 0 is the query.
- Starting from index 1, every result has exactly 5 fields in this order:
  title, address, category, type, status.
- Example:
  index 1 = result 1 title
  index 2 = result 1 address
  index 3 = result 1 category
  index 4 = result 1 type
  index 5 = result 1 status
  index 6 = result 2 title
  index 7 = result 2 address
  index 8 = result 2 category
  index 9 = result 2 type
  index 10 = result 2 status

Return ONLY valid JSON in this exact shape:

{
  "localizedTexts": ["same length as input array"],
  "spellingIssues": [
    {
      "inputIndex": 0,
      "fieldType": "query | title | address | category | type | status",
      "originalWord": "exact word from original input",
      "actualTransliteration": "roman transliteration of the original word",
      "suggestedWord": "correct source-language word or corrected English phrase",
      "reason": "short reason"
    }
  ]
}

Localization rules:
1. localizedTexts must be clean English for map rating.
2. localizedTexts must have exactly the same number of items as the input array.
3. For title, address, and query:
   - Use smart English localization.
   - Brand names, shop names, road names, building names, person names, and place names should use their common English spelling when obvious.
   - Example: "ഇന്ത്യൻ ഓയിൽ" -> "Indian Oil".
   - Example: "പെട്രോൾ പമ്പ്" -> "Petrol Pump".
4. For category, type, and status fields:
   - Always translate the meaning into English.
   - Do not transliterate category/type/status.
   - Example category "പെട്രോൾ പമ്പ്" -> "Petrol Pump".
   - Example status meaning open/closed/operational should be translated to English.
5. Keep Indian map terms natural:
   - Use "Petrol Pump", not "Gas Station".
   - Use "Medical Store" or "Pharmacy" when appropriate.
6. Preserve numbers, postal codes, coordinates, punctuation, and address structure.

Spelling review rules:
1. Check every input string independently before finalizing localizedTexts.
2. Do not silently correct spelling mistakes. If localizedTexts corrects a misspelled source word, spellingIssues must include that word.
3. Report only real or highly likely spelling mistakes. Do not report acceptable variant spellings, valid local spellings, abbreviations, transliteration differences, or alternate brand spellings as errors.
4. Do not create false errors for normal Malayalam/Tamil/Hindi spelling, common local abbreviations, or valid mixed-language business names.
5. Do not report grammar/style differences. Report only spelling issues that affect a word/name/category/map term.
6. If a source word is likely a misspelled version of a common map/business term, report it.
7. Be strict for common map/business terms including petrol, pump, hotel, restaurant, hospital, clinic, pharmacy, medical store, school, college, bank, ATM, temple, mosque, church, supermarket, market, bakery, bus stand, railway station, airport, road, street, junction.
8. Check titles more carefully than addresses, because title spelling errors are more important.
9. If you are unsure whether a word is wrong or just a valid local name, do not report it.
10. Return all spelling issues found. Do not stop after the first issue.
11. inputIndex must be the exact array index where the issue was found.
12. fieldType must match the field type for that inputIndex.
13. If there are no spelling issues, return an empty spellingIssues array.
14. Return only JSON. No markdown.

Input JSON array:
${JSON.stringify(textArray)}
`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json(data);
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(resultText);

    const localizedTexts = Array.isArray(parsed.localizedTexts)
      ? parsed.localizedTexts
      : [];

    const spellingIssues = Array.isArray(parsed.spellingIssues)
      ? parsed.spellingIssues
      : [];

    return res.status(200).json({
      localizedTexts,
      spellingIssues,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'AI localization failed',
      details: err.message,
    });
  }
}