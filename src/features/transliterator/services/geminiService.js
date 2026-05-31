const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const smartLocalizeTaskFields = async (textArray, sourceLangCode) => {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing. Please add it to your .env file.");
  }

  // We tell the AI exactly how to behave like a TryRating mapping expert
  const prompt = `
    You are an expert mapping and localization assistant. 
    I am providing a JSON array of strings written in language code: ${sourceLangCode}.
    Convert these to English based on these STRICT rules:
    1. Translate generic addresses, categories, and descriptive words to English.
    2. DO NOT translate brand names, store names, or proper nouns. TRANSLITERATE them into perfect English dictionary spelling (e.g., "ഇന്ത്യൻ ഓയിൽ" becomes "Indian Oil", NOT "intyan oyil" or "Gas Station").
    3. Preserve local mapping terms (e.g., keep "Petrol Pump", do not change to "Gas Station").
    
    Return ONLY a valid JSON array of strings in the exact same order. Do not include markdown formatting or backticks.
    
    Input Array:
    ${JSON.stringify(textArray)}
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `Gemini API Error`);

    // Clean the output to ensure it's pure JSON
    let resultText = data.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(resultText);

  } catch (err) {
    console.error("Gemini Engine Failure:", err);
    throw new Error("AI Transliteration failed. Check console for details.");
  }
};