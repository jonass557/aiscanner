/**
 * System + instruction prompts for the AI Trade Validator.
 *
 * The model receives a trade plan (either as a screenshot with marked levels
 * or as explicit parameters) and judges it against strict SMC + risk-management
 * rules, returning a structured verdict: VALIDATE / WAIT / REJECT.
 */

export const TV_SYSTEM_PROMPT = `You are an elite institutional risk manager and SMC trading mentor. Your job is to independently validate or reject trade plans before a trader executes them.

You apply strict, conservative criteria:
- Risk-to-Reward (R:R) must be at least 1:2 for validation. Below that, the trade is questionable.
- Stop Loss must be placed at a TECHNICAL REASON — behind a swing point, order block, or liquidity zone. A stop placed arbitrarily earns an automatic REJECT.
- Take Profits must target realistic zones (liquidity pools, prior structure, premium/discount zones). Unrealistic targets reduce confidence.
- The entry must align with market structure and higher-timeframe bias.
- No more than 2% of account should be risked on a single trade.

You either receive a screenshot showing the planned entry/SL/TP levels, or explicit numeric parameters. Analyse WHAT YOU SEE (or WHAT IS GIVEN) and render a verdict.

Respond ONLY in JSON (no markdown fences).`;

export const buildTradeValidatorPrompt = (params = {}) => {
  const { symbol, timeframe, entry, stopLoss, takeProfit1, takeProfit2, strategy, riskPercent, accountBalance } = params;
  if (entry != null) {
    return `Validate this trade plan given as numeric parameters:

Symbol: ${symbol || 'Unknown'}
Timeframe: ${timeframe || 'Unknown'}
Entry: ${entry}
Stop Loss: ${stopLoss}
Take Profit 1: ${takeProfit1}
Take Profit 2: ${takeProfit2 || 'N/A'}
Strategy: ${strategy || 'Not specified'}
Risk % of account: ${riskPercent || 'Not specified'}%
Account Balance: ${accountBalance != null ? `$${accountBalance}` : 'Unknown'}

Analyze the plan and return a verdict.`;
  }
  // Screenshot mode — the image is attached alongside this text.
  return `Validate the trade plan visible in the provided screenshot.

Look for: the entry level, stop loss placement, take profit targets, any drawn levels or annotations, and the visible market structure.

Is the stop loss placed at a technical level?
Are the profit targets realistic given visible structure?
Is the risk-to-reward acceptable?
What weaknesses or risks do you see?`;
};

export const TV_OUTPUT_SCHEMA = `{
  "symbol": string,
  "timeframe": string,
  "market": "forex|crypto|indices|commodities|synthetic|unknown",
  "inputMode": "screenshot|parameters",
  "decision": "VALIDATE|WAIT|REJECT",
  "confidenceScore": number (0-100),
  "riskScore": number (0-100 — higher = riskier),
  "riskRewardRatio": string|null (e.g. "1:2.5"),
  "stopLossAnalysis": {
    "isValid": boolean,
    "placement": string (description of where SL is),
    "reasoning": string,
    "suggestions": string[] (alternative levels if invalid)
  },
  "takeProfitAnalysis": {
    "isValid": boolean,
    "targeting": string (description of TP targets),
    "reasoning": string,
    "suggestions": string[]
  },
  "riskManagementCheck": {
    "positionSizeAcceptable": boolean,
    "riskPercentAcceptable": boolean,
    "rrAcceptable": boolean,
    "reasoning": string
  },
  "weaknesses": [{ "type": string, "severity": "high|medium|low", "description": string }],
  "strengths": [string],
  "recommendations": [{ "action": string, "priority": "high|medium|low" }],
  "summary": string (2-4 sentences)
}`;
