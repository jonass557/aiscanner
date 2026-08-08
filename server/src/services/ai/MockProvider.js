import { BaseProvider } from './BaseProvider.js';

/**
 * Deterministic mock provider used when no real API key is configured and
 * during automated tests. Returns a realistic, schema-valid analysis so the
 * full scan flow (upload -> analyze -> persist -> display) can be exercised
 * end-to-end without incurring AI costs.
 */
export class MockProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'mock';
    this.model = 'mock-analyst-v1';
  }

  isConfigured() {
    return true;
  }

  async analyze() {
    // Simulate network/model latency
    await new Promise((r) => setTimeout(r, 400));

    const sample = {
      symbol: 'EURUSD',
      market: 'forex',
      timeframe: 'H1',
      broker: 'Unknown',
      currentPrice: 1.0865,
      technicalAnalysis: {
        marketStructure: 'Bullish structure on H1 with a series of higher highs and higher lows.',
        bos: [{ label: 'Bullish BOS', level: 1.084, note: 'Break above prior swing high', type: 'bullish' }],
        choch: [],
        mss: [{ label: 'MSS to bullish', level: 1.0825, note: 'Shift confirmed with displacement', type: 'bullish' }],
        orderBlocks: [{ label: 'Demand OB', level: 1.0835, note: 'Last down candle before impulse', type: 'bullish' }],
        fairValueGaps: [{ label: 'Bullish FVG', level: 1.0848, note: 'Unfilled imbalance', type: 'bullish' }],
        breakerBlocks: [],
        mitigationBlocks: [],
        liquidityZones: [{ label: 'Buy-side liquidity', level: 1.089, note: 'Resting stops above highs', type: 'liquidity' }],
        equalHighs: [{ label: 'Equal highs', level: 1.089, note: 'Liquidity pool', type: 'eqh' }],
        equalLows: [],
        supportLevels: [{ label: 'Support', level: 1.083, note: 'Prior consolidation base', type: 'support' }],
        resistanceLevels: [{ label: 'Resistance', level: 1.089, note: 'Recent swing high', type: 'resistance' }],
        trendlines: [{ label: 'Ascending trendline', level: null, note: 'Connecting HLs', type: 'trend' }],
        consolidations: [],
        breakouts: [{ label: 'Range breakout', level: 1.0855, note: 'Broke consolidation upward', type: 'bullish' }],
        fakeBreakouts: [],
        momentum: 'Bullish momentum, strong displacement candles.',
        volatility: 'Medium',
        premiumZones: [{ label: 'Premium', level: 1.088, note: 'Above 50% equilibrium', type: 'premium' }],
        discountZones: [{ label: 'Discount', level: 1.0835, note: 'Below equilibrium — favorable longs', type: 'discount' }],
      },
      decision: 'BUY',
      confidenceScore: 78,
      tradePlan: {
        entry: 1.0848,
        stopLoss: 1.0825,
        takeProfit1: 1.089,
        takeProfit2: 1.0915,
        takeProfit3: 1.094,
        riskRewardRatio: '1:3',
        estimatedDuration: '6-18 hours',
        estimatedProbability: 72,
      },
      report: {
        summary:
          'Bullish setup supported by a confirmed MSS, a discount-zone demand order block, and an unfilled FVG acting as entry. Buy-side liquidity above equal highs is the logical target.',
        validationReasons: [
          'Market structure shift to bullish with displacement',
          'Entry aligned with demand order block in discount zone',
          'Unfilled FVG provides a clean entry region',
        ],
        confluences: ['MSS + OB', 'Discount zone entry', 'Liquidity target above equal highs'],
        risks: ['Approaching higher-timeframe resistance', 'Possible fake breakout at equal highs'],
        weaknesses: ['No higher-timeframe confirmation visible in screenshot'],
        missingElements: ['Volume profile', 'Higher timeframe context'],
      },
    };

    return JSON.stringify(sample);
  }

  async analyzeMultiple({ images = [] }) {
    await new Promise((r) => setTimeout(r, 500));

    // Produce a per-timeframe read plus a global multi-timeframe verdict.
    const trends = ['bullish', 'bullish', 'ranging', 'bearish'];
    const timeframes = images.map((img, i) => ({
      timeframe: img.label,
      trend: trends[i % trends.length],
      marketStructure: `On ${img.label}, price shows a ${trends[i % trends.length]} structure with clear reaction at key levels.`,
      keyLevels: [
        { label: 'Order Block', level: 1.0835 + i * 0.001, note: 'Institutional demand', type: 'bullish' },
        { label: 'Liquidity', level: 1.089 + i * 0.001, note: 'Resting stops', type: 'liquidity' },
      ],
      bias: trends[i % trends.length] === 'bullish' ? 'BUY' : trends[i % trends.length] === 'bearish' ? 'SELL' : 'NEUTRAL',
    }));

    const bulls = timeframes.filter((t) => t.trend === 'bullish').length;
    const bears = timeframes.filter((t) => t.trend === 'bearish').length;
    const aligned = bears === 0 && bulls >= timeframes.length - 1;

    const sample = {
      symbol: 'EURUSD',
      market: 'forex',
      broker: 'Unknown',
      currentPrice: 1.0865,
      timeframes,
      alignmentStatus: aligned ? 'aligned' : bulls && bears ? 'conflicted' : 'partial',
      confluenceScore: aligned ? 82 : 58,
      dominantBias: bulls >= bears ? 'BUY' : 'SELL',
      conflicts: bulls && bears
        ? [{ tf1: timeframes.find((t) => t.trend === 'bullish')?.timeframe, tf2: timeframes.find((t) => t.trend === 'bearish')?.timeframe, description: 'Lower timeframe bullish momentum against higher timeframe bearish structure — wait for alignment.' }]
        : [],
      recommendation: {
        decision: aligned ? 'BUY' : 'NO_TRADE',
        entry: aligned ? 1.0848 : null,
        stopLoss: aligned ? 1.0825 : null,
        takeProfit1: aligned ? 1.089 : null,
        takeProfit2: aligned ? 1.0915 : null,
        riskRewardRatio: aligned ? '1:3' : null,
        reasoning: aligned
          ? 'All analyzed timeframes align bullish. Higher timeframe structure supports the lower timeframe entry, giving a high-probability long.'
          : 'Timeframes are not aligned. Higher and lower timeframes disagree, so the signal is not confirmed. Stand aside until structure agrees.',
      },
      summary: aligned
        ? 'Strong multi-timeframe alignment favoring longs. All timeframes point the same direction with clean structure.'
        : 'Mixed multi-timeframe picture. Conflicting structure across timeframes weakens the setup — no confirmed trade.',
    };

    return JSON.stringify(sample);
  }

  async chat({ messages = [] }) {
    await new Promise((r) => setTimeout(r, 400));
    const last = [...messages].reverse().find((m) => m.role === 'user');
    const q = (last?.content || '').toLowerCase();

    if (q.includes('order block') || q.includes('ob')) {
      return "An **order block** is the last opposing candle before a strong, impulsive move that breaks structure. It marks where institutions placed large orders.\n\n- A **bullish order block** is the last down-candle before a strong rally.\n- A **bearish order block** is the last up-candle before a sharp drop.\n\nTraders watch for price to return (mitigate) to these zones to join the institutional move. Combine them with a **discount/premium** read and a clear **break of structure** for higher-probability entries.";
    }
    if (q.includes('risk') || q.includes('lot') || q.includes('position siz')) {
      return "**Risk management** is what keeps you in the game. Core rules:\n\n1. **Risk a fixed % per trade** — typically 0.5–2% of your account. Never more.\n2. **Position size from your stop**, not the other way around: `lot size = (account × risk%) ÷ (stop distance in pips × pip value)`.\n3. **Aim for R:R ≥ 1:2** so winners outweigh losers even at a 50% hit-rate.\n4. **Cap daily loss** (e.g. 3 losing trades = stop for the day).\n\nWould you like me to walk through a concrete position-size example?";
    }
    if (q.includes('choch') || q.includes('bos') || q.includes('structure')) {
      return "Great question on market structure:\n\n- **BOS (Break of Structure)** = price breaks a prior swing point *in the direction of the trend* → trend **continuation**.\n- **CHoCH (Change of Character)** = price breaks a swing point *against* the current trend → potential **reversal**, the first sign momentum is shifting.\n\nSequence to watch: trend → CHoCH (warning) → new structure forms → BOS confirms the new trend. Mark your swing highs/lows clearly and only act once the break **closes**, not just wicks.";
    }
    return "That's a solid question. In Smart Money Concepts, the goal is always to trade *with* institutional order flow: identify the higher-timeframe bias, wait for price to reach a point of interest (order block, FVG, liquidity pool), and only enter on a confirmation like a CHoCH or BOS on a lower timeframe.\n\nTell me which concept you'd like to go deeper on — market structure, liquidity, order blocks, fair value gaps, or risk management — and I'll break it down step by step with examples.";
  }

  /**
   * Data-driven analysis. The mock derives a plausible, COHERENT analysis from
   * the actual candle data embedded in the prompt (never fabricated): it reads
   * the numeric OHLCs to determine trend, swing points, and levels, then builds
   * the same JSON schema the real providers return.
   */
  async analyzeData({ userPrompt = '' }) {
    await new Promise((r) => setTimeout(r, 450));

    // Reconstruct candles from the prompt's compact lines "O:.. H:.. L:.. C:..".
    const candleRe = /O:([\d.]+) H:([\d.]+) L:([\d.]+) C:([\d.]+)/g;
    const candles = [];
    let m;
    while ((m = candleRe.exec(userPrompt)) !== null) {
      candles.push({ open: +m[1], high: +m[2], low: +m[3], close: +m[4] });
    }

    const symbol = (userPrompt.match(/Analyze\s+([\w\s/]+?)\s+on the/i) || [])[1]?.trim() || 'EURUSD';
    const timeframe = (userPrompt.match(/on the\s+(\S+)\s+timeframe/i) || [])[1] || 'H1';
    const currentPrice = (userPrompt.match(/CURRENT PRICE:\s*([\d.]+)/) || [])[1];
    const price = currentPrice ? +currentPrice : candles[candles.length - 1]?.close ?? 100;
    const market =
      (userPrompt.match(/MARKET:\s*(\w+)/) || [])[1]?.toLowerCase() ||
      (symbol.includes('/') ? 'forex' : 'crypto');
    const simulated = /SIMULATED data/i.test(userPrompt);

    // --- Derive structure from the real numbers ---
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const last10 = closes.slice(-10);
    const trend = last10[last10.length - 1] >= last10[0] ? 'bullish' : 'bearish';
    const swingHigh = Math.max(...highs);
    const swingLow = Math.min(...lows);
    const atHigh = price >= swingHigh * 0.995;
    const atLow = price <= swingLow * 1.005;
    const range = swingHigh - swingLow;
    const mid = (swingHigh + swingLow) / 2;

    const decision = atHigh ? 'SELL' : atLow ? 'BUY' : 'WAIT';
    const confidenceScore = atHigh || atLow ? Math.round(72 + Math.random() * 18) : Math.round(50 + Math.random() * 12);

    const spread = range * 0.02;
    const rr = 2 + Math.round(Math.random() * 2);
    // On WAIT, suggest the nearer range extreme as the zone to wait for.
    const waitZone = +(Math.abs(price - swingLow) <= Math.abs(swingHigh - price) ? swingLow : swingHigh).toFixed(5);
    const entry = decision === 'BUY' ? +(price + spread * 0.2).toFixed(5) : decision === 'SELL' ? +(price - spread * 0.2).toFixed(5) : waitZone;
    const stopLoss = decision === 'BUY' ? +(price - spread).toFixed(5) : decision === 'SELL' ? +(price + spread).toFixed(5) : null;
    const tp1 = decision === 'BUY' ? +(price + spread * rr * 0.6).toFixed(5) : decision === 'SELL' ? +(price - spread * rr * 0.6).toFixed(5) : null;
    const tp2 = decision === 'BUY' ? +(price + spread * rr).toFixed(5) : decision === 'SELL' ? +(price - spread * rr).toFixed(5) : null;
    const tp3 = decision === 'BUY' ? +(price + spread * rr * 1.4).toFixed(5) : decision === 'SELL' ? +(price - spread * rr * 1.4).toFixed(5) : null;
    const waitSide = waitZone === swingLow ? 'achat' : 'vente';
    const waitReason = decision === 'WAIT'
      ? `Prix au milieu du range (${swingLow}–${swingHigh}), pas de bord clair. ` +
        `Attendre que le prix atteigne ${waitZone} (${waitZone === swingLow ? 'support/discount' : 'résistance/premium'}) ` +
        `et y réagisse avant d'envisager une ${waitSide}.`
      : null;

    const direction = trend === 'bullish' ? 'Bullish' : 'Bearish';
    const structureDesc = `Price shows a ${trend} structure on ${timeframe}, currently ${
      atHigh ? 'testing the recent swing high' : atLow ? 'testing the recent swing low' : 'trading in the middle of the recent range'
    }.`;

    const sample = {
      symbol,
      market,
      timeframe,
      currentPrice: price,
      technicalAnalysis: {
        marketStructure: structureDesc,
        bos: trend === 'bullish'
          ? [{ label: 'Bullish BOS', level: +mid.toFixed(5), note: 'Break above prior swing high', type: 'bullish' }]
          : [{ label: 'Bearish BOS', level: +mid.toFixed(5), note: 'Break below prior swing low', type: 'bearish' }],
        choch: [],
        mss: [],
        orderBlocks: atLow
          ? [{ label: 'Demand OB', level: +lows.slice(-5).reduce((a, b) => Math.min(a, b), Infinity).toFixed(5), note: 'Last down candle before impulse', type: 'bullish' }]
          : atHigh
            ? [{ label: 'Supply OB', level: +highs.slice(-5).reduce((a, b) => Math.max(a, b), 0).toFixed(5), note: 'Last up candle before drop', type: 'bearish' }]
            : [],
        fairValueGaps: [],
        breakerBlocks: [],
        mitigationBlocks: [],
        liquidityZones: [
          { label: trend === 'bullish' ? 'Buy-side liquidity' : 'Sell-side liquidity', level: trend === 'bullish' ? +swingHigh.toFixed(5) : +swingLow.toFixed(5), note: 'Resting stops beyond the swing', type: 'liquidity' },
        ],
        equalHighs: [],
        equalLows: [],
        supportLevels: [{ label: 'Support', level: +swingLow.toFixed(5), note: 'Recent swing low', type: 'support' }],
        resistanceLevels: [{ label: 'Resistance', level: +swingHigh.toFixed(5), note: 'Recent swing high', type: 'resistance' }],
        trendlines: [{ label: `${direction} trendline`, level: null, note: `Connecting recent ${trend === 'bullish' ? 'higher lows' : 'lower highs'}`, type: 'trend' }],
        consolidations: [],
        breakouts: atHigh || atLow ? [{ label: 'Range extreme test', level: +price.toFixed(5), note: 'Testing the range boundary', type: 'breakout' }] : [],
        fakeBreakouts: [],
        momentum: `${direction} momentum, ${atHigh || atLow ? 'at a key decision point' : 'neutral'}.`,
        volatility: 'Medium',
        premiumZones: [{ label: 'Premium', level: +mid.toFixed(5), note: 'Upper half of range', type: 'premium' }],
        discountZones: [{ label: 'Discount', level: +mid.toFixed(5), note: 'Lower half of range', type: 'discount' }],
      },
      decision,
      confidenceScore,
      tradePlan:
        decision === 'WAIT'
          ? { entry, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null, riskRewardRatio: null, estimatedDuration: null, estimatedProbability: confidenceScore, tradeType: null, waitReason }
          : {
              entry,
              stopLoss,
              takeProfit1: tp1,
              takeProfit2: tp2,
              takeProfit3: tp3,
              riskRewardRatio: `1:${rr}`,
              estimatedDuration: timeframe === 'M15' ? '1-4 hours' : timeframe === 'H1' ? '4-12 hours' : '1-3 days',
              estimatedProbability: Math.round(65 + Math.random() * 15),
              tradeType: timeframe === 'M15' ? 'scalp' : timeframe === 'H1' ? 'intraday' : 'swing',
            },
      report: {
        summary: `${direction} bias on ${symbol} ${timeframe}${simulated ? ' (données simulées — démonstration)' : ''}. ${structureDesc} ${atHigh ? 'Price is stretched into resistance/sell-side liquidity — a short with a tight stop is defensible.' : atLow ? 'Price is at support/discount — a long from the demand zone is defensible.' : waitReason}`,
        validationReasons: decision === 'WAIT' ? [] : [
          `${direction} market structure on ${timeframe}`,
          `Reaction at the range ${atHigh ? 'high' : 'low'}`,
          'Defined stop behind the swing point',
        ],
        confluences: decision === 'WAIT' ? [] : ['Range extreme + liquidity', 'Defined structure', `R:R 1:${rr}`],
        risks: atHigh ? ['Possible break of the swing high (liquidity run)'] : atLow ? ['Possible breakdown of the swing low'] : ['Entrer maintenant (milieu de range) = risque de faux signal / choppy'],
        weaknesses: decision === 'WAIT' ? ['No clear edge at current price — price sits mid-range'] : ['No higher-timeframe confirmation embedded'],
        missingElements: ['Volume profile', 'Higher-timeframe context'],
        reasoning: [
          `Étape 1 — Lire la structure : les ${candles.length} bougies montrent une structure ${trend} sur ${timeframe} (dernières clôtures ${last10[0]} → ${last10[last10.length - 1]}).`,
          `Étape 2 — Position dans le range : le prix ${atHigh ? `teste le sommet ${swingHigh} (zone de liquidité acheteur, premium)` : atLow ? `teste le creux ${swingLow} (zone de liquidité vendeur, discount)` : `est au milieu du range (${swingLow}–${swingHigh}), au point d'équilibre`}.`,
          `Étape 3 — Décision : ${decision === 'BUY' ? 'achat car le prix est en discount sur support' : decision === 'SELL' ? 'vente car le prix est en premium sur résistance' : `WAIT — pas de bord clair, zone suggérée ${entry}`} (confiance ${confidenceScore}%).`,
          `Étape 4 — Plan : ${decision === 'WAIT' ? `attendre le prix en ${entry} avant toute entrée` : `entrée ${entry}, stop ${stopLoss} (derrière la structure), cibles ${tp1}/${tp2}/${tp3}, R:R 1:${rr}`}.`,
        ],
      },
    };

    return JSON.stringify(sample);
  }

  async validateTrade({ userPrompt = '' }) {
    await new Promise((r) => setTimeout(r, 450));

    // Try to read numeric params out of the prompt so the mock reacts to input.
    const num = (label) => {
      const m = userPrompt.match(new RegExp(`${label}:\\s*([\\d.]+)`, 'i'));
      return m ? Number(m[1]) : null;
    };
    const entry = num('Entry');
    const sl = num('Stop Loss');
    const tp1 = num('Take Profit 1');

    // Compute a rough R:R if we have the numbers; otherwise use a default.
    let rr = 2.4;
    if (entry && sl && tp1) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp1 - entry);
      if (risk > 0) rr = reward / risk;
    }
    const rrAcceptable = rr >= 2;
    const decision = rrAcceptable ? (rr >= 3 ? 'VALIDATE' : 'WAIT') : 'REJECT';

    const inputMode = /screenshot/i.test(userPrompt) ? 'screenshot' : 'parameters';

    const sample = {
      symbol: (userPrompt.match(/Symbol:\s*(\S+)/i) || [])[1] || 'EURUSD',
      timeframe: (userPrompt.match(/Timeframe:\s*(\S+)/i) || [])[1] || 'H1',
      market: 'forex',
      inputMode,
      decision,
      confidenceScore: rrAcceptable ? (rr >= 3 ? 84 : 66) : 38,
      riskScore: rrAcceptable ? (rr >= 3 ? 28 : 52) : 78,
      riskRewardRatio: `1:${rr.toFixed(1)}`,
      stopLossAnalysis: {
        isValid: rrAcceptable,
        placement: sl ? `Stop at ${sl}` : 'Stop placed below the recent swing low / demand order block.',
        reasoning: rrAcceptable
          ? 'The stop sits just beyond a clear structural level, protecting the position while giving the trade room to breathe.'
          : 'The stop is too tight relative to the target, or not anchored to a clear structural level — it risks being wicked out prematurely.',
        suggestions: rrAcceptable ? [] : ['Move the stop below the last valid swing low', 'Anchor the stop behind the order block, not inside it'],
      },
      takeProfitAnalysis: {
        isValid: true,
        targeting: tp1 ? `First target at ${tp1}` : 'Targets resting liquidity above equal highs.',
        reasoning: 'Take profits are aligned with visible liquidity pools and prior structure, which are logical magnets for price.',
        suggestions: rrAcceptable ? [] : ['Consider a nearer first target to improve the effective R:R'],
      },
      riskManagementCheck: {
        positionSizeAcceptable: true,
        riskPercentAcceptable: true,
        rrAcceptable,
        reasoning: rrAcceptable
          ? 'Risk-to-reward meets the 1:2 minimum and position sizing is within safe limits.'
          : 'Risk-to-reward is below the 1:2 minimum — the expected value does not justify the trade as planned.',
      },
      weaknesses: rrAcceptable
        ? [{ type: 'confirmation', severity: 'low', description: 'No higher-timeframe confirmation attached to this plan.' }]
        : [
            { type: 'risk-reward', severity: 'high', description: 'R:R below 1:2 makes this a low-expectancy trade.' },
            { type: 'stop-placement', severity: 'medium', description: 'Stop loss is not clearly anchored to structure.' },
          ],
      strengths: rrAcceptable
        ? ['Entry aligned with a discount-zone order block', 'Clear liquidity target', 'Defined, structural stop loss']
        : ['A defined trade plan exists — refine the levels before executing.'],
      recommendations: rrAcceptable
        ? [{ action: 'Proceed once you see a lower-timeframe confirmation (CHoCH/BOS).', priority: 'medium' }]
        : [
            { action: 'Improve the risk-to-reward to at least 1:2 before entering.', priority: 'high' },
            { action: 'Re-anchor the stop loss behind a valid structural level.', priority: 'high' },
          ],
      summary: rrAcceptable
        ? `This plan is ${decision === 'VALIDATE' ? 'well-structured with a healthy risk-to-reward' : 'reasonable but would benefit from stronger confirmation'}. The stop is defensible and the target is logical.`
        : 'This plan does not meet the minimum risk-management criteria. The risk-to-reward is too low and the stop placement is questionable — reject and re-plan.',
    };

    return JSON.stringify(sample);
  }
}
