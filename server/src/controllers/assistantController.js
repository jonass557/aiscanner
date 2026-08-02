import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import AssistantConversation from '../models/AssistantConversation.js';
import Analysis from '../models/Analysis.js';
import { parseAssistantIntent } from '../services/assistant/assistantIntent.js';
import { resolveContext } from '../services/assistant/contextManager.js';
import { getMarketSnapshot, SYMBOL_CATALOG, getQuote } from '../services/marketData/index.js';
import { analyzeMarketData, mentorReply } from '../services/ai/index.js';
import { getUpcomingHighImpact } from '../services/economicCalendarService.js';
import { logScan } from '../services/logService.js';
import logger from '../config/logger.js';

// Actions that analyze market data and consume a scan credit.
const ANALYSIS_ACTIONS = ['analyze', 'find_setups', 'should_i_trade', 'show_risks'];

/**
 * Humanize a decision for the chat reply.
 */
const decisionLabel = (d) => (d === 'BUY' ? 'ACHAT' : d === 'SELL' ? 'VENTE' : 'AUCUN TRADE');

/**
 * Build a spoken/chat summary for an assistant analysis message.
 */
const analysisToText = (analysis, snapshot) => {
  const tp = analysis.tradePlan || {};
  const rep = analysis.report || {};
  const real = snapshot?.isRealData ? `données temps réel (${snapshot.source})` : 'données simulées (démo)';
  const head = `${analysis.symbol} ${analysis.timeframe} · ${decisionLabel(analysis.decision)} · confiance ${analysis.confidenceScore}% · ${real}.`;
  if (analysis.decision === 'NO_TRADE') {
    return `${head}\n\n${rep.summary || 'Pas de setup exploitable.'}`;
  }
  const lines = [
    head,
    '',
    `Entrée : ${tp.entry}`,
    `Stop Loss : ${tp.stopLoss}`,
    `Take Profit 1/2/3 : ${tp.takeProfit1} / ${tp.takeProfit2} / ${tp.takeProfit3}`,
    `R:R : ${tp.riskRewardRatio} · Probabilité estimée : ${tp.estimatedProbability}% · Type : ${tp.tradeType || '—'}`,
    `Durée estimée : ${tp.estimatedDuration || '—'}`,
    '',
    rep.summary || '',
  ];
  return lines.filter(Boolean).join('\n');
};

/**
 * Fetch a snapshot for one symbol/timeframe, throwing a friendly error if the
 * symbol is unknown (so the assistant never invents data for a mystery symbol).
 */
const requireSnapshot = async (symbol, timeframe) => {
  const snap = await getMarketSnapshot(symbol, timeframe || 'H1', 120);
  if (!snap) {
    throw ApiError.badRequest(
      `Je n'ai pas trouvé de données pour "${symbol}". Essayez un symbole connu (EURUSD, XAUUSD, BTCUSD, US30, Volatility 75 Index…).`
    );
  }
  return snap;
};

/**
 * POST /assistant/conversations
 */
export const createConversation = asyncHandler(async (req, res) => {
  const conv = await AssistantConversation.create({
    user: req.user._id,
    title: req.body.title || 'Nouvelle conversation',
  });
  return sendSuccess(res, { statusCode: 201, message: 'Conversation created.', data: { conversation: conv } });
});

/**
 * GET /assistant/conversations
 */
