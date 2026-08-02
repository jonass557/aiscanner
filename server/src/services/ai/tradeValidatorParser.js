/**
 * Parses/normalizes the AI Trade Validator's raw JSON response into a clean
 * object matching the TradeValidation schema. Reuses extractJson from the
 * shared responseParser.
 */
import { extractJson } from './responseParser.js';

const VALID_MARKETS = ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'];
const VALID_DECISIONS = ['VALIDATE', 'WAIT', 'REJECT'];
const VALID_MODES = ['screenshot', 'parameters'];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const parseTradeValidationResponse = (raw) => {
  const data = extractJson(raw);

  const decision = VALID_DECISIONS.includes(data.decision) ? data.decision : 'WAIT';
  const confidenceScore = clamp(Math.round(toNumberOrNull(data.confidenceScore) ?? 0), 0, 100);
  const riskScore = clamp(Math.round(toNumberOrNull(data.riskScore) ?? 50), 0, 100);

  const sl = data.stopLossAnalysis || {};
  const stopLossAnalysis = {
    isValid: Boolean(sl.isValid),
    placement: String(sl.placement || '').slice(0, 500),
    reasoning: String(sl.reasoning || '').slice(0, 2000),
    suggestions: (Array.isArray(sl.suggestions) ? sl.suggestions : []).map((s) => String(s).slice(0, 300)),
  };

  const tp = data.takeProfitAnalysis || {};
  const takeProfitAnalysis = {
    isValid: Boolean(tp.isValid),
    targeting: String(tp.targeting || '').slice(0, 500),
    reasoning: String(tp.reasoning || '').slice(0, 2000),
    suggestions: (Array.isArray(tp.suggestions) ? tp.suggestions : []).map((s) => String(s).slice(0, 300)),
  };

  const rm = data.riskManagementCheck || {};
  const riskManagementCheck = {
    positionSizeAcceptable: Boolean(rm.positionSizeAcceptable),
    riskPercentAcceptable: Boolean(rm.riskPercentAcceptable),
    rrAcceptable: Boolean(rm.rrAcceptable),
    reasoning: String(rm.reasoning || '').slice(0, 2000),
  };

  const weaknesses = (Array.isArray(data.weaknesses) ? data.weaknesses : [])
    .filter((w) => w && typeof w === 'object')
    .slice(0, 10)
    .map((w) => ({
      type: String(w.type || '').slice(0, 100),
      severity: ['high', 'medium', 'low'].includes(w.severity) ? w.severity : 'medium',
      description: String(w.description || '').slice(0, 500),
    }));

  const recommendations = (Array.isArray(data.recommendations) ? data.recommendations : [])
    .filter((r) => r && typeof r === 'object')
    .slice(0, 10)
    .map((r) => ({
      action: String(r.action || '').slice(0, 300),
      priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
    }));

  return {
    symbol: String(data.symbol || 'Unknown').slice(0, 50),
    timeframe: String(data.timeframe || 'Unknown').slice(0, 20),
    market: VALID_MARKETS.includes(data.market) ? data.market : 'unknown',
    inputMode: VALID_MODES.includes(data.inputMode) ? data.inputMode : 'screenshot',
    decision,
    confidenceScore,
    riskScore,
    riskRewardRatio: data.riskRewardRatio ? String(data.riskRewardRatio).slice(0, 20) : null,
    stopLossAnalysis,
    takeProfitAnalysis,
    riskManagementCheck,
    weaknesses,
    strengths: (Array.isArray(data.strengths) ? data.strengths : []).map((s) => String(s).slice(0, 500)),
    recommendations,
    summary: String(data.summary || '').slice(0, 3000),
  };
};
