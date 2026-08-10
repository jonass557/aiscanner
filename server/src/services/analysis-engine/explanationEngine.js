/**
 * Engine 4 — Explanation.
 *
 * Turns the decision + reading + perception into the human-facing `report`
 * (summary, validation reasons, confluences, risks, weaknesses, missing
 * elements, and a step-by-step `reasoning` chain). It also assembles the
 * `symbol/market/timeframe/...` header fields the Analysis document needs.
 *
 * The scanner always produces a directional verdict (BUY/SELL), so the summary
 * is always an actionable setup. When a live market snapshot is available the
 * plan is anchored on the real price and the report says so; otherwise it flags
 * that levels are estimated from the screenshot.
 *
 * Deterministic by design: everything it needs is already in the upstream
 * contracts, so it needs no extra AI call.
 */

const fmt = (n) => (n == null ? '—' : String(n));

/**
 * Build the report + header from the pipeline stages.
 * @param {Object} params
 * @param {Object} params.perception
 * @param {Object} params.reading
 * @param {Object} params.decision - output of decisionEngine.decide
 * @param {Object} [params.market] - live snapshot { symbol, quote, source, isRealData }
 * @returns {{ header: Object, report: Object }}
 */
export const explain = ({ perception, reading, decision, market = null }) => {
  const ctx = perception?.context || {};
  const {
    decision: verdict,
    confidenceScore,
    confidenceLabel,
    tradePlan,
    confluenceBreakdown = [],
  } = decision;

  const positives = confluenceBreakdown.filter((m) => m.weight > 0);
  const negatives = confluenceBreakdown.filter((m) => m.weight < 0);

  const symbol = ctx.symbol || market?.symbol || 'Unknown';
  const timeframe = ctx.timeframe || market?.timeframe || 'Unknown';
  const dirWord = verdict === 'BUY' ? 'haussier (ACHAT)' : 'baissier (VENTE)';

  // Data-source honesty: is the plan anchored on live prices or the screenshot?
  const dataNote = market
    ? market.isRealData
      ? `Niveaux ancrés sur le prix réel en direct (${market.source}).`
      : `Niveaux estimés — données de marché simulées (pas de flux temps réel pour cet actif).`
    : `Niveaux estimés depuis la capture (pas de flux marché disponible).`;

  // --- Summary --------------------------------------------------------------
  const summary =
    `Setup ${dirWord} sur ${symbol} ${timeframe} — confiance ${confidenceLabel.toLowerCase()} ` +
    `(${confidenceScore}%). Entrée ${fmt(tradePlan.entry)}, stop ${fmt(tradePlan.stopLoss)}, ` +
    `TP1 ${fmt(tradePlan.takeProfit1)} (R:R ${tradePlan.riskRewardRatio || '—'}). ` +
    `${positives.length} confluence(s) alignée(s). ${dataNote}`;

  // --- Step-by-step reasoning ----------------------------------------------
  const decisionStep =
    `Étape 5 — Décision : ${verdict} à ${confidenceScore}% (${confidenceLabel}) ; ` +
    `plan entrée ${fmt(tradePlan.entry)} / stop ${fmt(tradePlan.stopLoss)} / TP ${fmt(tradePlan.takeProfit1)}.`;
  const reasoning = [
    `Étape 1 — Perception : ${perception?.candles?.length || 0} bougie(s), ` +
      `${perception?.drawnObjects?.length || 0} objet(s) dessiné(s), ` +
      `${perception?.indicators?.length || 0} indicateur(s) détecté(s) sur le graphe.`,
    `Étape 2 — Structure : biais ${reading?.bias || 'neutre'}. ${reading?.marketStructure || ''}`.trim(),
    `Étape 3 — Confluences : ${positives.length
      ? positives.map((p) => `${p.reason} (+${p.weight})`).join(' ; ')
      : 'aucune confluence forte détectée'}.`,
    negatives.length
      ? `Étape 4 — Contre-signaux : ${negatives.map((n) => `${n.reason} (${n.weight})`).join(' ; ')}.`
      : 'Étape 4 — Contre-signaux : aucun majeur.',
    decisionStep,
  ];

  // --- Reasons / confluences / risks ---------------------------------------
  // A directional trade is validated by its positive confluences.
  const validationReasons = positives.map((p) => p.reason);
  const confluences = reading?.confluences?.length
    ? reading.confluences
    : positives.map((p) => p.reason);
  const risks = [
    ...(reading?.risks || []),
    ...negatives.map((n) => n.reason),
    // Honesty on a low-confidence forced direction.
    ...(confidenceScore < 50
      ? ['Confiance faible : confluences limitées — réduire la taille de position']
      : []),
    ...(market && !market.isRealData
      ? ['Données de marché simulées — vérifier les niveaux sur votre plateforme avant d’exécuter']
      : []),
  ];
  const weaknesses = reading?.weaknesses || [];
  const missingElements = reading?.missingElements?.length
    ? reading.missingElements
    : (perception?.volumeVisible ? [] : ['Volume non visible sur le graphe']);

  const report = {
    summary,
    validationReasons,
    confluences: [...new Set(confluences)],
    risks: [...new Set(risks)],
    weaknesses,
    missingElements,
    reasoning,
  };

  const header = {
    symbol,
    market: market?.market || ctx.market || 'unknown',
    timeframe,
    broker: ctx.platform || 'Unknown',
    // Prefer the live price when we have real data; else the perceived price.
    currentPrice:
      market?.isRealData && market?.quote?.price != null
        ? market.quote.price
        : ctx.currentPrice ?? null,
  };

  return { header, report };
};

export default { explain };
