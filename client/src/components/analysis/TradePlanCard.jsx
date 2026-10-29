import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { formatPrice } from '../../utils/format.js';

/**
 * Trade plan table: entry, SL, three TPs, R/R, duration, probability.
 * New scans are always directional with a complete plan. The legacy WAIT /
 * NO_TRADE branches below only trigger for old records kept in history.
 */
export default function TradePlanCard({ tradePlan, decision, symbol }) {
  if (!tradePlan || decision === 'NO_TRADE') {
    return (
      <div className="card p-6">
        <h3 className="font-semibold">Trade Plan</h3>
        <p className="mt-3 text-sm text-gray-500">
          No trade plan — the AI did not find a high-probability setup in this chart.
        </p>
      </div>
    );
  }

  // Legacy WAIT records: no live entry — show the SUGGESTED zone and the reason.
  if (decision === 'WAIT') {
    return (
      <div className="card p-6">
        <h3 className="font-semibold">Plan — Attendre</h3>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Zone à attendre</span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatPrice(tradePlan.entry)}</span>
        </div>
        {tradePlan.waitReason && (
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{tradePlan.waitReason}</p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Stop et objectifs seront définis une fois le prix arrivé sur la zone et une réaction confirmée.
        </p>
      </div>
    );
  }

  const rows = [
    { label: 'Entry', value: formatPrice(tradePlan.entry), accent: 'text-brand-600' },
    { label: 'Stop Loss', value: formatPrice(tradePlan.stopLoss), accent: 'text-red-500' },
    { label: 'Take Profit 1', value: formatPrice(tradePlan.takeProfit1), accent: 'text-green-500' },
    { label: 'Take Profit 2', value: formatPrice(tradePlan.takeProfit2), accent: 'text-green-500' },
    { label: 'Take Profit 3', value: formatPrice(tradePlan.takeProfit3), accent: 'text-green-500' },
  ];

  return (
    <div className="card p-6">
      <h3 className="font-semibold">Trade Plan</h3>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
            <span className="text-sm text-gray-500">{r.label}</span>
            <span className={`font-semibold ${r.accent}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Risk/Reward', tradePlan.riskRewardRatio || '—'],
          ['Duration', tradePlan.estimatedDuration || '—'],
          ['Probability', tradePlan.estimatedProbability != null ? `${tradePlan.estimatedProbability}%` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800/50">
            <p className="text-xs text-gray-500">{k}</p>
            <p className="mt-1 text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {tradePlan.entry != null && tradePlan.stopLoss != null && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Link
            to={`/dashboard/calculator?symbol=${encodeURIComponent(symbol || '')}&entry=${tradePlan.entry}&sl=${tradePlan.stopLoss}&tp=${tradePlan.takeProfit1 || tradePlan.takeProfit2 || ''}&direction=${decision === 'SELL' ? 'SELL' : 'BUY'}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:hover:bg-brand-950/70 dark:text-brand-300 text-xs font-bold transition shadow-sm"
          >
            <Calculator className="h-4 w-4" />
            Calculer la taille de position
          </Link>
        </div>
      )}
    </div>
  );
}
