/**
 * Engine 4 — Explanation.
 *
 * Turns the decision + reading + perception into the human-facing `report`
 * (summary, validation reasons, confluences, risks, weaknesses, missing
 * elements, and a step-by-step `reasoning` chain). It also assembles the
 * `symbol/market/timeframe/...` header fields the Analysis document needs.
 *
 * Deterministic by design: everything it needs is already in the upstream
 * contracts, so it needs no extra AI call. It explains WHY a trade is proposed
 * — or, crucially, why NO trade — as a transparent chain of confluences.
 */

const fmt = (n) => (n == null ? '—' : String(n));

/**
 * Build the report + header from the pipeline stages.
 * @param {Object} params
 * @param {Object} params.perception
 * @param {Object} params.reading
 * @param {Object} params.decision - output of decisionEngine.decide
 * @returns {{ header: Object, report: Object }}
 */
export const explain = ({ perception, reading, decision }) => {
  const ctx = perception?.context || {};
  const { decision: verdict, confidenceScore, tradePlan, confluenceBreakdown = [] } = decision;

  const positives = confluenceBreakdown.filter((m) => m.weight > 0);
  const negatives = confluenceBreakdown.filter((m) => m.weight < 0);

  const symbol = ctx.symbol || 'Unknown';
  const timeframe = ctx.timeframe || 'Unknown';
  const dirWord = verdict === 'BUY' ? 'haussier' : verdict === 'SELL' ? 'baissier' : 'neutre';
  const waitReason = tradePlan?.waitReason || '';

  // --- Summary --------------------------------------------------------------
  let summary;
  if (verdict === 'WAIT') {
    summary = `Pas d'entrée immédiate sur ${symbol} ${timeframe} (confiance ${confidenceScore}%). ` +
      (waitReason ||
        `Le prix actuel n'est pas sur une zone optimale — attendre une meilleure configuration.`) +
      (positives.length ? ` Confluences déjà en place : ${positives.map((p) => p.reason).join(' ; ')}.` : '');
  } else if (verdict === 'NO_TRADE') {
    // Legacy verdict (kept for old records that still carry it).
    summary = `Aucun trade sur ${symbol} ${timeframe}. La confiance (${confidenceScore}%) est ` +
      `insuffisante ou les confluences se contredisent — mieux vaut rester à l'écart. ` +
      (negatives.length ? `Facteurs défavorables : ${negatives.map((n) => n.reason).join(' ; ')}.` : '');
  } else {
    summary = `Setup ${dirWord} sur ${symbol} ${timeframe} avec ${confidenceScore}% de confiance. ` +
      `Entrée ${fmt(tradePlan.entry)}, stop ${fmt(tradePlan.stopLoss)}, ` +
      `TP1 ${fmt(tradePlan.takeProfit1)} (R:R ${tradePlan.riskRewardRatio || '—'}). ` +
      `${positives.length} confluence(s) alignée(s).`;
  }

  // --- Step-by-step reasoning ----------------------------------------------
  const decisionStep =
    verdict === 'WAIT'
      ? `Étape 5 — Décision : WAIT (${confidenceScore}%). Zone suggérée : ${fmt(tradePlan.entry)}. ${waitReason}`.trim()
      : verdict === 'NO_TRADE'
        ? `Étape 5 — Décision : NO_TRADE. Règle métier : confiance < 70 % ⇒ pas de trade (${confidenceScore}%).`
        : `Étape 5 — Décision : ${verdict} à ${confidenceScore}% ; plan entrée ${fmt(tradePlan.entry)} / stop ${fmt(tradePlan.stopLoss)} / TP ${fmt(tradePlan.takeProfit1)}.`;
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
  // A live trade (BUY/SELL) is validated by its positive confluences; WAIT and
  // legacy NO_TRADE carry no validation (there is no active entry yet).
  const isLive = verdict === 'BUY' || verdict === 'SELL';
  const validationReasons = isLive ? positives.map((p) => p.reason) : [];
  const confluences = reading?.confluences?.length
    ? reading.confluences
    : positives.map((p) => p.reason);
  const risks = [
    ...(reading?.risks || []),
    ...negatives.map((n) => n.reason),
    ...(verdict === 'WAIT'
      ? ['Entrer maintenant (hors zone optimale) expose à un stop-hunt / une liquidation']
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
    market: ctx.market || 'unknown',
    timeframe,
    broker: ctx.platform || 'Unknown',
    currentPrice: ctx.currentPrice ?? null,
  };

  return { header, report };
};

export default { explain };
