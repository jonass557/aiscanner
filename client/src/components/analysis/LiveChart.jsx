import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, RefreshCw, Zap } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { marketApi } from '../../services/endpoints.js';
import { formatPrice } from '../../utils/format.js';

/**
 * Real-time candlestick chart for the detected pair + timeframe.
 *
 * After a scan detects the symbol/timeframe, the backend returns a live market
 * snapshot (candles + quote). We render it as pure SVG candlesticks (recharts
 * has no candlestick primitive) and overlay the trade-plan levels — entry, stop
 * loss and take-profits — as horizontal price lines, so the user sees WHERE to
 * act on the live price, not just on the screenshot.
 *
 * The candles refresh on an interval (default 15s) via GET /market/snapshot, so
 * the chart stays "live". `isRealData` drives an honesty badge: simulated data
 * (no public feed, e.g. Deriv synthetics) is clearly flagged.
 */

const REFRESH_MS = 15000;
const PADDING = { top: 12, right: 64, bottom: 22, left: 8 };
const HEIGHT = 340;

// Trade-plan level lines — colors mirror the annotation layer catalog.
const LEVELS = [
  { key: 'entry', label: 'Entrée', color: '#2563eb' },
  { key: 'stopLoss', label: 'SL', color: '#dc2626' },
  { key: 'takeProfit1', label: 'TP1', color: '#16a34a' },
  { key: 'takeProfit2', label: 'TP2', color: '#16a34a' },
  { key: 'takeProfit3', label: 'TP3', color: '#16a34a' },
];

export default function LiveChart({ market: initialMarket, symbol, timeframe, tradePlan }) {
  const [market, setMarket] = useState(initialMarket || null);
  const [refreshing, setRefreshing] = useState(false);
  const [width, setWidth] = useState(800);
  const wrapRef = useRef(null);

  const liveSymbol = market?.symbol || symbol;
  const liveTimeframe = market?.timeframe || timeframe;

  // Keep local state in sync if the parent hands us a new snapshot.
  useEffect(() => {
    if (initialMarket) setMarket(initialMarket);
  }, [initialMarket]);

  // Measure width for a responsive SVG.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth || 800);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Poll for fresh candles. Skips silently on error (keeps last good data).
  useEffect(() => {
    if (!liveSymbol) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        setRefreshing(true);
        const { data } = await marketApi.snapshot(liveSymbol, liveTimeframe);
        if (!cancelled && data?.data?.market?.candles?.length) {
          setMarket(data.data.market);
        }
      } catch {
        /* keep last snapshot; a transient failure must not blank the chart */
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [liveSymbol, liveTimeframe]);

  const candles = useMemo(
    () => (Array.isArray(market?.candles) ? market.candles : []),
    [market]
  );

  // Price → y mapping over the visible candles + any plan levels, so lines never
  // fall off-chart.
  const scale = useMemo(() => {
    if (!candles.length) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low != null) min = Math.min(min, c.low);
      if (c.high != null) max = Math.max(max, c.high);
    }
    for (const lv of LEVELS) {
      const v = tradePlan?.[lv.key];
      if (v != null) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    const pad = (max - min) * 0.06;
    min -= pad;
    max += pad;
    const plotH = HEIGHT - PADDING.top - PADDING.bottom;
    const y = (price) => PADDING.top + ((max - price) / (max - min)) * plotH;
    return { min, max, y };
  }, [candles, tradePlan]);

  const plotW = width - PADDING.left - PADDING.right;
  const step = candles.length ? plotW / candles.length : 0;
  const candleW = Math.max(1, Math.min(14, step * 0.6));

  const isReal = market?.isRealData;
  const lastPrice = market?.quote?.price ?? candles[candles.length - 1]?.close ?? null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-500" />
          <h4 className="text-sm font-semibold">
            {liveSymbol || 'Marché'} · {liveTimeframe || '—'}
          </h4>
          {lastPrice != null && (
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
              {formatPrice(lastPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          {isReal ? (
            <Badge tone="green">
              <Zap className="h-3 w-3" /> Live · {market?.source || 'marché'}
            </Badge>
          ) : (
            <Badge tone="yellow">Simulé</Badge>
          )}
        </div>
      </div>

      <div ref={wrapRef} className="w-full overflow-hidden">
        {!candles.length || !scale ? (
          <div className="flex h-[340px] items-center justify-center text-sm text-gray-400">
            {liveSymbol
              ? 'Chargement des données de marché…'
              : 'Paire non reconnue — pas de flux temps réel pour cet actif.'}
          </div>
        ) : (
          <svg width={width} height={HEIGHT} className="block">
            {/* Trade-plan level lines. */}
            {LEVELS.map((lv) => {
              const v = tradePlan?.[lv.key];
              if (v == null) return null;
              const y = scale.y(v);
              return (
                <g key={lv.key}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={width - PADDING.right}
                    y2={y}
                    stroke={lv.color}
                    strokeWidth={1.25}
                    strokeDasharray="5 4"
                  />
                  <rect
                    x={width - PADDING.right + 2}
                    y={y - 8}
                    width={PADDING.right - 4}
                    height={16}
                    rx={3}
                    fill={lv.color}
                  />
                  <text
                    x={width - PADDING.right + 6}
                    y={y + 3}
                    fill="#fff"
                    fontSize={9}
                    fontWeight="600"
                  >
                    {lv.label} {formatPrice(v)}
                  </text>
                </g>
              );
            })}

            {/* Candlesticks. */}
            {candles.map((c, i) => {
              if (c.open == null || c.close == null || c.high == null || c.low == null) {
                return null;
              }
              const cx = PADDING.left + i * step + step / 2;
              const up = c.close >= c.open;
              const color = up ? '#16a34a' : '#dc2626';
              const yHigh = scale.y(c.high);
              const yLow = scale.y(c.low);
              const yOpen = scale.y(c.open);
              const yClose = scale.y(c.close);
              const bodyTop = Math.min(yOpen, yClose);
              const bodyH = Math.max(1, Math.abs(yClose - yOpen));
              return (
                <g key={i}>
                  <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
                  <rect
                    x={cx - candleW / 2}
                    y={bodyTop}
                    width={candleW}
                    height={bodyH}
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {market?.note && (
        <p className="mt-2 text-[11px] leading-tight text-gray-400">{market.note}</p>
      )}
    </div>
  );
}
