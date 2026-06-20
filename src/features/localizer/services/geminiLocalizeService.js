export const smartLocalizeTaskFields = async (textArray, sourceLangCode = 'AUTO') => {
  const response = await fetch('/api/smart-localize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textArray, sourceLangCode }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'AI localization failed');
  }

  return {
    localizedTexts: data.localizedTexts || [],
    spellingIssues: data.spellingIssues || [],
    fieldNotes: data.fieldNotes || [],
    fieldLanguages: data.fieldLanguages || [],
    detectedSourceLanguage: data.detectedSourceLanguage || '',
  };
};