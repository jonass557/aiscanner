/**
 * Intent engine for the Voice Assistant.
 *
 * Maps a natural-language transcript (FR or EN) to a structured intent:
 *   { action, params, needsAI }
 *
 * - Rule-based matching handles app-control and data-lookup commands fast and
 *   deterministically (no AI cost).
 * - Anything that doesn't match a rule falls through to `explain` with
 *   needsAI=true, so the mentor model answers educational / open questions.
 *
 * Actions are consumed by voiceController (server data lookups) and echoed to
 * the client as a `directive` so the UI can navigate / trigger a scan.
 */

// Each intent: a set of keyword groups (ALL groups must match at least one term).
const INTENTS = [
  {
    action: 'run_scan',
    groups: [['analyse', 'analyze', 'scan', 'scanne', 'lance']],
    keywords: ['graphique', 'chart', 'scan'],
    directive: { type: 'navigate', target: '/dashboard/scanner' },
    response: 'J\'ouvre le scanner. Téléversez ou collez votre graphique, puis dites "lance le scan".',
  },
  {
    action: 'show_history',
    groups: [['affiche', 'montre', 'ouvre', 'show', 'open'], ['derniers scans', 'historique', 'journal', 'history', 'journal de trading']],
    directive: { type: 'navigate', target: '/dashboard/history' },
    response: 'Voici votre historique de scans.',
  },
  {
    action: 'show_stats',
    groups: [['statistiques', 'stats', 'statistics', 'score de discipline', 'discipline']],
    directive: { type: 'navigate', target: '/dashboard' },
    response: 'Voici vos statistiques.',
    dataKey: 'stats',
  },
  {
    action: 'show_opportunities',
    groups: [['opportunités', 'opportunities', 'meilleurs marchés', 'best markets']],
    directive: { type: 'navigate', target: '/dashboard/opportunities' },
    response: 'Voici les meilleures opportunités du moment.',
    dataKey: 'opportunities',
  },
  {
    action: 'show_news',
    groups: [['annonce', 'annonces', 'news', 'économique', 'economic', 'calendrier']],
    directive: { type: 'navigate', target: '/dashboard/economic-news' },
    response: 'Voici les annonces économiques importantes à venir.',
    dataKey: 'news',
  },
  // Analysis Q&A about the current/last analysis — answered from context.
  { action: 'explain_stop_loss', groups: [['stop loss', 'stop-loss', 'sl']], dataKey: 'current_analysis' },
  { action: 'explain_take_profit', groups: [['take profit', 'take-profit', 'tp', 'objectif']], dataKey: 'current_analysis' },
  { action: 'explain_rr', groups: [['risque', 'risk'], ['rendement', 'reward', 'ratio']], dataKey: 'current_analysis' },
  { action: 'explain_confidence', groups: [['confiance', 'confidence', 'niveau de confiance']], dataKey: 'current_analysis' },
  { action: 'explain_why_buy', groups: [['pourquoi', 'why'], ['achat', 'acheter', 'buy', 'long']], dataKey: 'current_analysis' },
  { action: 'explain_why_sell', groups: [['pourquoi', 'why'], ['vente', 'vendre', 'sell', 'short']], dataKey: 'current_analysis' },
  { action: 'explain_why_no_trade', groups: [['pourquoi', 'why'], ['aucun trade', 'no trade', 'pas de trade', 'rien']], dataKey: 'current_analysis' },
  { action: 'summarize_analysis', groups: [['résume', 'resume', 'summarize', 'résumé', 'summary']], dataKey: 'current_analysis' },
  { action: 'explain_analysis', groups: [['explique', 'explain', 'explication']], dataKey: 'current_analysis' },
];

const norm = (s) => stripAccents(String(s || '').toLowerCase().normalize('NFD'));

// Note: norm() strips combining diacritics (U+0300–U+036F) after NFD so that
// "opportunités" matches "opportunites".
const stripAccents = (s) => s.replace(/[̀-ͯ]/g, '');

const groupMatches = (text, group) => group.some((term) => text.includes(norm(term)));

/**
 * Parse a transcript into an intent.
 * @param {string} transcript
 * @returns {{ action: string, params: object, needsAI: boolean, directive?: object, response?: string, dataKey?: string }}
 */
export const parseIntent = (transcript) => {
  const text = norm(transcript);

  // Extract a confidence threshold if present ("supérieure à 90", "above 90%").
  const confMatch = text.match(/(\d{2,3})\s*%?/);
  const params = {};
  if (/confiance|confidence|superieur|above|plus de/.test(text) && confMatch) {
    params.minConfidence = Number(confMatch[1]);
  }

  for (const intent of INTENTS) {
    const allMatch = intent.groups.every((g) => groupMatches(text, g));
    // For run_scan, also require a scan-related keyword to reduce false hits.
    if (allMatch) {
      if (intent.keywords && !intent.keywords.some((k) => text.includes(norm(k)))) continue;
      return {
        action: intent.action,
        params,
        needsAI: intent.action.startsWith('explain') || intent.action.startsWith('summarize'),
        directive: intent.directive,
        response: intent.response,
        dataKey: intent.dataKey,
      };
    }
  }

  // No rule matched: treat as an open/educational question for the mentor AI.
  return { action: 'explain', params, needsAI: true, dataKey: null };
};
