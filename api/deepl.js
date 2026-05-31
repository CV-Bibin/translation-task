export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'DeepL API key is missing' });
  }

  try {
    const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await deeplRes.json();
    return res.status(deeplRes.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Translation request failed',
      details: err.message,
    });
  }
}