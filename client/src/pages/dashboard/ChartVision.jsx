import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Layers,
  Sliders,
  ShieldAlert,
  Target,
  Zap,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Clock,
  Sparkles,
  Bookmark,
  ChevronDown,
  Activity,
  Compass,
  PlusCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { marketApi, strategyApi, userApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import {
  sanitizeCandles,
  generateRealisticCandles,
  computeStrategicOverlay,
  getDecimals,
} from '../../utils/candleSanitizer.js';

const CATEGORIES = [
  { id: 'forex', label: 'Forex Majeurs & Mineurs' },
  { id: 'commodities', label: 'Matières & Métaux' },
  { id: 'indices', label: 'Indices Mondiaux' },
  { id: 'crypto', label: 'Crypto-Monnaies' },
  { id: 'synthetics', label: 'Indices Synthétiques Deriv' },
];

const PAIRS_BY_CAT = {
  forex: [
    { symbol: 'EUR/USD', label: 'EUR/USD · Euro / Dollar US', base: 1.085 },
    { symbol: 'GBP/USD', label: 'GBP/USD · Livre / Dollar US', base: 1.295 },
    { symbol: 'USD/JPY', label: 'USD/JPY · Dollar / Yen Japonais', base: 153.2 },
    { symbol: 'AUD/USD', label: 'AUD/USD · Dollar Australien / USD', base: 0.658 },
    { symbol: 'USD/CAD', label: 'USD/CAD · Dollar US / Dollar Canadien', base: 1.382 },
    { symbol: 'EUR/GBP', label: 'EUR/GBP · Euro / Livre Sterling', base: 0.837 },
    { symbol: 'GBP/JPY', label: 'GBP/JPY · Livre / Yen Japonais', base: 198.5 },
    { symbol: 'NZD/USD', label: 'NZD/USD · Dollar Néo-Zélandais', base: 0.598 },
    { symbol: 'USD/CHF', label: 'USD/CHF · Dollar US / Franc Suisse', base: 0.865 },
  ],
  commodities: [
    { symbol: 'XAU/USD', label: 'XAU/USD · Or Spot (Gold)', base: 2685.0 },
    { symbol: 'XAG/USD', label: 'XAG/USD · Argent Spot (Silver)', base: 31.8 },
    { symbol: 'USOIL', label: 'USOIL · Pétrole Brut WTI', base: 74.5 },
    { symbol: 'UKOIL', label: 'UKOIL · Pétrole Brent Mer du Nord', base: 78.2 },
  ],
  indices: [
    { symbol: 'US30', label: 'US30 · Dow Jones Industrial Average', base: 43250 },
    { symbol: 'US100', label: 'US100 · NASDAQ 100 Tech Index', base: 20450 },
    { symbol: 'US500', label: 'US500 · S&P 500 Index', base: 5860 },
    { symbol: 'GER40', label: 'GER40 · DAX 40 Allemagne', base: 19550 },
    { symbol: 'UK100', label: 'UK100 · FTSE 100 Royaume-Uni', base: 8250 },
  ],
  crypto: [
    { symbol: 'BTC/USD', label: 'BTC/USD · Bitcoin', base: 68400 },
    { symbol: 'ETH/USD', label: 'ETH/USD · Ethereum', base: 2640 },
    { symbol: 'SOL/USD', label: 'SOL/USD · Solana', base: 158 },
    { symbol: 'BNB/USD', label: 'BNB/USD · Binance Coin', base: 595 },
  ],
  synthetics: [
    { symbol: 'VOL75', label: 'Volatility 75 Index (V75)', base: 325400 },
    { symbol: 'VOL100', label: 'Volatility 100 Index (V100)', base: 1840 },
    { symbol: 'VOL50', label: 'Volatility 50 Index (V50)', base: 285 },
    { symbol: 'VOL25', label: 'Volatility 25 Index (V25)', base: 1950 },
    { symbol: 'BOOM1000', label: 'Boom 1000 Index', base: 9850 },
    { symbol: 'CRASH1000', label: 'Crash 1000 Index', base: 6420 },
    { symbol: 'STEP', label: 'Step Index Deriv', base: 4200 },
  ],
};

const TIMEFRAMES = [
  { id: '1m', label: 'M1' },
  { id: '5m', label: 'M5' },
  { id: '15m', label: 'M15' },
  { id: '30m', label: 'M30' },
  { id: '1h', label: 'H1' },
  { id: '4h', label: 'H4' },
  { id: '1d', label: 'D1' },
  { id: '1w', label: 'W1' },
];

export default function ChartVision() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [activeCategory, setActiveCategory] = useState('forex');
  const [selectedPair, setSelectedPair] = useState(PAIRS_BY_CAT.forex[0]);
  const [selectedTf, setSelectedTf] = useState('1h');

  // Strategy list from API + user preferences
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [selectedStratKey, setSelectedStratKey] = useState('smc');
  const [userSavedStrategy, setUserSavedStrategy] = useState(null);

  // Market & Overlay state
  const [candles, setCandles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoTrace, setAutoTrace] = useState(true);
  const [isRealFeed, setIsRealFeed] = useState(false);

  // HTML overlay coordinates for shaded Supply/Demand zones
  const [zoneBoxes, setZoneBoxes] = useState({ supply: null, demand: null, mid: null });

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const linesRef = useRef([]);

  // Fetch strategies from backend & user preferences
  useEffect(() => {
    let isMounted = true;
    const loadStrategies = async () => {
      try {
        const { data } = await strategyApi.list();
        if (isMounted && data?.data?.strategies) {
          setAvailableStrategies(data.data.strategies);
        }
      } catch (err) {
        console.warn('Strategy list fallback:', err);
      }

      try {
        const prefRes = await userApi.getPreferences();
        const p = prefRes.data?.data?.preferences;
        if (isMounted && (p?.customStrategy || p?.tradingStrategy)) {
          setUserSavedStrategy(p.customStrategy || p.tradingStrategy);
        }
      } catch {
        // ignore
      }
    };
    loadStrategies();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pair category handler
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    const firstPair = PAIRS_BY_CAT[catId]?.[0] || PAIRS_BY_CAT.forex[0];
    setSelectedPair(firstPair);
  };

  // Fetch live market data or clean fallback
  const loadMarketData = useCallback(async () => {
    setLoading(true);
    try {
      let finalCandles = [];
      let real = false;

      try {
        const snap = await marketApi.snapshot(selectedPair.symbol, selectedTf, 220);
        const rawBars = snap.data?.data?.market?.candles || snap.data?.data?.candles;
        if (Array.isArray(rawBars) && rawBars.length > 25) {
          finalCandles = sanitizeCandles(rawBars, selectedPair.base);
          real = Boolean(snap.data?.data?.market?.isRealData);
        }
      } catch (e) {
        console.warn('Live feed offline, using clean generator:', e);
      }

      if (!finalCandles || finalCandles.length < 25) {
        finalCandles = generateRealisticCandles(selectedPair.base, selectedTf, 180);
        real = false;
      }

      setCandles(finalCandles);
      setIsRealFeed(real);

      // Strategic analysis computation
      const stratObj = availableStrategies.find((s) => s.key === selectedStratKey || s._id === selectedStratKey);
      const computed = computeStrategicOverlay({
        candles: finalCandles,
        strategyObj: stratObj,
        strategyKey: selectedStratKey,
        customStrategyText: typeof userSavedStrategy === 'string' ? userSavedStrategy : userSavedStrategy?.rules?.join('\n') || '',
        tradePlan: null,
        decision: null,
      });

      setAnalysis(computed);
    } catch (err) {
      toast.error('Erreur lors du chargement des données de marché.');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, selectedTf, selectedStratKey, availableStrategies, userSavedStrategy]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Polling for live updates every 15s
  useEffect(() => {
    const id = setInterval(() => {
      loadMarketData();
    }, 15000);
    return () => clearInterval(id);
  }, [loadMarketData]);

  // Clear previous price lines
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

  // Initialize Lightweight Charts v5 instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 540,
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

  // Update chart data & plot strategy overlays
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    seriesRef.current.setData(candles);
    clearChartLines();

    if (autoTrace && analysis) {
      // 1. Supply Zone bounds
      if (analysis.supplyZone) {
        const lineSupplyTop = seriesRef.current.createPriceLine({
          price: analysis.supplyZone.top,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `SUPPLY OB TOP (${analysis.supplyZone.top})`,
        });
        const lineSupplyBtm = seriesRef.current.createPriceLine({
          price: analysis.supplyZone.bottom,
          color: 'rgba(239, 68, 68, 0.75)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SUPPLY OB BOTTOM`,
        });
        linesRef.current.push(lineSupplyTop, lineSupplyBtm);
      }

      // 2. Demand Zone bounds
      if (analysis.demandZone) {
        const lineDemandTop = seriesRef.current.createPriceLine({
          price: analysis.demandZone.top,
          color: 'rgba(16, 185, 129, 0.75)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `DEMAND OB TOP`,
        });
        const lineDemandBtm = seriesRef.current.createPriceLine({
          price: analysis.demandZone.bottom,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `DEMAND OB BOTTOM (${analysis.demandZone.bottom})`,
        });
        linesRef.current.push(lineDemandTop, lineDemandBtm);
      }

      // 3. Mid Zone / FVG / Pivot Retest
      if (analysis.midZone) {
        const lineMid = seriesRef.current.createPriceLine({
          price: (analysis.midZone.top + analysis.midZone.bottom) / 2,
          color: analysis.midZone.color || '#8b5cf6',
          lineWidth: 1.5,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: analysis.midZone.shortLabel || 'ZONE INTERMÉDIAIRE',
        });
        linesRef.current.push(lineMid);
      }

      // 4. Liquidity Pools (BSL / SSL or EQH / EQL)
      if (Array.isArray(analysis.liquidityPools)) {
        analysis.liquidityPools.forEach((liq) => {
          const isBsl = liq.type.includes('BSL') || liq.type.includes('EQH') || liq.type.includes('HIGH');
          const lineLiq = seriesRef.current.createPriceLine({
            price: liq.price,
            color: isBsl ? '#38bdf8' : '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `LIQUIDITÉ ${liq.type} (${liq.price})`,
          });
          linesRef.current.push(lineLiq);
        });
      }

      // 5. Strategic Trade Plan Setup (Entry, SL, TP1, TP2)
      if (analysis.entry) {
        const lineEntry = seriesRef.current.createPriceLine({
          price: analysis.entry,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `ENTRÉE ${analysis.direction} (${analysis.entry})`,
        });
        linesRef.current.push(lineEntry);
      }

      if (analysis.sl) {
        const lineSl = seriesRef.current.createPriceLine({
          price: analysis.sl,
          color: '#dc2626',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `STOP LOSS (${analysis.sl})`,
        });
        linesRef.current.push(lineSl);
      }

      if (analysis.tp1) {
        const lineTp1 = seriesRef.current.createPriceLine({
          price: analysis.tp1,
          color: '#16a34a',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `TAKE PROFIT 1 (${analysis.tp1})`,
        });
        linesRef.current.push(lineTp1);
      }

      if (analysis.tp2) {
        const lineTp2 = seriesRef.current.createPriceLine({
          price: analysis.tp2,
          color: '#059669',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `TAKE PROFIT 2 (${analysis.tp2})`,
        });
        linesRef.current.push(lineTp2);
      }
    }

    // Update shaded overlay box pixel coordinates
    const updateOverlays = () => {
      if (!seriesRef.current || !analysis) return;
      try {
        const sTop = seriesRef.current.priceToCoordinate(analysis.supplyZone.top);
        const sBtm = seriesRef.current.priceToCoordinate(analysis.supplyZone.bottom);
        const dTop = seriesRef.current.priceToCoordinate(analysis.demandZone.top);
        const dBtm = seriesRef.current.priceToCoordinate(analysis.demandZone.bottom);

        setZoneBoxes({
          supply:
            sTop !== null && sBtm !== null
              ? { top: Math.min(sTop, sBtm), height: Math.max(8, Math.abs(sBtm - sTop)) }
              : null,
          demand:
            dTop !== null && dBtm !== null
              ? { top: Math.min(dTop, dBtm), height: Math.max(8, Math.abs(dBtm - dTop)) }
              : null,
        });
      } catch {
        // ignore
      }
    };

    updateOverlays();
  }, [candles, analysis, autoTrace]);

  // Combined strategies list (Defaults + Admin DB + Saved User Strategy)
  const mergedStrategies = useMemo(() => {
    const list = [
      { key: 'smc', name: 'Smart Money Concepts (SMC - Order Blocks & FVG)', isDefault: true },
      { key: 'support_resistance', name: 'Support & Résistance (Price Action / Polarité)', isDefault: true },
      { key: 'ict', name: 'ICT Precision (Killzones & Liquidity Sweeps)', isDefault: true },
      { key: 'trend_following', name: 'Trend Following & Pullback EMA Institutionnel', isDefault: true },
    ];

    // Append admin strategies from backend if not duplicates
    availableStrategies.forEach((st) => {
      if (!list.some((x) => x.key === st.key || x.name === st.name)) {
        list.push({
          key: st.key || st._id,
          name: `${st.name} [Système Admin]`,
          rules: st.rules,
          supplyDemandType: st.supplyDemandType,
        });
      }
    });

    // Append saved user strategy
    if (userSavedStrategy) {
      list.unshift({
        key: 'user_saved',
        name: `★ Ma Stratégie Enregistrée (${typeof userSavedStrategy === 'string' ? 'Profil' : userSavedStrategy.name || 'Système'})`,
        isUser: true,
      });
    }

    return list;
  }, [availableStrategies, userSavedStrategy]);

  const lastCandle = candles[candles.length - 1];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-600 text-white shadow-lg shadow-brand-500/20">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Chart Vision · Vision Stratégique en Temps Réel
              </h1>
              <Badge tone="purple">Live Pro</Badge>
              {isRealFeed ? (
                <Badge tone="green">
                  <Zap className="h-3 w-3" /> Flux Direct
                </Badge>
              ) : (
                <Badge tone="yellow">Flux Continu</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Graphique temps réel multi-actifs : tracés automatiques des zones de supply/demand, pools de liquidité, tendance et points d’entrée/SL/TP selon votre stratégie.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Link
              to="/admin/strategies"
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Gérer les stratégies globales de la plateforme"
            >
              <PlusCircle className="h-4 w-4 text-brand-500" />
              <span>Gérer les Stratégies Admin</span>
            </Link>
          )}

          <button
            onClick={() => {
              setRefreshing(true);
              loadMarketData().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="btn-ghost flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
            <span>Actualiser le Flux</span>
          </button>
        </div>
      </div>

      {/* Category Dropdown & Quick Selector */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Catégorie de Marché
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                      isActive
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Actif sélectionné :</span>
            <span className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-bold text-brand-500">
              {selectedPair.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Pair Picker, Timeframe, Strategy Selector, Auto-trace */}
      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-4 md:items-center">
        {/* Pair / Symbol Picker */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Paire ou Actif
          </label>
          <select
            value={selectedPair.symbol}
            onChange={(e) => {
              const pair = PAIRS_BY_CAT[activeCategory].find((p) => p.symbol === e.target.value);
              if (pair) setSelectedPair(pair);
            }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {PAIRS_BY_CAT[activeCategory]?.map((p) => (
              <option key={p.symbol} value={p.symbol}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Unité de Temps
          </label>
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setSelectedTf(tf.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  selectedTf === tf.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Stratégie Appliquée au Graphique
          </label>
          <select
            value={selectedStratKey}
            onChange={(e) => setSelectedStratKey(e.target.value)}
            className="w-full rounded-xl border border-brand-500/40 bg-brand-50 dark:bg-brand-950/30 px-3 py-2 text-sm font-bold text-brand-700 dark:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {mergedStrategies.map((strat) => (
              <option key={strat.key} value={strat.key}>
                {strat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center justify-start md:justify-end gap-3 pt-2 md:pt-4">
          <button
            onClick={() => setAutoTrace(!autoTrace)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow ${
              autoTrace
                ? 'bg-emerald-600 text-white shadow-emerald-600/25'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>{autoTrace ? 'Tracage Actif' : 'Tracage Masqué'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Real-time Chart Canvas (8 cols) + Strategic Breakdown (4 cols) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Real-time Interactive Chart Canvas */}
        <div className="card overflow-hidden p-0 xl:col-span-8 flex flex-col justify-between border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {selectedPair.symbol} · {selectedTf.toUpperCase()}
              </span>
              <span className="text-xs text-gray-400">Flux Institutionnel Pro</span>
              {analysis && (
                <Badge tone={analysis.direction === 'BUY' ? 'green' : 'red'}>
                  Biais {analysis.direction === 'BUY' ? 'Acheteur (HAUSSIER)' : 'Vendeur (BAISSIER)'}
                </Badge>
              )}
            </div>

            {/* Quick Chart Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Supply OB
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Demand OB
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> BSL Liquidity
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> SSL Liquidity
              </span>
            </div>
          </div>

          {/* Canvas container with visual shaded zone bands */}
          <div className="relative min-h-[540px] w-full bg-[#090d16]">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Spinner />
              </div>
            )}

            {/* Visual Shaded Bands for Supply & Demand */}
            {autoTrace && zoneBoxes.supply && (
              <div
                className="pointer-events-none absolute left-0 right-16 z-10 border-y border-red-500/40 bg-red-500/10 transition-all"
                style={{
                  top: `${zoneBoxes.supply.top}px`,
                  height: `${zoneBoxes.supply.height}px`,
                }}
              >
                <span className="absolute left-3 top-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
                  {analysis?.supplyZone?.shortLabel || 'ZONE DE SUPPLY'}
                </span>
              </div>
            )}

            {autoTrace && zoneBoxes.demand && (
              <div
                className="pointer-events-none absolute left-0 right-16 z-10 border-y border-emerald-500/40 bg-emerald-500/10 transition-all"
                style={{
                  top: `${zoneBoxes.demand.top}px`,
                  height: `${zoneBoxes.demand.height}px`,
                }}
              >
                <span className="absolute left-3 top-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  {analysis?.demandZone?.shortLabel || 'ZONE DE DEMAND'}
                </span>
              </div>
            )}

            <div ref={chartContainerRef} className="h-[540px] w-full" />
          </div>

          {/* Bottom Chart Footer with Price Stats */}
          {lastCandle && (
            <div className="flex flex-wrap items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-gray-950 px-4 py-2.5 text-xs text-gray-400 font-mono">
              <div className="flex items-center gap-4">
                <span>O: <strong className="text-gray-200">{lastCandle.open}</strong></span>
                <span>H: <strong className="text-emerald-400">{lastCandle.high}</strong></span>
                <span>L: <strong className="text-red-400">{lastCandle.low}</strong></span>
                <span>C: <strong className="text-gray-200">{lastCandle.close}</strong></span>
              </div>
              <div>
                <span>Dernière bougie: {new Date(lastCandle.time * 1000).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Strategic Analysis Breakdown */}
        <div className="space-y-4 xl:col-span-4">
          {analysis ? (
            <>
              {/* Setup Signal Card */}
              <div className="card p-5 border-l-4 border-l-brand-500 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                      Ordre Suggéré ({analysis.strategyName})
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-2xl font-black ${
                          analysis.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {analysis.direction === 'BUY' ? 'ACHAT (BUY)' : 'VENTE (SELL)'}
                      </span>
                      <Badge tone="purple">R:R {analysis.riskReward}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Score Biais</span>
                    <p className="text-xl font-bold text-emerald-400">{analysis.biasScore}%</p>
                  </div>
                </div>

                {/* Key Price Levels */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 font-mono text-xs border border-gray-200 dark:border-gray-800">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Point d'Entrée</span>
                    <span className="font-bold text-blue-400">{analysis.entry}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Stop Loss (SL)</span>
                    <span className="font-bold text-rose-400">{analysis.sl}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Take Profit 1</span>
                    <span className="font-bold text-emerald-400">{analysis.tp1}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Take Profit 2 (Max)</span>
                    <span className="font-bold text-cyan-400">{analysis.tp2}</span>
                  </div>
                </div>

                {/* Structure status */}
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Activity className="h-4 w-4 text-brand-400 shrink-0" />
                  <span>Structure : <strong>{analysis.structure}</strong></span>
                </div>
              </div>

              {/* Detected Zones & Liquidity Pools */}
              <div className="card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Zones & Liquidités Détectées
                </h3>

                {/* Supply Zone */}
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-400">{analysis.supplyZone.label}</span>
                    <span className="font-mono text-red-300">
                      {analysis.supplyZone.bottom} - {analysis.supplyZone.top}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Zone critique de rejet vendeur ou de prise de profits selon la stratégie.
                  </p>
                </div>

                {/* Demand Zone */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400">{analysis.demandZone.label}</span>
                    <span className="font-mono text-emerald-300">
                      {analysis.demandZone.bottom} - {analysis.demandZone.top}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Zone de forte réaction des volumes acheteurs avec niveau d'invalidation protégé.
                  </p>
                </div>

                {/* Liquidity pools */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                    Liquidités Proches Détectées
                  </span>
                  <div className="space-y-2">
                    {analysis.liquidityPools.map((liq, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs"
                      >
                        <span className="text-gray-300">{liq.label}</span>
                        <span className="font-mono font-bold text-sky-400">{liq.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strategic Confluences Checklist */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Confluences Stratégiques Validées
                  </h3>
                </div>
                <ul className="space-y-2">
                  {analysis.confluences.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center text-gray-400">
              <Spinner />
              <p className="mt-3 text-xs">Calcul de la perception stratégique...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}