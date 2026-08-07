import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

/**
 * Chart image with a computer-vision annotation overlay.
 *
 * Annotations come from the backend overlay builder in NORMALIZED coordinates
 * (0-1), so we render them at whatever size the image is displayed: we measure
 * the rendered <img> and multiply. Each annotation names a `layer`, which the
 * user can toggle on/off in the side panel. Colors come from the annotation
 * itself (backend defaults), so the overlay stays consistent with the report.
 *
 * Shapes:
 *  - rect / zone → a box from {bbox:{x,y,w,h}} (zone = translucent fill)
 *  - line        → a segment from {points:[{x,y},{x,y}]} (used for price levels)
 *  - label       → a marker + text anchored at the bbox top-left
 */

// Pretty labels for the toggle panel; falls back to the raw layer id.
const LAYER_LABELS = {
  orderBlocks: 'Order Blocks',
  fvg: 'Fair Value Gaps',
  liquidity: 'Liquidity',
  premiumDiscount: 'Premium / Discount',
  supportResistance: 'Support / Resistance',
  bos: 'BOS / MSS',
  choch: 'CHoCH',
  structure: 'Structure',
  patterns: 'Patterns',
  entry: 'Entry',
  stopLoss: 'Stop Loss',
  takeProfit: 'Take Profit',
  riskZone: 'Risk Zones',
};

export default function AnnotatedChart({ imageUrl, annotations = [], symbol = 'chart' }) {
  const imgRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Which layers are present, in a stable order, and their color (first seen).
  const layers = useMemo(() => {
    const map = new Map();
    for (const a of annotations) {
      if (!a?.layer) continue;
      if (!map.has(a.layer)) map.set(a.layer, a.color || '#888888');
    }
    return [...map.entries()].map(([id, color]) => ({ id, color, label: LAYER_LABELS[id] || id }));
  }, [annotations]);

  const [enabled, setEnabled] = useState({}); // layerId -> bool
  // Default every present layer to visible when the annotation set changes.
  useEffect(() => {
    setEnabled((prev) => {
      const next = { ...prev };
      for (const l of layers) if (next[l.id] === undefined) next[l.id] = true;
      return next;
    });
  }, [layers]);

  // Measure the rendered image so we can scale normalized coords to pixels.
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return undefined;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl]);

  const visible = annotations.filter((a) => enabled[a.layer]);
  const { w, h } = dims;

  const toggle = (id) => setEnabled((e) => ({ ...e, [id]: !e[id] }));
  const allOn = layers.length > 0 && layers.every((l) => enabled[l.id]);
  const setAll = (val) => setEnabled(Object.fromEntries(layers.map((l) => [l.id, val])));

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Chart + overlay */}
      <div className="lg:col-span-3">
        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <img
            ref={imgRef}
            src={imageUrl}
            alt={`${symbol} chart`}
            className="block w-full"
            onLoad={() => imgRef.current && setDims({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight })}
          />
          {w > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={w}
              height={h}
              viewBox={`0 0 ${w} ${h}`}
            >
              {visible.map((a, i) => (
                <Annotation key={i} a={a} w={w} h={h} />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Layer panel */}
      <div className="lg:col-span-1">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4" /> Couches
            </h4>
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline"
              onClick={() => setAll(!allOn)}
            >
              {allOn ? 'Tout masquer' : 'Tout afficher'}
            </button>
          </div>
          {layers.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune annotation détectée.</p>
          ) : (
            <ul className="space-y-1.5">
              {layers.map((l) => {
                const on = enabled[l.id];
                const count = annotations.filter((a) => a.layer === l.id).length;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800/50 ${on ? '' : 'opacity-40'}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: l.color }} />
                      <span className="flex-1 truncate">{l.label}</span>
                      <span className="text-xs text-gray-400">{count}</span>
                      {on ? <Eye className="h-3.5 w-3.5 text-gray-500" /> : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-tight text-gray-400">
            Coordonnées normalisées reconstruites par le moteur de vision. Cliquez une couche pour l'afficher/masquer.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Render a single annotation as SVG in pixel space. */
function Annotation({ a, w, h }) {
  const color = a.color || '#888888';
  const label = a.confidence != null ? `${a.label} · ${a.confidence}%` : a.label;

  if (a.shape === 'line' && a.coords?.points?.length >= 2) {
    const [p1, p2] = a.coords.points;
    const x1 = p1.x * w;
    const y1 = p1.y * h;
    const x2 = p2.x * w;
    const y2 = p2.y * h;
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray="6 4" />
        {a.label && (
          <text x={Math.min(x1, x2) + 4} y={y1 - 4} fill={color} fontSize={11} fontWeight="600">
            {label}
          </text>
        )}
      </g>
    );
  }

  if (a.coords?.bbox) {
    const { x, y, w: bw, h: bh } = a.coords.bbox;
    const px = x * w;
    const py = y * h;
    const pw = Math.max(2, bw * w);
    const ph = Math.max(2, bh * h);
    const isZone = a.shape === 'zone';
    return (
      <g>
        <rect
          x={px}
          y={py}
          width={pw}
          height={ph}
          fill={isZone ? color : 'none'}
          fillOpacity={isZone ? 0.18 : 0}
          stroke={color}
          strokeWidth={2}
          rx={3}
        />
        {a.label && (
          <text x={px + 4} y={py + 13} fill={color} fontSize={11} fontWeight="600">
            {label}
          </text>
        )}
      </g>
    );
  }

  return null;
}
