import Sanscript from '@indic-transliteration/sanscript';

const SCRIPT_BY_LANG = {
  ML: 'malayalam',
  TA: 'tamil',
  HI: 'devanagari',
};

// Using 'iso' instead of 'itrans' generates cleaner baseline Roman letters
const ROMAN_OUTPUT_SCHEME = 'iso';

// 1. Pre-processor: Fixes the Chillu letter bug in Sanscript
const normalizeMalayalam = (text) => {
  if (!text) return '';
  return text
    .replace(/ൻ/g, 'ന്') // Chillu N
    .replace(/ർ/g, 'ര്') // Chillu R
    .replace(/ൽ/g, 'ല്') // Chillu L
    .replace(/ൾ/g, 'ള്') // Chillu LL
    .replace(/ൺ/g, 'ണ്') // Chillu NN
    .replace(/ൿ/g, 'ക്'); // Chillu K
};

// 2. Post-processor: Removes weird accents (è -> e) for clean reading
const removeAccents = (text) => {
  if (!text) return '';
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const transliterateText = (text, sourceLang) => {
  if (!text) return '';

  const sourceScript = SCRIPT_BY_LANG[sourceLang];

  // If it's English/Spanish, don't transliterate
  if (!sourceScript) {
    return text;
  }

  try {
    let textToProcess = text;
    
    // Fix Malayalam chillu letters before transliterating
    if (sourceLang === 'ML') {
      textToProcess = normalizeMalayalam(textToProcess);
    }

    // Transliterate to Roman characters
    let romanText = Sanscript.t(textToProcess, sourceScript, ROMAN_OUTPUT_SCHEME);
    
    // Clean up accents and return
    return removeAccents(romanText);

  } catch (error) {
    console.error(`Transliteration failed for ${sourceScript}:`, error);
    return text; 
  }
};

export const transliterateTaskFields = (task, sourceLang) => {
  if (!task) return null;

  return {
    ...task,
    query: transliterateText(task.query, sourceLang),
    results: task.results.map((result) => ({
      ...result,
      title: transliterateText(result.title, sourceLang),
      address: transliterateText(result.address, sourceLang),
      category: transliterateText(result.category, sourceLang),
      type: transliterateText(result.type, sourceLang),
      status: transliterateText(result.status, sourceLang),
    })),
  };
};