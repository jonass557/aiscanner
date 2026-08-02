import { formatPrice } from '../../utils/format.js';

/** Trade plan table: entry, SL, three TPs, R/R, duration, probability. */
export default function TradePlanCard({ tradePlan, decision }) {
  if (decision === 'NO_TRADE' || !tradePlan) {
    return (
      <div className="card p-6">
        <h3 className="font-semibold">Trade Plan</h3>
        <p className="mt-3 text-sm text-gray-500">
          No trade plan — the AI did not find a high-probability setup in this chart.
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
    </div>
  );
}
