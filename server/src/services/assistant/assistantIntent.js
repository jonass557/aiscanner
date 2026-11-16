import { resolveSymbol } from '../marketData/symbolCatalog.js';
import { extractSymbols } from './contextManager.js';

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

  // --- Identify if any tradable financial symbol is mentioned in this query ---
  const symbols = extractSymbols(text);
  if (symbols.length > 0) {
    params.symbols = symbols;
  }

  // =========================================================================
  // CASE 1: The user explicitly mentions one or more financial assets
  // e.g. "Analyse audcad en H4 et donne moi la tendance...", "Quelle est la tendance sur EURUSD", "Acheter ou vendre du BTC ?"
  // Any query referencing a specific symbol should NEVER be hijacked by global trending lists!
  // =========================================================================
  if (symbols.length > 0) {
    // 1A. Comparison between two or more symbols
    if (
      symbols.length >= 2 ||
      has(t, ['compare', 'comparaison', 'comparer', 'versus', 'vs', 'les deux', 'lequel est plus fiable', 'plus fiable', 'entre les deux'])
    ) {
      return { action: 'compare', params, requiresAnalysis: true, requiresData: true };
    }

    // 1B. Risk inquiry on this symbol
    if (has(t, ['risque', 'risk', 'danger', 'faiblesse', 'weakness', 'dangerous', 'piege'])) {
      return { action: 'show_risks', params, requiresAnalysis: true, requiresData: true };
    }

    // 1C. Setup with constraints requested on this symbol
    if (has(t, ['un trade', 'un signal', 'un setup', 'cherche un trade', 'trouve un trade', 'signal'])) {
      return { action: 'find_setups', params, requiresAnalysis: true, requiresData: true };
    }

    // 1D. Explicit buy/sell advice on this symbol (when not an explicit "analyse")
    if (
      !has(t, ['analyse', 'analyze', 'analyser', 'scanne', 'scan', 'examine', 'etudie']) &&
      has(t, ['acheter ou vendre', 'buy or sell', 'dois-je acheter', 'dois-je vendre', 'achat ou vente', 'long ou short', 'entrer maintenant', 'entrer en position'])
    ) {
      return { action: 'should_i_trade', params, requiresAnalysis: true, requiresData: true };
    }

    // 1E. All other requests mentioning this symbol (full institutional analysis, trend, position, outlook)
    // Examples: "Analyse audcad en H4 et donne moi la tendance...", "Quelle est la tendance sur EURUSD", "AUDCAD H4"
    return { action: 'analyze', params, requiresAnalysis: true, requiresData: true };
  }

  // =========================================================================
  // CASE 2: No specific symbol named in the message
  // =========================================================================

  // 2A. Explicit request to analyze (will attempt to inherit previous symbol from conversation history)
  if (has(t, ['analyse', 'analyze', 'analyser', 'scanne', 'scan', 'regarde', 'examine', 'etude', 'etudie'])) {
    return { action: 'analyze', params, requiresAnalysis: true, requiresData: true };
  }

  // 2B. Compare without naming symbols (e.g. "compare les deux", "lequel est meilleur")
  if (has(t, ['compare', 'comparaison', 'comparer', 'les deux', 'lequel est plus fiable', 'plus fiable'])) {
    return { action: 'compare', params, requiresAnalysis: true, requiresData: true };
  }

  // 2C. Generic setup search without symbol
  if (has(t, ['un trade', 'un signal', 'un setup', 'find', 'trouve', 'cherche', 'donne-moi un trade', 'trade avec', 'setups'])) {
    return { action: 'find_setups', params, requiresAnalysis: true, requiresData: true };
  }

  // 2D. Generic trading direction question without symbol
  if (has(t, ['acheter ou vendre', 'buy or sell', 'dois-je acheter', 'achat ou vente', 'prise de position', 'que faire'])) {
    return { action: 'should_i_trade', params, requiresAnalysis: true, requiresData: true };
  }

  // 2E. Generic risk inquiry
  if (has(t, ['risque', 'risk', 'faiblesse', 'weakness', 'danger', 'dangerous'])) {
    return { action: 'show_risks', params, requiresAnalysis: true, requiresData: true };
  }

  // 2F. Broad market ranking across the entire universe (ONLY when no specific asset is targeted)
  if (has(t, ['meilleur marche', 'meilleurs marches', 'best market', 'top opportunite', 'top marches', 'quels marches'])) {
    return { action: 'best_markets', params, requiresAnalysis: false, requiresData: true };
  }
  if (
    has(t, [
      'marche en tendance', 'marches en tendance', 'qui est en tendance', 'qui monte le plus',
      'qui baisse le plus', 'plus forte hausse', 'plus forte baisse', 'trending markets', 'top movers'
    ])
  ) {
    return { action: 'trending', params, requiresAnalysis: false, requiresData: true };
  }

  // 2G. Educational / Teaching questions (Mentor explains SMC, ICT, indicators, concepts)
  if (
    has(t, [
      'cest quoi', 'c\'est quoi', 'c’est quoi', 'c est quoi', 'quest ce que', 'qu\'est-ce que',
      'explique', 'explain', 'apprends', 'apprendre', 'cours', 'tuto', 'lecon', 'leçon', 'defini',
      'difference entre', 'comment fonctionne', 'pourquoi', 'definition'
    ])
  ) {
    return { action: 'teach', params, requiresAnalysis: false, requiresData: false };
  }

  // 2H. Psychological / Coaching advice
  if (
    has(t, [
      'conseil', 'advice', 'erreur', 'error', 'fomo', 'revenge', 'overtrading',
      'discipline', 'emotion', 'mental', 'psychologie', 'perte', 'gestion du risque'
    ])
  ) {
    return { action: 'coach', params, requiresAnalysis: false, requiresData: false };
  }

  // 2I. Bare-symbol token shortcut fallback
  const bareTokens = t.split(/[\s,;?!.'’/()\[\]-]+/).filter((w) => w.length >= 2);
  const symbolTokens = bareTokens.filter((w) => resolveSymbol(w, { fuzzy: false }));
  const wholeMatch = resolveSymbol(t.replace(/\s+/g, ''), { fuzzy: false });
  const onlySymbolsAndTf = bareTokens.every(
    (w) => resolveSymbol(w, { fuzzy: false }) || TIMEFRAMES.includes(w.toUpperCase())
  );
  if ((symbolTokens.length || wholeMatch) && onlySymbolsAndTf) {
    return { action: 'analyze', params, requiresAnalysis: true, requiresData: true };
  }

  // 2J. Default: open-ended AI Mentor conversation
  return { action: 'chitchat', params, requiresAnalysis: false, requiresData: false };
};
