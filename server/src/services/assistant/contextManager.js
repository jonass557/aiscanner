import { SYMBOL_CATALOG, resolveSymbol, inferMarket } from '../marketData/index.js';

/**
 * Conversation context manager.
 *
 * Two jobs:
 *  1. Extract symbols mentioned in the current message (via the catalog).
 *  2. Fill gaps from conversation history so follow-ups work naturally:
 *       "Analyse EURUSD H1"  → symbol=EURUSD, tf=H1
 *       "Et si je passe en H4 ?" → inherits EURUSD, tf=H4
 *       "Compare les deux"    → reuses the last two analyzed symbols/timeframes
 *
 * History is the assistant conversation's `messages`, each optionally carrying
 * `context: { symbols, timeframe, strategy }` stamped when it was produced.
 */

// Build a quick lookup of catalog tokens for scanning free text.
const SORTED_SYMBOLS = [...SYMBOL_CATALOG].sort((a, b) => b.symbol.length - a.symbol.length);

/**
 * Find every catalog symbol mentioned in the text, in order of appearance.
 * Handles both tickers ("EURUSD") and names/aliases ("gold", "bitcoin").
 * @returns {string[]} canonical symbols, de-duplicated
 */
export const extractSymbols = (text) => {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  const found = [];

  // 1. Direct ticker / label substring hits (longest first to avoid partials).
  for (const entry of SORTED_SYMBOLS) {
    if (lower.includes(entry.symbol.toLowerCase()) || lower.includes(entry.label.toLowerCase())) {
      if (!found.includes(entry.symbol)) found.push(entry.symbol);
    }
  }

  // 2. Token-level exact/alias resolution for anything missed (e.g. "or", "btc").
  //    Strict (no fuzzy) so short tokens like "et"/"si" can't false-match.
  if (found.length === 0) {
    const tokens = lower.split(/[\s,;?!.]+/);
    for (const token of tokens) {
      if (token.length < 2) continue;
      const entry = resolveSymbol(token, { fuzzy: false });
      if (entry && !found.includes(entry.symbol)) found.push(entry.symbol);
    }
  }

  return found;
};

/**
 * Pull recent context (symbols, timeframe, strategy) from prior messages,
 * most-recent first.
 * @param {Array<{ context?: object }>} messages
 */
const recentContext = (messages = []) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const c = messages[i].context;
    if (c && (c.symbols?.length || c.timeframe)) return c;
  }
  return {};
};

/**
 * Resolve the full working context for the current turn by combining the freshly
 * parsed intent params with inherited history.
 *
 * @param {Object} args
 * @param {Object} args.params - from parseAssistantIntent (timeframe, strategy, market…)
 * @param {string} args.text - the raw user message
 * @param {Array} args.history - prior conversation messages
 * @param {string} args.action - resolved action
 * @returns {{ symbols: string[], timeframe: string|null, strategy: string|null, market: string|null, inherited: boolean }}
 */
export const resolveContext = ({ params = {}, text = '', history = [], action }) => {
  const prior = recentContext(history);
  let symbols = extractSymbols(text);
  let inherited = false;

  // Compare needs two symbols; if the user said "compare the two", reuse history.
  if (action === 'compare' && symbols.length < 2) {
    const priorSymbols = prior.symbols || [];
    symbols = [...new Set([...symbols, ...priorSymbols])].slice(0, 2);
    if (symbols.length >= 2) inherited = true;
  }

  // For symbol-centric actions, inherit the last symbol when none was named
  // ("Et si je passe en H4 ?").
  const symbolActions = ['analyze', 'should_i_trade', 'show_risks'];
  if (symbols.length === 0 && symbolActions.includes(action) && prior.symbols?.length) {
    symbols = [prior.symbols[prior.symbols.length - 1]];
    inherited = true;
  }

  const timeframe = params.timeframe || prior.timeframe || null;
  const strategy = params.strategy || prior.strategy || null;
  const market = params.market || inferMarket(text) || null;

  return { symbols, timeframe, strategy, market, inherited };
};
