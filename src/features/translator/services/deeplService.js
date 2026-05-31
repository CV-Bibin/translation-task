export const translateTaskFields = async (textArray, targetLang) => {
  try {
    const response = await fetch('/api/deepl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textArray,
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      translations: data.translations.map(t => t.text),
      detectedSourceLanguage: data.translations[0]?.detected_source_language || '',
    };
  } catch (err) {
    console.error('Translation Engine Failure:', err);
    throw err;
  }
};