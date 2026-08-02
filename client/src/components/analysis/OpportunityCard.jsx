import { TrendingUp, TrendingDown, Clock, Target, Shield } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { formatPrice, marketLabel } from '../../utils/format.js';

const RISK_TONE = { low: 'green', medium: 'yellow', high: 'red' };
const SETUP_LABEL = {
  'order-block': 'Order Block',
  'fair-value-gap': 'Fair Value Gap',
  'breaker-block': 'Breaker Block',
  'liquidity-sweep': 'Liquidity Sweep',
  'trend-continuation': 'Trend Continuation',
  reversal: 'Reversal',
};

/** Compact time-remaining string from an expiry date. */
const timeLeft = (expiresAt) => {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt) - new Date();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 1 ? `${h}h ${m}m` : `${m}m`;
};

/** A single opportunity tile shown on the Opportunity Scanner board. */
export default function OpportunityCard({ opportunity, onClick }) {
  const o = opportunity;
  const isBuy = o.direction === 'BUY';
  const DirIcon = isBuy ? TrendingUp : TrendingDown;
  const remaining = timeLeft(o.expiresAt);
  const expiringSoon = remaining !== 'expired' && (new Date(o.expiresAt) - new Date()) < 3600000;

  return (
    <button
      onClick={() => onClick?.(o)}
      className="card group w-full p-5 text-left transition hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{o.symbol}</span>
            <Badge tone="purple">{marketLabel(o.market)}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{o.timeframe} · {SETUP_LABEL[o.setupType] || o.setupType}</p>
        </div>
        <div
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-bold text-white ${
            isBuy ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          <DirIcon className="h-4 w-4" /> {o.direction}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Confidence</span>
          <span className="font-semibold">{o.confidenceScore}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${o.confidenceScore >= 80 ? 'bg-green-500' : o.confidenceScore >= 70 ? 'bg-blue-500' : 'bg-yellow-500'}`}
            style={{ width: `${o.confidenceScore}%` }}
          />
        </div>
      </div>

      {/* Levels */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
          <p className="text-[10px] uppercase text-gray-400">Entry</p>
          <p className="font-mono text-xs">{formatPrice(o.entry)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
          <p className="text-[10px] uppercase text-gray-400">SL</p>
          <p className="font-mono text-xs">{formatPrice(o.stopLoss)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
          <p className="text-[10px] uppercase text-gray-400">TP</p>
          <p className="font-mono text-xs">{formatPrice(o.takeProfit2)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone={RISK_TONE[o.riskLevel]}>
            <Shield className="h-3 w-3" /> {o.riskLevel} risk
          </Badge>
          {o.riskRewardRatio && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Target className="h-3 w-3" /> {o.riskRewardRatio}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1 text-xs ${expiringSoon ? 'text-red-500' : 'text-gray-400'}`}>
          <Clock className="h-3 w-3" /> {remaining}
        </span>
      </div>
    </button>
  );
}
