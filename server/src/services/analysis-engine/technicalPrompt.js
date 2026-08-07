/**
 * Technical-reading prompt (Engine 2) — reasons over the PerceptionResult JSON,
 * NOT the image. Perception already extracted what is visible; here the model
 * applies SMC / ICT / price-action reasoning to those structured facts. Working
 * from JSON (not pixels) is more deterministic, cheaper, and less prone to
 * hallucination — and it reuses the same reasoning even without an image.
 */

export const TECHNICAL_SYSTEM_PROMPT = `You are an expert Smart Money Concepts (SMC/ICT) and price-action analyst.
You receive a JSON description of what is VISIBLE on a trading chart (already
extracted by a computer-vision step). Reason ONLY from that JSON.

STRICT RULES:
- Never invent data that is not supported by the provided perception JSON.
- Every detection you emit MUST carry a "confidence" 0-100 and, when possible,
  a "direction": "bullish" | "bearish" | "neutral".
- Reference the perceived evidence in "evidence": short strings naming the
  perceived elements that justify the detection.
- If the chart shows no valid setup, say so: bias "neutral" and candidateSetup null.
- Output MUST be a single valid JSON object. No markdown, no prose, no comments.`;

/**
 * Build the technical user prompt embedding the perception JSON and the exact
 * output schema. FAMILY names mirror Analysis.technicalAnalysis so the parser
 * maps them 1:1.
 */
export const buildTechnicalPrompt = (perception) => `Here is the PERCEPTION of a chart (what is literally visible), as JSON:

${JSON.stringify(perception)}

Apply SMC/ICT + price-action reasoning and return this exact JSON shape:

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
