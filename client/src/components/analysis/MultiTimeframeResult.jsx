import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Layers, FileText,
} from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { marketLabel, formatPrice, formatDateTime, decisionMeta } from '../../utils/format.js';

const TREND_META = {
  bullish: { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500', label: 'Bullish', tone: 'green' },
  bearish: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500', label: 'Bearish', tone: 'red' },
  ranging: { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-400', label: 'Ranging', tone: 'gray' },
};

const ALIGNMENT_META = {
  aligned: { tone: 'green', label: 'Aligned', icon: CheckCircle2, text: 'All timeframes agree' },
  partial: { tone: 'yellow', label: 'Partial', icon: Layers, text: 'Mostly aligned' },
  conflicted: { tone: 'red', label: 'Conflicted', icon: AlertTriangle, text: 'Timeframes disagree' },
};

const biasTone = (bias) => (bias === 'BUY' ? 'green' : bias === 'SELL' ? 'red' : 'gray');

/**
 * Renders a completed multi-timeframe analysis: header, alignment/confluence
 * banner, per-timeframe grid, conflicts, and the top-down recommendation.
 * Reused by the MultiTimeframe scanner (post-scan) and history detail.
 */
export default function MultiTimeframeResult({ analysis }) {
  if (!analysis) return null;

  const align = ALIGNMENT_META[analysis.alignmentStatus] || ALIGNMENT_META.partial;
  const AlignIcon = align.icon;
  const rec = analysis.recommendation || {};
  const recMeta = decisionMeta(rec.decision);

  const bannerBg =
    analysis.alignmentStatus === 'aligned'
      ? 'from-green-500 to-emerald-600'
      : analysis.alignmentStatus === 'conflicted'
      ? 'from-red-500 to-rose-600'
      : 'from-amber-500 to-orange-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{analysis.symbol}</h2>
            <Badge tone="purple">{marketLabel(analysis.market)}</Badge>
            <Badge tone="gray">
              <Layers className="h-3.5 w-3.5" /> {analysis.timeframes?.length || 0} timeframes
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {analysis.broker && analysis.broker !== 'Unknown' ? `${analysis.broker} · ` : ''}
            Price: {formatPrice(analysis.currentPrice)}
            {analysis.createdAt ? ` · ${formatDateTime(analysis.createdAt)}` : ''}
          </p>
        </div>
      </div>

      {/* Alignment / confluence banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bannerBg} p-6 text-white shadow-xl`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Timeframe Alignment</p>
            <div className="mt-1 flex items-center gap-2">
              <AlignIcon className="h-8 w-8" />
              <span className="text-4xl font-extrabold tracking-tight">{align.label}</span>
            </div>
            <p className="mt-1 text-sm text-white/80">{align.text}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white/80">Confluence</p>
            <p className="text-4xl font-extrabold">{analysis.confluenceScore}%</p>
            <p className="mt-1 text-sm text-white/80">Dominant bias: {analysis.dominantBias}</p>
          </div>
        </div>
        <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/25">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${analysis.confluenceScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Per-timeframe grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(analysis.timeframes || []).map((tf) => {
          const tm = TREND_META[tf.trend] || TREND_META.ranging;
          const TIcon = tm.icon;
          return (
            <div key={tf.timeframe} className="card overflow-hidden p-0">
              {tf.imageUrl && (
                <img
                  src={tf.imageUrl}
                  alt={`${analysis.symbol} ${tf.timeframe}`}
                  className="h-36 w-full bg-gray-100 object-cover dark:bg-gray-900"
                />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{tf.timeframe}</span>
                  <Badge tone={tm.tone}>
                    <TIcon className="h-3.5 w-3.5" /> {tm.label}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{tf.marketStructure || '—'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Bias</span>
                  <Badge tone={biasTone(tf.bias)}>{tf.bias}</Badge>
                </div>
                {tf.keyLevels?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {tf.keyLevels.slice(0, 3).map((lvl, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{lvl.label}</span>
                        {lvl.level != null && lvl.level !== '' && (
                          <span className="font-mono text-gray-600 dark:text-gray-400">
                            {typeof lvl.level === 'number' ? formatPrice(lvl.level) : lvl.level}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Conflicts */}
      {analysis.conflicts?.length > 0 && (
        <div className="card border-l-4 border-l-red-500 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-red-600">
            <AlertTriangle className="h-5 w-5" /> Timeframe Conflicts
          </h3>
          <div className="mt-3 space-y-2">
            {analysis.conflicts.map((c, i) => (
              <div key={i} className="rounded-lg bg-red-50 px-3 py-2 text-sm dark:bg-red-950/30">
                <span className="font-medium">{c.tf1} vs {c.tf2}:</span> {c.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Top-Down Recommendation</h3>
          <Badge tone={recMeta.tone}>{recMeta.label}</Badge>
        </div>
        {rec.decision === 'WAIT' ? (
          <div className="mt-4">
            <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Zone à attendre</span>
              <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300">{formatPrice(rec.entry)}</span>
            </div>
            {rec.waitReason && (
              <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{rec.waitReason}</p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Entry', rec.entry],
              ['Stop Loss', rec.stopLoss],
              ['TP1', rec.takeProfit1],
              ['TP2', rec.takeProfit2],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="mt-1 font-mono text-sm">{formatPrice(val)}</p>
              </div>
            ))}
            {rec.riskRewardRatio && (
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <p className="text-xs font-medium text-gray-500">R:R</p>
                <p className="mt-1 font-mono text-sm">{rec.riskRewardRatio}</p>
              </div>
            )}
          </div>
        )}
        {rec.reasoning && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{rec.reasoning}</p>}
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="card p-6">
          <h3 className="font-semibold">Summary</h3>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{analysis.summary}</p>
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        AI-generated analysis for educational purposes only. Not financial advice.
      </p>
    </div>
  );
}
