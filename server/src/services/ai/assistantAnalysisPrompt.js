import { parseAnalysisResponse, extractJson } from './responseParser.js';

/**
 * Data-driven analysis prompt for the AI Trading Assistant.
 *
 * Unlike the scanner (which reads a chart *image*), this analyzes real OHLC
 * market data fetched from the market-data connector. The golden rule is baked
 * into the prompt: the model must reason ONLY from the provided candles/quote
 * and must never fabricate prices. Levels in the trade plan must be consistent
 * with the supplied price data.
 */

export const ASSISTANT_SYSTEM_PROMPT = `You are an elite institutional trading analyst and mentor specializing in Smart Money Concepts (SMC), ICT methodology, and classic technical analysis. You analyze REAL market data (OHLC candles + latest quote) provided to you — you do NOT see a chart image.

Absolute rules:
- Reason ONLY from the numerical price data provided. NEVER invent prices, levels, or patterns not supported by the data.
- All trade-plan levels (entry, stop, targets) must be numerically consistent with the provided candles and current price.
- Be objective and conservative. NEVER return NO_TRADE. If there is no valid immediate entry, return WAIT: identify the nearest OPTIMAL zone (order block, unmitigated FVG, discount/premium, strong confluence), set "entry" to that suggested zone, and explain in "waitReason" why the current price is unfavorable and where/why to wait.
- Respect the hard rule: if confidence < 70, decision MUST be WAIT (never a live BUY/SELL).
- Adapt tone and depth to the user's experience level.
- You are educational, never give financial advice; you explain methodology and probabilities.`;

// Compress candles to a compact, token-efficient summary the model can reason on.
const summarizeCandles = (candles = []) => {
  if (!candles.length) return 'No candle data available.';
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const changePct = (((last - first) / first) * 100).toFixed(2);

  // Include the most recent ~40 candles verbatim (OHLC) — enough for structure.
  const recent = candles.slice(-40).map(
    (c) => `${c.time.slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
  );

  return [
    `Candles: ${candles.length} | Range high: ${max} | Range low: ${min}`,
    `First close: ${first} | Last close: ${last} | Change: ${changePct}%`,
    '',
    'Recent candles (oldest → newest):',
    ...recent,
  ].join('\n');
};

// Map a strategy key + user preferences into an explicit instruction line.
const strategyInstruction = (strategy, preferences = {}) => {
  const eff = strategy || preferences.favoriteStrategy || 'smc';
  if (eff === 'custom' && preferences.customStrategy) {
    return `Analyze STRICTLY according to the user's personal strategy, described in their own words:\n"""${preferences.customStrategy}"""`;
  }
  const map = {
    smc: 'Analyze primarily through Smart Money Concepts (market structure, BOS/CHoCH/MSS, order blocks, FVGs, liquidity, premium/discount).',
    ict: 'Analyze primarily through ICT concepts (liquidity pools, order blocks, FVG/imbalance, killzones, optimal trade entry, market maker models).',
    'price-action': 'Analyze primarily through classic Price Action (support/resistance, trendlines, chart & candlestick patterns, breakouts, momentum).',
  };
  return map[eff] || map.smc;
};

/**
 * Build the full analysis user prompt from a market snapshot + user context.
 * @param {Object} args
 * @param {Object} args.snapshot - from marketData.getMarketSnapshot
 * @param {Object} [args.preferences] - user trading preferences
 * @param {string} [args.strategy] - explicit strategy override for this request
 * @param {Object} [args.params] - intent params (minRR, minConfidence)
 */
