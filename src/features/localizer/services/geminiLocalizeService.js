export const smartLocalizeTaskFields = async (textArray, sourceLangCode = 'AUTO') => {
  const response = await fetch('/api/gemini-localize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textArray,
      sourceLangCode,
    }),
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `AI localization returned non-JSON response: ${response.status} ${responseText.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    throw new Error(data.error || `AI localization failed: ${response.status}`);
  }

  return {
  localizedTexts: data.localizedTexts || [],
  transliteratedTexts: data.transliteratedTexts || [],
  spellingIssues: data.spellingIssues || [],
  fieldNotes: data.fieldNotes || [],
  fieldLanguages: data.fieldLanguages || [],
  detectedSourceLanguage: data.detectedSourceLanguage || '',
};
};