// --- File: api/get-rating-tips.js ---

// Helper: Calculate distance in meters between two coordinates (Haversine formula)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const olaMapsApiKey = process.env.OLA_MAPS_API_KEY;

  if (!geminiApiKey) return res.status(500).json({ error: 'Gemini API key missing' });

  const { query, taskType, userLatLng, viewportAge, manualViewportLatLng, viewportDistance, results } = req.body;

  try {
    // ==========================================
    // STEP 1: HARDCODED LOCATION INTENT LOGIC
    // ==========================================
    let intentCenter = userLatLng; 
    let intentDecision = "User Location";
    let intentReason = "Defaulted to user location.";

    const hasUser = userLatLng && userLatLng.includes(',');
    const hasViewport = manualViewportLatLng && manualViewportLatLng.includes(',');

    if (!hasUser && hasViewport) {
      intentCenter = manualViewportLatLng;
      intentDecision = "Viewport Center";
      intentReason = "User location is missing, falling back to Viewport.";
    } else if (hasUser && hasViewport && viewportDistance) {
      const [uLat, uLng] = userLatLng.split(',').map(Number);
      const [vLat, vLng] = manualViewportLatLng.split(',').map(Number);
      
      const distToViewport = getDistanceInMeters(uLat, uLng, vLat, vLng);
      const isInside = distToViewport <= Number(viewportDistance);
      const isFresh = !viewportAge || viewportAge.toLowerCase() !== 'stale';

      if (isFresh && isInside) {
        intentCenter = userLatLng;
        intentDecision = "User Location";
        intentReason = `Viewport is fresh and user is INSIDE (${distToViewport}m < ${viewportDistance}m radius).`;
      } else if (isFresh && !isInside) {
        intentCenter = manualViewportLatLng;
        intentDecision = "Viewport Center";
        intentReason = `Viewport is fresh but user is OUTSIDE (${distToViewport}m > ${viewportDistance}m radius).`;
      } else if (!isFresh) {
        intentCenter = userLatLng;
        intentDecision = "User Location";
        intentReason = "Viewport is Stale. Automatically defaulting to User Location.";
      }
    } else if (hasUser && !hasViewport) {
      intentReason = "No Viewport provided by user. Using User Location.";
    }

    // ==========================================
    // STEP 2: OLA MAPS GROUND TRUTH SEARCH
    // ==========================================
    let realNearbyLocations = [];
    const searchKeyword = query ? query.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') : '';
    
    if (intentCenter && intentCenter.includes(',') && searchKeyword.length > 2 && olaMapsApiKey) {
      const [lat, lng] = intentCenter.split(',').map(c => c.trim());
      const olaUrl = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=10000&keyword=${encodeURIComponent(searchKeyword)}&api_key=${olaMapsApiKey}`;
      
      try {
        const olaRes = await fetch(olaUrl);
        const olaData = await olaRes.json();
        realNearbyLocations = (olaData.predictions || []).slice(0, 5).map(place => ({
          name: place.structured_formatting?.main_text || place.description || 'Unknown',
          address: place.structured_formatting?.secondary_text || 'Address not listed',
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng
        }));
      } catch (e) {
        console.error('Ola Maps Error:', e);
      }
    }

    // ==========================================
    // STEP 3: THE 5-STEP GEMINI AI PIPELINE
    // ==========================================
    const prompt = `
      You are an expert Map Quality Evaluator. You must follow the 5-Step SOP strictly.
      
      Task Context:
      - Task Type: "${taskType}" (If Autocomplete: focus on character prediction. If Search 2.0: focus on destination relevance).
      - Query: "${query}"
      - The system has already calculated the Location Intent: ${intentDecision}.
      - Ground-Truth Found Near Intent (Ola Maps): ${JSON.stringify(realNearbyLocations)}
      
      Evaluate the following results according to the SOP:
      ${JSON.stringify(results)}

      OUTPUT FORMAT: YOU MUST RETURN ONLY VALID JSON MATCHING THIS EXACT STRUCTURE.
      {
        "locationIntentDecision": "${intentDecision}",
        "locationIntentReason": "${intentReason}",
        "step1_UserIntent": {
          "queryType": "(Address, POI, Category, etc.)",
          "intentExplanation": "Brief explanation of what the user actually wants based on the query."
        },
        "step2_NavigationalQuestion": {
          "isUniqueDestination": "Yes / No",
          "reasoning": "Explanation"
        },
        "resultEvaluations": [
          {
            "resultNumber": 1,
            "step3_LanguageIssue": "Yes / No",
            "step4_BusinessStatus": "Open / Closed / Does Not Exist",
            "step5_AddressAccuracy": "Correct / Incorrect",
            "step5_PinAccuracy": "Correct / Incorrect",
            "suggestedRelevance": "Excellent / Good / Acceptable / Bad",
            "briefExplanation": "1-2 sentences summarizing the demotions and relevance score."
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