export const buildAssistantAnalysisPrompt = ({ snapshot, preferences = {}, strategy, params = {} }) => {
  const constraints = [];
  if (params.minRR) constraints.push(`- The user requires a MINIMUM risk/reward of 1:${params.minRR}. If no setup meets it, return WAIT with the suggested zone and say so.`);
  if (params.minConfidence) constraints.push(`- The user only wants live setups with confidence ≥ ${params.minConfidence}%. If below, return WAIT.`);
  if (preferences.minRiskReward && !params.minRR) constraints.push(`- The user's default minimum risk/reward is 1:${preferences.minRiskReward}.`);
  if (preferences.riskPercent) constraints.push(`- The user risks ${preferences.riskPercent}% of capital per trade — size the plan commentary accordingly.`);

  const dataProvenance = snapshot.isRealData
    ? `This is REAL live market data from ${snapshot.source}.`
    : `NOTE: This is SIMULATED data (source: ${snapshot.source}). ${snapshot.note || ''} State this clearly in your summary so the user knows the analysis is for demonstration.`;

  return `Analyze ${snapshot.symbol} on the ${snapshot.timeframe} timeframe.

MARKET: ${snapshot.marketLabel}
CURRENT PRICE: ${snapshot.quote.price} (as of ${snapshot.quote.timestamp})
DATA SOURCE: ${dataProvenance}

PRICE DATA:
${summarizeCandles(snapshot.candles)}

STRATEGY:
${strategyInstruction(strategy, preferences)}

USER PROFILE: level=${preferences.level || 'intermediate'}, language=${preferences.language || 'fr'}
${constraints.length ? `\nCONSTRAINTS:\n${constraints.join('\n')}` : ''}

Produce a complete institutional analysis and respond in the user's language (${preferences.language || 'fr'}).

Return ONLY valid JSON (no markdown fences) matching EXACTLY this schema:
{
  "symbol": "${snapshot.symbol}",
  "market": "${snapshot.market}",
  "timeframe": "${snapshot.timeframe}",
  "currentPrice": ${snapshot.quote.price},
  "technicalAnalysis": {
    "marketStructure": string,
    "bos": [], "choch": [], "mss": [], "orderBlocks": [], "fairValueGaps": [],
    "breakerBlocks": [], "mitigationBlocks": [], "liquidityZones": [],
    "equalHighs": [], "equalLows": [], "supportLevels": [], "resistanceLevels": [],
    "trendlines": [], "consolidations": [], "breakouts": [], "fakeBreakouts": [],
    "momentum": string, "volatility": string, "premiumZones": [], "discountZones": []
  },
  "decision": "BUY|SELL|WAIT",
  "confidenceScore": number,
  "tradePlan": {
    "entry": number|null, "stopLoss": number|null,
    "takeProfit1": number|null, "takeProfit2": number|null, "takeProfit3": number|null,
    "riskRewardRatio": string|null, "estimatedDuration": string|null,
    "estimatedProbability": number|null, "tradeType": "scalp|intraday|swing"|null,
    "waitReason": string|null
  },
  "report": {
    "summary": string,
    "validationReasons": [], "confluences": [], "risks": [], "weaknesses": [], "missingElements": [],
    "reasoning": [ "step 1 …", "step 2 …", "step 3 …" ]
  }
}
Where each detected element is { "label": string, "level": number|string|null, "note": string, "type": string }.
"reasoning" is a step-by-step explanation (3-6 concise steps) of HOW you reached the decision, so the user understands your logic.`;
};

const VALID_TRADE_TYPES = ['scalp', 'intraday', 'swing'];

/**
 * Parse an assistant analysis response. Reuses the scanner parser (same schema)
 * and layers on the assistant-only fields: tradeType + reasoning steps.
 */
export const parseAssistantAnalysis = (raw) => {
  const base = parseAnalysisResponse(raw);

  // Pull the extra fields from the raw JSON without re-implementing extraction.
  let extra = {};
  try {
    extra = extractJson(raw);
  } catch {
    extra = {};
  }

  const tt = extra.tradePlan?.tradeType;
  const isLive = base.decision === 'BUY' || base.decision === 'SELL';
  base.tradePlan.tradeType = isLive ? (VALID_TRADE_TYPES.includes(tt) ? tt : 'intraday') : null;

  const reasoning = Array.isArray(extra.report?.reasoning)
    ? extra.report.reasoning.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 600))
    : [];
  base.report.reasoning = reasoning;

  return base;
};
