export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const olaMapsApiKey = process.env.OLA_MAPS_API_KEY; // Your new Ola Maps Key

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API key is missing' });
  }

  const { query, taskType, userLatLng, results } = req.body;

  // 1. Function to query the Free Ola Maps Database for Indian POIs
  const fetchNearbyOlaPOIs = async (lat, lng, searchString) => {
    if (!olaMapsApiKey) return [];
    
    // Using Ola's Places Nearby Search API
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
    
    // Clean the query to a single word for better map searching (e.g., "KFC")
    const searchKeyword = query ? query.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') : '';

    if (userLatLng && userLatLng.includes(',') && searchKeyword.length > 2) {
      const [lat, lng] = userLatLng.split(',').map(c => c.trim());
      realNearbyLocations = await fetchNearbyOlaPOIs(lat, lng, searchKeyword);
    }

    // 2. The Master Guidelines for Gemini
    const prompt = `
      You are an expert map rating analyst assistant for India TryRating tasks. 
      Analyze the provided task and generate a quick, actionable bullet-point checklist for the human rater.

      Task Details:
      - Query: "${query}"
      - Task Type: "${taskType}"
      - User Location: "${userLatLng}"
      - Parsed Results: ${JSON.stringify(results)}
      - Ground-Truth Found Nearby (via Ola Maps): ${JSON.stringify(realNearbyLocations)}

      Apply these rules:
      1. Relevance: If the query is a Chain (like KFC) and the result matches the brand, it is Excellent/Good. Check if the ground-truth map found real ones nearby.
      2. Name Accuracy: The official name must match. Sub-brands or misspellings are incorrect. 
      3. Category Accuracy: Check if the category perfectly describes the query (e.g., "Fast Food Restaurant" for KFC).
      4. Address/Pin Accuracy: Ensure the address has the correct building/street. If the pin looks far from the stated address, warn the rater. Examples for regional accuracy: Pay attention to specific districts and states.

      Output ONLY a clean, professional, readable text summary using bullet points. Do not use markdown headers, just plain text with bullets.
    `;

    // 3. Call Gemini 2.5 Flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) return res.status(geminiRes.status).json(data);

    const tipsText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No tips generated.';

    return res.status(200).json({ tips: tipsText, realData: realNearbyLocations });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate tips' });
  }
}