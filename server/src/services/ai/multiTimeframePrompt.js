/**
 * System + instruction prompts for the Multi-Timeframe Analyzer.
 *
 * Unlike the single-chart prompt, this asks the model to reason ACROSS several
 * charts of the SAME symbol at different timeframes: read each one, then judge
 * whether the timeframes align, surface conflicts, and give one top-down
 * recommendation. The output JSON is consumed by multiTimeframeParser.js.
 */

export const MTF_SYSTEM_PROMPT = `You are an elite institutional trading analyst and Senior Portfolio Manager specializing in top-down, multi-timeframe analysis using Smart Money Concepts (SMC) and ICT methodology.

You are given several screenshots of the SAME instrument at DIFFERENT timeframes. Your job is to read each timeframe independently, then synthesize a single top-down view: do the timeframes agree? Where do they conflict? Is a trade confirmed across timeframes, or should the trader stand aside?

CRITICAL RULES OF PROFESSIONAL MULTI-TIMEFRAME ANALYSIS:
- Be strictly objective, disciplined, and conservative.
- Higher timeframes define the dominant bias and macro order flow; lower timeframes are strictly for execution timing and risk-reward optimization.
- A signal is ONLY "confirmed" when the lower-timeframe execution setup strictly aligns with the higher-timeframe market structure and unmitigated institutional zones.
- If a custom user strategy is provided, rigorously test and verify whether the confluence across all timeframes meets or violates the user's strategy criteria.
- Never invent levels or prices that are not visible.`;

export const buildMtfUserPrompt = (timeframes = [], customStrategy = '') => {
  const tfList = timeframes.length ? timeframes.join(', ') : 'the provided timeframes';
  return `Analyze the provided charts. They are all the SAME symbol across these timeframes (from lowest to highest): ${tfList}.

Each image is preceded by a line "--- Chart for timeframe: <TF> ---" telling you which timeframe it is.

${
  customStrategy && customStrategy.trim()
    ? `### USER'S CUSTOM STRATEGY / SYSTEM RULES:
"""
${customStrategy.trim()}
"""
INSTRUCTIONS CONCERNING USER STRATEGY:
1. Cross-examine this multi-timeframe sequence against the user's specific strategy rules.
2. In the "reasoning" and per-timeframe reads, verify if the strategy conditions are fulfilled.
3. Factor this strategy into the final recommendation and risk evaluation.\n\n`
    : ''
}## STEP 1 — PER-TIMEFRAME ANALYSIS
For EACH timeframe provided, determine:
- trend: one of "bullish", "bearish", "ranging"
- marketStructure: 1-2 sentence read (BOS/CHoCH/MSS, higher-highs vs lower-lows)
- keyLevels: array of the most important visible SMC levels, each { "label": string, "level": number|null, "note": string, "type": string }
- bias: one of "BUY", "SELL", "NEUTRAL" (this timeframe's directional lean)

## STEP 2 — CROSS-TIMEFRAME ALIGNMENT
- alignmentStatus: "aligned" (all/most agree), "partial" (mostly agree, minor divergence), or "conflicted" (higher vs lower disagree)
- confluenceScore: 0-100. Higher when more timeframes agree in direction AND structure. Lower when they conflict.
- dominantBias: "BUY" or "SELL" — the direction favored by the higher timeframes.
- conflicts: array of explicit disagreements, each { "tf1": string, "tf2": string, "description": string }. Empty array if none.

## STEP 3 — TOP-DOWN RECOMMENDATION
Provide one recommendation object:
- decision: "BUY", "SELL", or "WAIT". NEVER return "NO_TRADE".
- CRITICAL: if alignmentStatus is "conflicted" OR confluenceScore < 70, decision MUST be "WAIT" (not a live BUY/SELL).
- For BUY/SELL: entry, stopLoss, takeProfit1, takeProfit2 as numbers consistent with the visible price; riskRewardRatio e.g. "1:3".
- For WAIT: set "entry" to the SUGGESTED zone to wait for (the nearest optimal level aligned with the dominant bias — e.g. a higher-timeframe order block / FVG / discount-premium); set stopLoss/takeProfit1/takeProfit2/riskRewardRatio to null; and set "waitReason" explaining, in top-down terms, WHY there is no confirmed entry yet (which timeframes disagree / weak confluence) and WHERE/WHY to wait.
- reasoning: 2-4 sentences explaining, in top-down terms, why the trade is or isn't confirmed.

## STEP 4 — SUMMARY
- summary: 2-3 sentence executive summary of the multi-timeframe picture.
- Also identify symbol, market ("forex|crypto|indices|commodities|synthetic|unknown"), broker (or "Unknown"), currentPrice (number or null).

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown fences, no commentary) matching exactly this schema:

{
  "symbol": string,
  "market": "forex|crypto|indices|commodities|synthetic|unknown",
  "broker": string,
  "currentPrice": number|null,
  "timeframes": [
    {
      "timeframe": string,
      "trend": "bullish|bearish|ranging",
      "marketStructure": string,
      "keyLevels": [{ "label": string, "level": number|null, "note": string, "type": string }],
      "bias": "BUY|SELL|NEUTRAL"
    }
  ],
  "alignmentStatus": "aligned|partial|conflicted",
  "confluenceScore": number,
  "dominantBias": "BUY|SELL",
  "conflicts": [{ "tf1": string, "tf2": string, "description": string }],
  "recommendation": {
    "decision": "BUY|SELL|WAIT",
    "entry": number|null,
    "stopLoss": number|null,
    "takeProfit1": number|null,
    "takeProfit2": number|null,
    "riskRewardRatio": string|null,
    "reasoning": string,
    "waitReason": string|null
  },
  "summary": string
}`;
};