export const listConversations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { user: req.user._id };

  const [items, total] = await Promise.all([
    AssistantConversation.find(filter)
      .select('title lastMessageAt messages createdAt')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AssistantConversation.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { conversations: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /assistant/conversations/:id
 */
export const getConversation = asyncHandler(async (req, res) => {
  const conv = await AssistantConversation.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!conv) throw ApiError.notFound('Conversation not found.');
  return sendSuccess(res, { data: { conversation: conv } });
});

/**
 * DELETE /assistant/conversations/:id
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const conv = await AssistantConversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!conv) throw ApiError.notFound('Conversation not found.');
  await conv.deleteOne();
  return sendSuccess(res, { message: 'Conversation deleted.' });
});

/**
 * POST /assistant/conversations/:id/message — the orchestrator.
 *
 * Flow: intent → context resolution → dispatch:
 *  - analyze/find_setups/should_i_trade/show_risks → market data + AI analysis
 *    (consumes 1 scan credit on success, persists an Analysis)
 *  - compare → two analyses side by side
 *  - best_markets/trending → universe-wide quote scan + mentor synthesis
 *  - coach/teach/chitchat/explain → mentor reply (free, no credit)
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const user = req.user;
  const { content } = req.body;
  if (!content || !String(content).trim()) throw ApiError.badRequest('Message is required.');
  const text = String(content).trim();

  // Load (or create) the conversation, then the message history.
  let conv = await AssistantConversation.findOne({ _id: req.params.id, user: user._id });
  if (!conv) {
    conv = await AssistantConversation.create({
      user: user._id,
      title: text.length > 50 ? text.slice(0, 47) + '…' : text,
    });
  }

  const history = conv.messages || [];

  // 1. Intent + context.
  const intent = parseAssistantIntent(text);
  const ctx = resolveContext({ params: intent.params, text, history, action: intent.action });
  logger.debug(`Assistant intent: ${intent.action} ${JSON.stringify(ctx)}`);

  // 2. Dispatch.
  let assistantText = '';
  let analysisIds = [];
  let dataSource = null;
  let isRealData = null;

  if (ANALYSIS_ACTIONS.includes(intent.action)) {
    // ---- Market analysis (data-driven), consumes 1 credit ----
    if (!ctx.symbols.length) {
      throw ApiError.badRequest('Sur quel marché voulez-vous que je me penche ? Précisez un symbole (ex: EURUSD, XAUUSD, BTCUSD).');
    }
    const symbol = ctx.symbols[0];
    const timeframe = ctx.timeframe || user.preferences?.favoriteTimeframes?.[0] || 'H1';

    if (!user.canScan()) {
      throw ApiError.forbidden(
        'Vous n\'avez plus de crédits de scan ce mois-ci. Passez à un plan supérieur ou attendez la réinitialisation mensuelle.'
      );
    }

    const snapshot = await requireSnapshot(symbol, timeframe);
    dataSource = snapshot.source;
    isRealData = snapshot.isRealData;

    const { analysis } = await analyzeMarketData({
      snapshot,
      preferences: user.preferences || {},
      strategy: ctx.strategy,
      intentParams: intent.params,
    });

    // Persist to the unified analysis history (source=assistant).
    const saved = await Analysis.create({
      userId: user._id,
      symbol: analysis.symbol,
      market: analysis.market,
      timeframe: analysis.timeframe,
      currentPrice: analysis.currentPrice,
      technicalAnalysis: analysis.technicalAnalysis,
      decision: analysis.decision,
      confidenceScore: analysis.confidenceScore,
      tradePlan: analysis.tradePlan,
      report: analysis.report,
      status: 'completed',
      aiProvider: 'assistant',
      source: 'assistant',
      dataSource,
      isRealData,
    });

    // Consume a credit ONLY on success.
    await user.useScan();
    await logScan('assistant_analysis', {
      message: `Assistant analysis: ${analysis.symbol} ${analysis.decision}`,
      userId: user._id,
      metadata: { analysisId: saved._id, source: dataSource, isRealData },
    });

    assistantText = analysisToText(analysis, snapshot);
    analysisIds = [saved._id];

    // show_risks: emphasize risks in the reply.
    if (intent.action === 'show_risks') {
      const risks = (analysis.report?.risks || []).slice(0, 5);
      assistantText += `\n\nRISQUES DÉTECTÉS :\n${risks.length ? risks.map((r) => `- ${r}`).join('\n') : 'Aucun risque majeur détecté.'}`;
    }
  } else if (intent.action === 'compare') {
    // ---- Compare two symbols ----
    const symbols = ctx.symbols.slice(0, 2);
    if (symbols.length < 2) {
      throw ApiError.badRequest('Comparez deux marchés : dites par exemple "Compare EURUSD et GBPUSD".');
    }
    const timeframe = ctx.timeframe || user.preferences?.favoriteTimeframes?.[0] || 'H1';

    // Compare should also respect credits when it runs analyses.
    if (!user.canScan()) {
      throw ApiError.forbidden('Plus de crédits de scan ce mois-ci.');
    }

    const results = [];
    for (const symbol of symbols) {
      const snapshot = await requireSnapshot(symbol, timeframe);
      const { analysis } = await analyzeMarketData({
        snapshot,
        preferences: user.preferences || {},
        strategy: ctx.strategy,
        intentParams: intent.params,
      });
      const saved = await Analysis.create({
        userId: user._id,
        symbol: analysis.symbol,
        market: analysis.market,
        timeframe: analysis.timeframe,
        currentPrice: analysis.currentPrice,
        technicalAnalysis: analysis.technicalAnalysis,
        decision: analysis.decision,
        confidenceScore: analysis.confidenceScore,
        tradePlan: analysis.tradePlan,
        report: analysis.report,
        status: 'completed',
        aiProvider: 'assistant',
        source: 'assistant',
        dataSource: snapshot.source,
        isRealData: snapshot.isRealData,
      });
      results.push({ analysis, snapshot });
      analysisIds.push(saved._id);
      dataSource = dataSource || snapshot.source;
      isRealData = isRealData === null ? snapshot.isRealData : isRealData && snapshot.isRealData;
    }
    await user.useScan(); // one credit per compare (not per symbol)

    const [a, b] = results;
    const decideBetter = (x, y) =>
      x.analysis.confidenceScore === y.analysis.confidenceScore
        ? 'Ex æquo — aucune n\'est clairement plus fiable.'
        : `${x.analysis.confidenceScore > y.analysis.confidenceScore ? x.snapshot.symbol : y.snapshot.symbol} est la plus fiable (confiance ${Math.max(x.analysis.confidenceScore, y.analysis.confidenceScore)}% vs ${Math.min(x.analysis.confidenceScore, y.analysis.confidenceScore)}%).`;

    assistantText = [
      `Comparaison ${a.snapshot.symbol} vs ${b.snapshot.symbol} (${timeframe}) :`,
      '',
      `• ${a.snapshot.symbol} → ${decisionLabel(a.analysis.decision)} (confiance ${a.analysis.confidenceScore}%) — ${(a.analysis.report?.summary || '').slice(0, 160)}`,
      `• ${b.snapshot.symbol} → ${decisionLabel(b.analysis.decision)} (confiance ${b.analysis.confidenceScore}%) — ${(b.analysis.report?.summary || '').slice(0, 160)}`,
      '',
      decideBetter(a, b),
    ].join('\n');
  } else if (intent.action === 'best_markets' || intent.action === 'trending') {
    // ---- Universe-wide scan (no credit) ----
    const universe = SYMBOL_CATALOG;
    const quotes = [];
    for (const entry of universe) {
      try {
        const q = await getQuote(entry);
        if (q) quotes.push(q);
      } catch {
        /* skip symbol on provider error */
      }
    }

    // Best movers in the last lookback (mock provides candles; use quote only for breadth).
    // Rank by absolute % change vs the catalog base to pick "best markets".
    const ranked = quotes
      .map((q) => {
        const entry = universe.find((u) => u.symbol === q.symbol);
        const base = entry?.base || q.price;
        const changePct = ((q.price - base) / base) * 100;
        return { symbol: q.symbol, price: q.price, changePct, market: entry?.market };
      })
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 6);

    const isTrending = intent.action === 'trending';
    const movers = ranked
      .slice(0, isTrending ? 4 : 6)
      .map((m) => `• ${m.symbol} : ${m.price} (${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}%)`)
      .join('\n');

    const synthetic = universe.filter((u) => u.market === 'synthetic');
    const syntheticLine = synthetic.length
      ? `\n\nIndices synthétiques Deriv suivis : ${synthetic.map((s) => s.symbol).join(', ')}.`
      : '';

    assistantText =
      (isTrending
        ? `Marchés les plus en tendance en ce moment (mouvements récents) :\n${movers}`
        : `Meilleurs marchés du moment (classés par mouvement) :\n${movers}`) + syntheticLine;
  } else {
    // ---- Coach / teach / chitchat / explain — mentor reply (free) ----
    const { reply } = await mentorReply({
      messages: [
        ...history
          .slice(-10)
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ],
      level: user.preferences?.level,
    });
    assistantText = reply;
  }

  // 3. Persist both turns.
  const userTurn = {
    role: 'user',
    content: text,
    action: intent.action,
    context: { symbols: ctx.symbols, timeframe: ctx.timeframe, strategy: ctx.strategy },
  };
  const assistantTurn = {
    role: 'assistant',
    content: assistantText,
    action: intent.action,
    analysisIds,
    analysisId: analysisIds[0] || null,
    dataSource,
    isRealData,
  };
  conv.messages.push(userTurn, assistantTurn);
  if (conv.title === 'Nouvelle conversation') conv.title = text.length > 50 ? text.slice(0, 47) + '…' : text;
  conv.lastMessageAt = new Date();
  await conv.save();

  return sendSuccess(res, {
    message: 'Done.',
    data: {
      reply: assistantText,
      conversationId: conv._id,
      action: intent.action,
      analysisId: analysisIds[0] || null,
      analysisIds,
      dataSource,
      isRealData,
      scansRemaining: user.subscription.scansRemaining,
    },
  });
});
