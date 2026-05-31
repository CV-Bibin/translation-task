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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI localization failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    localizedTexts: data.localizedTexts || [],
    spellingIssues: data.spellingIssues || [],
  };
};