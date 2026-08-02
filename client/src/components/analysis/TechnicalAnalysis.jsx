import { formatPrice } from '../../utils/format.js';

// Human labels for each detected-element group in the technical analysis.
const GROUPS = [
  { key: 'bos', label: 'Break of Structure (BOS)' },
  { key: 'choch', label: 'Change of Character (CHoCH)' },
  { key: 'mss', label: 'Market Structure Shift (MSS)' },
  { key: 'orderBlocks', label: 'Order Blocks' },
  { key: 'fairValueGaps', label: 'Fair Value Gaps' },
  { key: 'breakerBlocks', label: 'Breaker Blocks' },
  { key: 'mitigationBlocks', label: 'Mitigation Blocks' },
  { key: 'liquidityZones', label: 'Liquidity Zones' },
  { key: 'equalHighs', label: 'Equal Highs' },
  { key: 'equalLows', label: 'Equal Lows' },
  { key: 'supportLevels', label: 'Support' },
  { key: 'resistanceLevels', label: 'Resistance' },
  { key: 'trendlines', label: 'Trendlines' },
  { key: 'consolidations', label: 'Consolidations' },
  { key: 'breakouts', label: 'Breakouts' },
  { key: 'fakeBreakouts', label: 'Fake Breakouts' },
  { key: 'premiumZones', label: 'Premium Zones' },
  { key: 'discountZones', label: 'Discount Zones' },
];

/** Renders the full SMC + classic technical breakdown, hiding empty groups. */
export default function TechnicalAnalysis({ ta }) {
  if (!ta) return null;
  const active = GROUPS.filter((g) => Array.isArray(ta[g.key]) && ta[g.key].length > 0);

  return (
    <div className="card p-6">
      <h3 className="font-semibold">Technical Analysis</h3>

      {/* Narrative reads */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Market Structure', ta.marketStructure],
          ['Momentum', ta.momentum],
          ['Volatility', ta.volatility],
        ].map(([label, val]) => (
          <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-sm">{val || '—'}</p>
          </div>
        ))}
      </div>

      {/* Detected element groups */}
      {active.length > 0 ? (
        <div className="mt-6 space-y-4">
          {active.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-sm font-semibold text-brand-600">{g.label}</p>
              <div className="space-y-1.5">
                {ta[g.key].map((el, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                  >
                    <div>
                      <span className="font-medium">{el.label || g.label}</span>
                      {el.note && <p className="text-xs text-gray-500">{el.note}</p>}
                    </div>
                    {el.level != null && el.level !== '' && (
                      <span className="shrink-0 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {typeof el.level === 'number' ? formatPrice(el.level) : el.level}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-gray-500">No specific SMC elements were detected in this chart.</p>
      )}
    </div>
  );
}
