import { resolveSymbol } from '../marketData/symbolCatalog.js';

/**
 * AI Trading Assistant intent engine.
 *
 * Maps a natural-language message (FR/EN) to a structured intent:
 *
 * Rule-based on purpose: fast, deterministic, zero AI cost for routing. Only
 * the *analysis itself* (and open-ended "explain/coach" questions) calls the LLM.
 * Anything that doesn't match falls through to `coach` so the mentor answers.
 *
 * Actions consumed by assistantController, which dispatches to the market-data
 * connector, the analysis engine, or the mentor.
 */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const has = (text, terms) => terms.some((t) => text.includes(t));

// Word-boundary match — for short tokens ("pa", "ict") that would false-match
// as substrings ("compare" contains "pa"). \b doesn't handle all cases with
// punctuation stripped, so we test surrounded-by-non-letter.
const hasWord = (text, words) =>
  words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(text));

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN', 'MONTHLY', 'WEEKLY', 'DAILY'];

/**
 * Parse a message into an intent.
 * @param {string} text
 * @returns {{
 *   action: 'analyze'|'compare'|'best_markets'|'trending'|'should_i_trade'|
 *           'find_setups'|'show_risks'|'explain'|'coach'|'teach'|'chitchat',
 *   params: { symbols?: string[], timeframe?: string, strategy?: string,
 *             market?: string, minRR?: number, minConfidence?: number },
 *   requiresAnalysis: boolean, requiresData: boolean
 * }}
 */
export const parseAssistantIntent = (text) => {
  const t = norm(text);
  const params = {};

  // --- Timeframe -----------------------------------------------------------
  const tfFound = TIMEFRAMES.find((tf) => has(t, [tf.toLowerCase(), tf.replace('M', 'm')]));
  if (tfFound) params.timeframe = tfFound;

  // --- Strategy preference ---------------------------------------------------
  if (hasWord(t, ['price action', 'pa', 'price-action'])) params.strategy = 'price-action';
  else if (hasWord(t, ['ict'])) params.strategy = 'ict';
  else if (has(t, ['smart money', 'smc', 'structure'])) params.strategy = 'smc';
  else if (has(t, ['ma strategie', 'mon systeme', 'ma methode', 'personalise', 'personnel', 'mes regles'])) {
    params.strategy = 'custom';
  }

  // --- Numeric thresholds ("1:3", "90%") --------------------------------------
  const rrMatch = t.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (rrMatch) {
    const minTerm = has(t, ['minimum', 'min', 'au moins', 'at least', 'plus de', 'superieur', 'higher']);
    params.minRR = Number(minTerm ? rrMatch[2] : rrMatch[1]); // "1:3" → require 3 when min phrasing present
  }
  const confMatch = t.match(/(\d{2,3})\s*%/);
  if (confMatch && has(t, ['confiance', 'confidence'])) params.minConfidence = Number(confMatch[1]);

  // --- Which action? ----------------------------------------------------------
  // Compare first (mentions two symbols or "compare les deux").
  if (has(t, ['compare', 'comparaison', 'comparer', 'les deux', 'lequel est plus fiable', 'plus fiable'])) {
    return { action: 'compare', params, requiresAnalysis: true, requiresData: true };
  }

  // Market-wide scans.
  if (has(t, ['meilleur', 'best', 'top', 'opportunite', 'opportunity', 'quels marches'])) {
    return { action: 'best_markets', params, requiresAnalysis: false, requiresData: true };
  }
  if (has(t, ['tendance', 'trend', 'tendancie', 'qui monte', 'qui baisse', 'momentum'])) {
    return { action: 'trending', params, requiresAnalysis: false, requiresData: true };
  }
  // "Donne-moi un trade avec ratio 1:3" → find a setup respecting the constraints.
  if (has(t, ['un trade', 'un signal', 'un setup', 'find', 'trouve', 'cherche', 'donne-moi un trade', 'trade avec', 'setups'])) {
    return { action: 'find_setups', params, requiresAnalysis: true, requiresData: true };
  }
  if (has(t, ['acheter ou vendre', 'buy or sell', 'dois-je acheter', 'achat ou vente', 'que faire'])) {
    return { action: 'should_i_trade', params, requiresAnalysis: true, requiresData: true };
  }
  if (has(t, ['risque', 'risk', 'faiblesse', 'weakness', 'danger', 'dangerous'])) {
    return { action: 'show_risks', params, requiresAnalysis: true, requiresData: true };
  }

  // Explicit analysis of a symbol.
  if (has(t, ['analyse', 'analyze', 'analyser', 'scanne', 'scan', 'regarde', 'examine', 'etude', 'etudie'])) {
    return { action: 'analyze', params, requiresAnalysis: true, requiresData: true };
  }

  // Teaching / coaching / open questions.
  if (has(t, ['cest quoi', 'c\'est quoi', 'quest ce que', 'qu\'est-ce que', 'explique', 'explain', 'apprends', 'apprendre', 'cours', 'tuto', 'lecon', 'defini', 'difference entre'])) {
    return { action: 'teach', params, requiresAnalysis: false, requiresData: false };
  }
  if (has(t, ['conseil', 'advice', 'erreur', 'error', 'fomo', 'revenge', 'overtrading', 'discipline', 'emotion', 'mental'])) {
    return { action: 'coach', params, requiresAnalysis: false, requiresData: false };
  }

  // Bare-symbol shortcut: the whole message is (or contains only) a tradable
  // symbol — "euraud", "eur/aud", "gold", "btc h4". No action verb, but the user
  // clearly wants that market analyzed. Route to `analyze` instead of falling
  // through to the mentor (which would answer off-topic).
  const bareTokens = t.split(/[\s,;?!.]+/).filter((w) => w.length >= 2);
  const symbolTokens = bareTokens.filter((w) => resolveSymbol(w, { fuzzy: false }));
  // Also try the message as a single mention (handles "eur/aud" kept intact).
  const wholeMatch = resolveSymbol(t.replace(/\s+/g, ''), { fuzzy: false });
  const onlySymbolsAndTf = bareTokens.every(
    (w) => resolveSymbol(w, { fuzzy: false }) || TIMEFRAMES.includes(w.toUpperCase())
  );
  if ((symbolTokens.length || wholeMatch) && onlySymbolsAndTf) {
    return { action: 'analyze', params, requiresAnalysis: true, requiresData: true };
  }

  // Default: open-ended mentor question (educational / chit-chat).
  return { action: 'chitchat', params, requiresAnalysis: false, requiresData: false };
};
