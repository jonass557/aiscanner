import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, MinusCircle } from 'lucide-react';
import { decisionMeta } from '../../utils/format.js';

/**
 * Big, unambiguous decision banner with confidence. New scans are always
 * directional (BUY/SELL); the WAIT/NO_TRADE branches only render for legacy
 * records still stored in history.
 */
export default function DecisionCard({ decision, confidenceScore, confidenceLabel }) {
  const meta = decisionMeta(decision);
  const Icon =
    decision === 'BUY' ? TrendingUp : decision === 'SELL' ? TrendingDown : decision === 'WAIT' ? Clock : MinusCircle;

  const bg =
    decision === 'BUY'
      ? 'from-green-500 to-emerald-600'
      : decision === 'SELL'
      ? 'from-red-500 to-rose-600'
      : decision === 'WAIT'
      ? 'from-amber-500 to-yellow-600'
      : 'from-gray-500 to-gray-600';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-6 text-white shadow-xl`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">AI Decision</p>
          <div className="mt-1 flex items-center gap-2">
            <Icon className="h-8 w-8" />
            <span className="text-4xl font-extrabold tracking-tight">{meta.label}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-white/80">Confiance</p>
          <p className="text-4xl font-extrabold">{confidenceScore}%</p>
          {confidenceLabel && (
            <p className="text-sm font-medium text-white/80">{confidenceLabel}</p>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/25">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: 0 }}
          animate={{ width: `${confidenceScore}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {decision === 'WAIT' && (
        <p className="relative mt-3 text-sm text-white/90">
          Pas d'entrée immédiate — attendre que le prix atteigne la zone optimale (voir le plan ci-dessous).
        </p>
      )}
    </motion.div>
  );
}
