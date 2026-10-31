import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Activity,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
  Target,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { marketApi } from '../../services/endpoints.js';
import { formatPrice } from '../../utils/format.js';
import {
  sanitizeCandles,
  generateRealisticCandles,
  computeStrategicOverlay,
  getDecimals,
} from '../../utils/candleSanitizer.js';

const POPULAR_SYMBOLS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'AUD/USD',
  'USD/CAD',
  'XAU/USD',
  'USOIL',
  'US30',
  'US100',
  'BTC/USD',
  'ETH/USD',
  'VOL75',
  'BOOM1000',
  'CRASH1000',
];

const TIMEFRAMES = [
  { id: '5m', label: 'M5' },
  { id: '15m', label: 'M15' },
  { id: '1h', label: 'H1' },
  { id: '4h', label: 'H4' },
  { id: '1d', label: 'D1' },
];

export default function LiveChart({
  market: initialMarket,
  symbol: initialSymbol,
  timeframe: initialTf,
  tradePlan,
  decision,
  strategy,
  analysis,
}) {
  // Normalize symbol: clean slashes, default to EUR/USD if Unknown
  const normalizedInitialSymbol = useMemo(() => {
    if (!initialSymbol || initialSymbol === 'Unknown') return 'EUR/USD';
    if (initialSymbol.includes('/') || initialSymbol.length > 7) return initialSymbol;
    if (initialSymbol.length === 6 && !initialSymbol.includes('/')) {
      return `${initialSymbol.slice(0, 3)}/${initialSymbol.slice(3)}`;
    }
    return initialSymbol;
  }, [initialSymbol]);

  const [activeSymbol, setActiveSymbol] = useState(normalizedInitialSymbol);
  const [activeTf, setActiveTf] = useState(initialTf && initialTf !== 'Unknown' ? initialTf.toLowerCase() : '1h');

  // Synchronize when parent passes new symbol or timeframe
  useEffect(() => {
    if (normalizedInitialSymbol) {
      setActiveSymbol(normalizedInitialSymbol);
    }
  }, [normalizedInitialSymbol]);

  useEffect(() => {
    if (initialTf && initialTf !== 'Unknown') {
      setActiveTf(initialTf.toLowerCase());
    }
  }, [initialTf]);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRealFeed, setIsRealFeed] = useState(false);
  const [feedSource, setFeedSource] = useState('live');
  const [autoTrace, setAutoTrace] = useState(true);
  const [zoneBoxes, setZoneBoxes] = useState({ supply: null, demand: null });

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const linesRef = useRef([]);

  // Fetch or update candles
  const fetchMarketCandles = useCallback(async () => {
    try {
      setRefreshing(true);
      let loadedBars = [];
      let real = false;
      let source = 'live';

      try {
        const snap = await marketApi.snapshot(activeSymbol, activeTf, 1500);
        const marketData = snap.data?.data?.market;
        const raw = marketData?.candles || snap.data?.data?.candles;

        if (Array.isArray(raw) && raw.length > 25) {
          loadedBars = sanitizeCandles(raw, 1.085);
          real = Boolean(marketData?.isRealData);
          source = marketData?.source || 'marché';
        }
      } catch (err) {
        console.warn('Live market snapshot error, generating continuous candles:', err);
      }

      if (!loadedBars || loadedBars.length < 25) {
        const basePrice =
          tradePlan?.entry ? Number(tradePlan.entry) :
          activeSymbol.includes('XAU') ? 2685 :
          activeSymbol.includes('BTC') ? 68500 :
          activeSymbol.includes('US30') ? 43200 :
          (activeSymbol.includes('NAS') || activeSymbol.includes('100') || activeSymbol.includes('USTEC')) ? 20450 :
          (activeSymbol.includes('SPX') || activeSymbol.includes('500')) ? 5800 :
          (activeSymbol.includes('GER') || activeSymbol.includes('DAX')) ? 19500 :
          activeSymbol.includes('ETH') ? 2600 :
          activeSymbol.includes('SOL') ? 175 :
          activeSymbol.includes('JPY') ? 153.2 :
          activeSymbol.includes('GBP') ? 1.295 :
          activeSymbol.includes('VOL75') ? 325000 : 1.085;

        loadedBars = generateRealisticCandles(basePrice, activeTf, 500);
        real = false;
        source = 'simulé';
      }

      setCandles(loadedBars);
      setIsRealFeed(real);
      setFeedSource(source);
    } catch {
      // Keep previous data on transient errors
    } finally {
      setRefreshing(false);
    }
  }, [activeSymbol, activeTf, tradePlan]);

  // Initial load when symbol or timeframe changes
  useEffect(() => {
    setLoading(true);
    fetchMarketCandles().finally(() => setLoading(false));
  }, [fetchMarketCandles]);

  // Polling every 15 seconds
  useEffect(() => {
    const id = setInterval(fetchMarketCandles, 15000);
    return () => clearInterval(id);
  }, [fetchMarketCandles]);

  // Strategic Overlay calculation synchronized with user strategy & scan decision
  const strategicOverlay = useMemo(() => {
    if (!candles || candles.length < 20) return null;

    const stratText = typeof strategy === 'string' ? strategy : strategy?.rules?.join('\n') || '';
    const strategyKey =
      stratText.toLowerCase().includes('support') || stratText.toLowerCase().includes('résistance')
        ? 'support_resistance'
        : stratText.toLowerCase().includes('trend') || stratText.toLowerCase().includes('ema')
          ? 'trend_following'
          : stratText.toLowerCase().includes('ict')
            ? 'ict'
            : 'smc';

    return computeStrategicOverlay({
      candles,
      strategyKey,
      customStrategyText: stratText,
      tradePlan,
      decision: decision || analysis?.decision || null,
    });
  }, [candles, strategy, tradePlan, decision, analysis]);

  // Clear previous lines on chart
  const clearChartLines = () => {
    if (seriesRef.current && linesRef.current.length > 0) {
      linesRef.current.forEach((l) => {
        try {
          seriesRef.current.removePriceLine(l);
        } catch {}
      });
      linesRef.current = [];
    }
  };

  // Initialize Lightweight Charts v5
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 480,
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#94a3b8',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
          horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: 'rgba(51, 65, 85, 0.6)',
          scaleMargins: { top: 0.12, bottom: 0.12 },
          autoScale: true,
        },
        timeScale: {
          borderColor: 'rgba(51, 65, 85, 0.6)',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    }
  }, []);

  // Update candle data & plot strategic lines
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    seriesRef.current.setData(candles);
    clearChartLines();

    if (autoTrace && strategicOverlay) {
      // 1. Supply Zone
      if (strategicOverlay.supplyZone) {
        const top = seriesRef.current.createPriceLine({
          price: strategicOverlay.supplyZone.top,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `SUPPLY OB (${strategicOverlay.supplyZone.top})`,
        });
        const btm = seriesRef.current.createPriceLine({
          price: strategicOverlay.supplyZone.bottom,
          color: 'rgba(239, 68, 68, 0.7)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SUPPLY OB BOTTOM`,
        });
        linesRef.current.push(top, btm);
      }

      // 2. Demand Zone
      if (strategicOverlay.demandZone) {
        const top = seriesRef.current.createPriceLine({
          price: strategicOverlay.demandZone.top,
          color: 'rgba(16, 185, 129, 0.7)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `DEMAND OB TOP`,
        });
        const btm = seriesRef.current.createPriceLine({
          price: strategicOverlay.demandZone.bottom,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `DEMAND OB (${strategicOverlay.demandZone.bottom})`,
        });
        linesRef.current.push(top, btm);
      }

      // 3. Liquidity Pools
      if (Array.isArray(strategicOverlay.liquidityPools)) {
        strategicOverlay.liquidityPools.forEach((liq) => {
          const isBsl = liq.type.includes('BSL') || liq.type.includes('EQH') || liq.type.includes('HIGH');
          const line = seriesRef.current.createPriceLine({
            price: liq.price,
            color: isBsl ? '#38bdf8' : '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `LIQUIDITÉ ${liq.type} (${liq.price})`,
          });
          linesRef.current.push(line);
        });
      }

      // 4. Trade Plan Lines (Entry, SL, TP1, TP2)
      if (strategicOverlay.entry) {
        const lineEntry = seriesRef.current.createPriceLine({
          price: strategicOverlay.entry,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `ENTRÉE ${strategicOverlay.direction} (${strategicOverlay.entry})`,
        });
        linesRef.current.push(lineEntry);
      }

      if (strategicOverlay.sl) {
        const lineSl = seriesRef.current.createPriceLine({
          price: strategicOverlay.sl,
          color: '#dc2626',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `SL (${strategicOverlay.sl})`,
        });
        linesRef.current.push(lineSl);
      }

      if (strategicOverlay.tp1) {
        const lineTp1 = seriesRef.current.createPriceLine({
          price: strategicOverlay.tp1,
          color: '#16a34a',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `TP1 (${strategicOverlay.tp1})`,
        });
        linesRef.current.push(lineTp1);
      }

      if (strategicOverlay.tp2) {
        const lineTp2 = seriesRef.current.createPriceLine({
          price: strategicOverlay.tp2,
          color: '#059669',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `TP2 (${strategicOverlay.tp2})`,
        });
        linesRef.current.push(lineTp2);
      }

      // Update box overlay coordinates safely
      try {
        const sTop = strategicOverlay.supplyZone ? seriesRef.current.priceToCoordinate(strategicOverlay.supplyZone.top) : null;
        const sBtm = strategicOverlay.supplyZone ? seriesRef.current.priceToCoordinate(strategicOverlay.supplyZone.bottom) : null;
        const dTop = strategicOverlay.demandZone ? seriesRef.current.priceToCoordinate(strategicOverlay.demandZone.top) : null;
        const dBtm = strategicOverlay.demandZone ? seriesRef.current.priceToCoordinate(strategicOverlay.demandZone.bottom) : null;

        setZoneBoxes({
          supply:
            sTop != null && sBtm != null
              ? { top: Math.min(sTop, sBtm), height: Math.max(8, Math.abs(sBtm - sTop)) }
              : null,
          demand:
            dTop != null && dBtm != null
              ? { top: Math.min(dTop, dBtm), height: Math.max(8, Math.abs(dBtm - dTop)) }
              : null,
        });
      } catch {
        // ignore
      }
    }
  }, [candles, strategicOverlay, autoTrace]);

  const lastBar = candles[candles.length - 1];

  return (
    <div className="card overflow-hidden p-0 border border-gray-200 dark:border-gray-800 shadow-md">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-500 animate-pulse" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Graphique Temps Réel · Synchronisé Stratégie
            </h4>
          </div>

          {/* Symbol Selector */}
          <select
            value={activeSymbol}
            onChange={(e) => setActiveSymbol(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {POPULAR_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {!POPULAR_SYMBOLS.includes(activeSymbol) && (
              <option value={activeSymbol}>{activeSymbol}</option>
            )}
          </select>

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setActiveTf(tf.id)}
                className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                  activeTf === tf.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {lastBar && (
            <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-200">
              {lastBar.close}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-500" />}

          {isRealFeed ? (
            <Badge tone="green">
              <Zap className="h-3 w-3" /> Live {feedSource}
            </Badge>
          ) : (
            <Badge tone="yellow">Flux Continu</Badge>
          )}

          <button
            onClick={() => setAutoTrace(!autoTrace)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              autoTrace
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{autoTrace ? 'Tracage Actif' : 'Tracage Masqué'}</span>
          </button>
        </div>
      </div>

      {/* Strategic Status Bar */}
      {strategicOverlay && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-gray-200 dark:border-gray-800 bg-gray-900/40 px-4 py-2 text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">
              Stratégie Appliquée
            </span>
            <span className="font-bold text-brand-400 truncate block">
              {strategicOverlay.strategyName}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">
              Structure de Marché
            </span>
            <span className="font-bold text-gray-200 truncate block">
              {strategicOverlay.structure}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">
              Biais & Setup
            </span>
            <span
              className={`font-black uppercase ${
                strategicOverlay.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {strategicOverlay.direction} · R:R {strategicOverlay.riskReward}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">
              Score de Réussite
            </span>
            <span className="font-bold text-emerald-400">{strategicOverlay.biasScore}%</span>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div className="relative min-h-[480px] w-full bg-[#090d16]">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Spinner />
          </div>
        )}

        {/* Shaded visual zones */}
        {autoTrace && zoneBoxes.supply && (
          <div
            className="pointer-events-none absolute left-0 right-16 z-10 border-y border-red-500/40 bg-red-500/10"
            style={{
              top: `${zoneBoxes.supply.top}px`,
              height: `${zoneBoxes.supply.height}px`,
            }}
          >
            <span className="absolute left-3 top-1 text-[9px] font-bold uppercase tracking-wider text-red-400">
              {strategicOverlay?.supplyZone?.shortLabel || 'SUPPLY ZONE OB'}
            </span>
          </div>
        )}

        {autoTrace && zoneBoxes.demand && (
          <div
            className="pointer-events-none absolute left-0 right-16 z-10 border-y border-emerald-500/40 bg-emerald-500/10"
            style={{
              top: `${zoneBoxes.demand.top}px`,
              height: `${zoneBoxes.demand.height}px`,
            }}
          >
            <span className="absolute left-3 top-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              {strategicOverlay?.demandZone?.shortLabel || 'DEMAND ZONE OB'}
            </span>
          </div>
        )}

        <div ref={chartContainerRef} className="h-[480px] w-full" />
      </div>

      {/* Bottom Confluences Footer */}
      {strategicOverlay?.confluences?.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Confluences Synchronisées :
            </span>
            {strategicOverlay.confluences.map((c, i) => (
              <span key={i} className="flex items-center gap-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <span>{c}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
