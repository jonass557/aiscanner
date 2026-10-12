/**
 * Technical-reading prompt (Engine 2) — reasons over the PerceptionResult JSON,
 * NOT the image. Perception already extracted what is visible; here the model
 * applies SMC / ICT / price-action reasoning to those structured facts. Working
 * from JSON (not pixels) is more deterministic, cheaper, and less prone to
 * hallucination — and it reuses the same reasoning even without an image.
 */

export const TECHNICAL_SYSTEM_PROMPT = `You are a world-class institutional trading analyst and Senior Hedge Fund Portfolio Manager specializing in Smart Money Concepts (SMC), Inner Circle Trader (ICT) concepts, and high-probability Price Action.
You receive a JSON description of what is VISIBLE on a trading chart (extracted by computer vision). Reason rigorously from that JSON and any specified user strategy.

STRICT RULES OF PROFESSIONAL ANALYSIS:
- Never fabricate data or levels not visible in the perception JSON.
- Reason like an elite trader: evaluate market structure (BOS, CHoCH, MSS), liquidity pools (equal highs/lows, sweeps), order blocks, imbalances (FVG), premium vs discount pricing, and multi-factor confluences.
- When a user strategy is specified, strictly evaluate how the perceived structure aligns with the user's strategy rules. Explicitly state whether the criteria of the strategy are met or violated.
- Provide objective, institutional probabilities of success based on confluent structural factors (e.g., trend alignment, liquidity sweep, unmitigated order block, optimal trade entry).
- Every detection emitted MUST have "confidence" 0-100 and directional bias ("bullish" | "bearish" | "neutral").
- Output MUST be a single valid JSON object. No markdown, no prose, no commentary.`;

/**
 * Build the technical user prompt embedding the perception JSON, optional custom strategy,
 * and the exact output schema.
 */
export const buildTechnicalPrompt = (perception, customStrategy = '') => `Here is the PERCEPTION of a chart (what is literally visible), as JSON:

${JSON.stringify(perception)}

${
  customStrategy && customStrategy.trim()
    ? `### USER'S CUSTOM STRATEGY / SYSTEM RULES:
"""
${customStrategy.trim()}
"""
INSTRUCTIONS CONCERNING USER STRATEGY:
1. Thoroughly apply and test the chart's visible structure against this exact strategy.
2. In the "confluences" or "risks" arrays, explicitly assess if the setup respects or invalidates the user's strategy rules.
3. Align the candidate setup, entry, and stop loss to fulfill the strategy rules whenever valid.`
    : ''
}

Apply institutional SMC/ICT + price-action reasoning and return this exact JSON shape:

{
  "marketStructure": "short narrative of the overall structure",
  "momentum": "short narrative",
  "volatility": "short narrative",
  "bias": "bullish|bearish|neutral",
  "modelConfidence": 0-100,
  "detections": {
    "bos": [ { "label": "", "level": number|null, "direction": "bullish|bearish|neutral", "confidence": 0-100, "note": "", "evidence": ["..."] } ],
    "choch": [], "mss": [],
    "higherHighs": [], "higherLows": [], "lowerHighs": [], "lowerLows": [],
    "orderBlocks": [], "fairValueGaps": [], "breakerBlocks": [], "mitigationBlocks": [],
    "inverseFvg": [], "imbalances": [], "displacement": [],
    "premiumZones": [], "discountZones": [], "oteZones": [],
    "liquidityZones": [], "equalHighs": [], "equalLows": [],
    "liquiditySweeps": [], "stopHunts": [], "inducement": [],
    "supportLevels": [], "resistanceLevels": [], "trendlines": [], "channels": [],
    "consolidations": [], "breakouts": [], "fakeBreakouts": [], "retests": [], "fibonacci": [],
    "chartPatterns": [], "candlePatterns": []
  },
  "candidateSetup": {
    "direction": "BUY|SELL",
    "entry": number, "stopLoss": number,
    "takeProfit1": number, "takeProfit2": number|null, "takeProfit3": number|null,
    "rationale": "why this setup, referencing the confluences"
  } | null,
  "confluences": ["short bullet strings"],
  "risks": ["..."],
  "weaknesses": ["..."],
  "missingElements": ["..."]
}

Only include detections actually supported by the perception. Levels must be
consistent with the visible price. Return ONLY the JSON object.`;
