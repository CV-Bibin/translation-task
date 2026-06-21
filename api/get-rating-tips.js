export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const olaMapsApiKey = process.env.OLA_MAPS_API_KEY;

  if (!geminiApiKey) return res.status(500).json({ error: 'Gemini API key missing' });

  // Notice we added viewportAge and manualViewportLatLng here
  const { query, taskType, userLatLng, viewportAge, manualViewportLatLng, results } = req.body;

  const fetchNearbyOlaPOIs = async (lat, lng, searchString) => {
    if (!olaMapsApiKey) return [];
    const olaUrl = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=10000&keyword=${encodeURIComponent(searchString)}&api_key=${olaMapsApiKey}`;
    try {
      const response = await fetch(olaUrl);
      const data = await response.json();
      return (data.predictions || []).slice(0, 5).map(place => ({
        name: place.structured_formatting?.main_text || place.description || 'Unknown',
        address: place.structured_formatting?.secondary_text || 'Address not listed',
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng
      }));
    } catch (e) {
      console.error('Ola Maps Error:', e);
      return [];
    }
  };

  try {
    let realNearbyLocations = [];
    const searchKeyword = query ? query.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') : '';
    
    // Default to user location for the Ola search, or manual viewport if user is missing
    const searchCenter = userLatLng || manualViewportLatLng;

    if (searchCenter && searchCenter.includes(',') && searchKeyword.length > 2) {
      const [lat, lng] = searchCenter.split(',').map(c => c.trim());
      realNearbyLocations = await fetchNearbyOlaPOIs(lat, lng, searchKeyword);
    }

    const prompt = `
      You are an expert Map Quality Evaluator. Analyze the task and return a strict JSON evaluation.
      
      Task Context:
      - Query: "${query}"
      - Task Type: "${taskType}"
      - User Location: "${userLatLng || 'MISSING'}"
      - Viewport Age: "${viewportAge || 'FRESH'}"
      - Manual Viewport Center: "${manualViewportLatLng || 'MISSING'}"
      - Ground-Truth Found Nearby (Ola Maps): ${JSON.stringify(realNearbyLocations)}
      
      STEP 1: Determine Location Intent based on these STRICT rules:
      1. If Viewport is FRESH (or missing age) AND User is INSIDE viewport (assume inside if distances are close) -> Intent = USER.
      2. If Viewport is FRESH AND User is OUTSIDE -> Intent = VIEWPORT.
      3. If Viewport is STALE -> Intent = USER (whether inside or outside).
      4. If User Location is MISSING -> Intent = VIEWPORT.

      STEP 2: Evaluate Results:
      Current Task Results: ${JSON.stringify(results)}

      For EACH result, provide:
      - suggestedRelevance: (Excellent, Good, Acceptable, Bad) based on distance from Intent and brand match.
      - nameAccuracy: Is it a perfect match, sub-brand, or incorrect?
      - addressAccuracy: Does it match the assumed ground truth?
      - pinAccuracy: Note if distance to Intent seems suspicious.
      - briefExplanation: 1-2 sentences explaining the ratings.

      OUTPUT FORMAT: YOU MUST RETURN ONLY VALID JSON. NO MARKDOWN. NO CODE BLOCKS.
      {
        "locationIntentDecision": "User Location | Viewport Center",
        "locationIntentReason": "Explanation of which rule was applied.",
        "resultEvaluations": [
          {
            "resultNumber": "1.",
            "suggestedRelevance": "Good",
            "nameAccuracy": "Correct",
            "addressAccuracy": "Needs Verification",
            "pinAccuracy": "Likely Correct",
            "briefExplanation": "Matches brand name, but distance from user intent suggests a slight demotion."
          }
        ]
      }
    `;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) throw new Error('API Error');

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedEvaluation = JSON.parse(resultText);

    return res.status(200).json({ 
      evaluation: parsedEvaluation, 
      realData: realNearbyLocations 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate evaluation' });
  }
}