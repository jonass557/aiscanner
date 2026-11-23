/**
 * Language detection & resolution helpers for bilingual (FR / EN) AI responses.
 */

/**
 * Detects whether a user's free-form message is written in English or French.
 * Returns 'en', 'fr', or null when ambiguous.
 */
export const detectTextLanguage = (text = '') => {
  const s = String(text || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  // Clear French diacritics or unmistakable French words
  if (
    /[àâäéèêëïîôöùûüÿçœæ]/i.test(s) ||
    /\b(bonjour|salut|tendance|tendence|donne|quel|quelle|quels|quelles|prise|position|achat|vente|attendre|est-ce|c'est|explique|pourquoi|comment|marche|marches|cours|merci|svp|privilegier|entre|avec|sur|pour|sa|son|ses|mon|ma|mes|le|la|les|du|des|un|une|je|tu|nous|vous|quoi|longterm|longterms|court|terme)\b/i.test(lower)
  ) {
    return 'fr';
  }

  // Clear English words / trading phrases
  if (
    /\b(what|how|should|tell|give|please|explain|current|which|between|the|with|buy|sell|trend|market|markets|analyze|today|trade|setup|strategy|risk|entry|stop|target|this|that|can you|do i|its|long term|short term)\b/i.test(lower)
  ) {
    return 'en';
  }

  return null;
};

/**
 * Resolve effective language ('fr' | 'en') for an API request.
 * Always prioritizes the language the user actually wrote their message in ('fr' or 'en'),
 * then falls back to explicit body/query -> x-language header -> saved preference -> 'fr'.
 */
export const resolveRequestLanguage = (req, text = '') => {
  const textLang = detectTextLanguage(text);
  if (textLang === 'fr' || textLang === 'en') return textLang;

  const explicit = req?.body?.language || req?.body?.lang || req?.query?.lang || req?.query?.language;
  if (explicit) {
    const code = String(explicit).slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en') return code;
  }

  const headerLang = req?.headers?.['x-language'];
  if (headerLang) {
    const code = String(headerLang).slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en') return code;
  }

  if (textLang) return textLang;

  const prefLang = req?.user?.preferences?.language;
  if (prefLang === 'fr' || prefLang === 'en') return prefLang;

  const accept = String(req?.headers?.['accept-language'] || '').toLowerCase();
  if (accept.includes('en') && !accept.includes('fr')) return 'en';

  return 'fr';
};
