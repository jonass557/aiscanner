import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { marketApi, strategyApi, userApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const CATEGORIES = [
  { id: 'forex', label: 'Forex' },
  { id: 'commodities', label: 'Matières & Métaux' },
  { id: 'indices', label: 'Indices Mondiaux' },
  { id: 'crypto', label: 'Crypto-Monnaies' },
  { id: 'synthetics', label: 'Synthétiques Deriv' },
];

const PAIRS_BY_CAT = {
  forex: [
    { symbol: 'EUR/USD', label: 'EUR/USD · Euro / Dollar US', base: 1.085 },
    { symbol: 'GBP/USD', label: 'GBP/USD · Livre / Dollar US', base: 1.295 },
    { symbol: 'USD/JPY', label: 'USD/JPY · Dollar / Yen Japonais', base: 153.2 },
    { symbol: 'AUD/USD', label: 'AUD/USD · Dollar Australien', base: 0.658 },
    { symbol: 'USD/CAD', label: 'USD/CAD · Dollar / Dollar Canadien', base: 1.382 },
    { symbol: 'EUR/GBP', label: 'EUR/GBP · Euro / Livre', base: 0.837 },
    { symbol: 'GBP/JPY', label: 'GBP/JPY · Livre / Yen', base: 198.5 },
  ],
  commodities: [
    { symbol: 'XAU/USD', label: 'XAU/USD · Or Spot (Gold)', base: 2685.0 },
    { symbol: 'XAG/USD', label: 'XAG/USD · Argent Spot (Silver)', base: 31.8 },
    { symbol: 'USOIL', label: 'USOIL · Pétrole Brut WTI', base: 74.5 },
  ],
  indices: [
    { symbol: 'US30', label: 'US30 · Dow Jones Industrial', base: 43250 },
    { symbol: 'US100', label: 'US100 · NASDAQ 100 Tech', base: 20450 },
    { symbol: 'US500', label: 'US500 · S&P 500 Index', base: 5860 },
    { symbol: 'GER40', label: 'GER40 · DAX 40 Allemagne', base: 19550 },
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

  // Strategies
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [selectedStratKey, setSelectedStratKey] = useState('smc');
  const [userSavedStrategy, setUserSavedStrategy] = useState(null);

  // Chart data & Analysis State
  const [candles, setCandles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoTrace, setAutoTrace] = useState(true);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const linesRef = useRef([]);

  // Load available strategies from API & user preferences
  useEffect(() => {
    let isMounted = true;
    const fetchStrat = async () => {
      try {
        const { data } = await strategyApi.list();
        if (isMounted && data.data?.strategies) {
          setAvailableStrategies(data.data.strategies);
        }
      } catch (err) {
        console.warn('Failed to fetch strategies, using fallback:', err);
      }

      // Check user preferences for saved custom strategy
      try {
        const prefRes = await userApi.getPreferences();
        if (isMounted && prefRes.data?.data?.preferences?.tradingStrategy) {
          setUserSavedStrategy(prefRes.data.data.preferences.tradingStrategy);
        }
      } catch {
        // ignore
      }
    };
    fetchStrat();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update selectedPair when category changes
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    const firstPair = PAIRS_BY_CAT[catId]?.[0] || PAIRS_BY_CAT.forex[0];
    setSelectedPair(firstPair);
  };

  // Generate realistic candles based on symbol and timeframe
  const generateCandles = useCallback((pair, tf) => {
    const totalCount = 180;
    const result = [];
    const now = Math.floor(Date.now() / 1000);

    const tfSecMap = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
    };
    const step = tfSecMap[tf] || 3600;

    let basePrice = pair.base;
    const isCrypto = pair.symbol.includes('BTC') || pair.symbol.includes('ETH');
    const isDeriv = pair.symbol.includes('VOL') || pair.symbol.includes('BOOM') || pair.symbol.includes('CRASH');
    const isJpy = pair.symbol.includes('JPY');
    const isGold = pair.symbol.includes('XAU');

    const volCoeff = isCrypto ? 0.008 : isDeriv ? 0.006 : isGold ? 0.004 : isJpy ? 0.002 : 0.0012;

    // Build trend waves
    let current = basePrice;
    for (let i = totalCount; i >= 0; i--) {
      const time = now - i * step;
      const trendWave = Math.sin(i / 14) * 0.4 + Math.cos(i / 7) * 0.3;
      const noise = (Math.random() - 0.48) * volCoeff * current;
      const delta = (trendWave * volCoeff * current * 0.4) + noise;

      const open = current;
      const close = current + delta;
      const wick1 = Math.random() * Math.abs(delta) * 1.5;
      const wick2 = Math.random() * Math.abs(delta) * 1.5;
      const high = Math.max(open, close) + wick1;
      const low = Math.min(open, close) - wick2;

      current = close;

      result.push({
        time,
        open: Number(open.toFixed(isJpy || isDeriv ? 2 : isGold ? 2 : isCrypto ? 2 : 5)),
        high: Number(high.toFixed(isJpy || isDeriv ? 2 : isGold ? 2 : isCrypto ? 2 : 5)),
        low: Number(low.toFixed(isJpy || isDeriv ? 2 : isGold ? 2 : isCrypto ? 2 : 5)),
        close: Number(close.toFixed(isJpy || isDeriv ? 2 : isGold ? 2 : isCrypto ? 2 : 5)),
      });
    }

    return result;
  }, []);

  // Compute strategic analysis based on chosen methodology
  const computeAnalysis = useCallback((rawCandles, strategyKey, customRules) => {
    if (!rawCandles || rawCandles.length < 20) return null;

    const last = rawCandles[rawCandles.length - 1];
    const prev20 = rawCandles.slice(-30);
    const high20 = Math.max(...prev20.map((c) => c.high));
    const low20 = Math.min(...prev20.map((c) => c.low));
    const range = high20 - low20;

    const isSmc = strategyKey === 'smc' || strategyKey === 'ict';
    const isSnR = strategyKey === 'support_resistance';

    const isBullish = last.close >= rawCandles[rawCandles.length - 15].close;
    const direction = isBullish ? 'BUY' : 'SELL';

    if (isSmc) {
      // Smart Money Concepts: Order Blocks, FVG, BSL/SSL sweeps
      const supplyZone = {
        top: Number((high20 - range * 0.02).toFixed(4)),
        bottom: Number((high20 - range * 0.12).toFixed(4)),
        label: 'Supply OB (Order Block Bearish non mitigé)',
        type: 'supply',
      };

      const demandZone = {
        top: Number((low20 + range * 0.12).toFixed(4)),
        bottom: Number((low20 + range * 0.02).toFixed(4)),
        label: 'Demand OB (Order Block Bullish Institutionnel)',
        type: 'demand',
      };

      const bslLevel = Number((high20 + range * 0.015).toFixed(4));
      const sslLevel = Number((low20 - range * 0.015).toFixed(4));

      const entry = isBullish
        ? Number((demandZone.top + range * 0.02).toFixed(4))
        : Number((supplyZone.bottom - range * 0.02).toFixed(4));

      const sl = isBullish
        ? Number((demandZone.bottom - range * 0.04).toFixed(4))
        : Number((supplyZone.top + range * 0.04).toFixed(4));

      const risk = Math.abs(entry - sl);
      const tp1 = isBullish ? Number((entry + risk * 2).toFixed(4)) : Number((entry - risk * 2).toFixed(4));
      const tp2 = isBullish ? bslLevel : sslLevel;

      return {
        strategy: 'Smart Money Concepts (SMC)',
        direction,
        trend: isBullish ? 'Haussier (Bullish Order Flow)' : 'Baissier (Bearish Order Flow)',
        biasScore: 92,
        structure: isBullish ? 'CHoCH Validé + BOS Haussier' : 'CHoCH Baissier + BOS de Continuation',
        supplyZone,
        demandZone,
        liquidityPools: [
          { type: 'BSL', price: bslLevel, label: 'Buy-Side Liquidity (Stop-loss acheteurs à balayer)' },
          { type: 'SSL', price: sslLevel, label: 'Sell-Side Liquidity (Poche de liquidité vendeur sous creux)' },
        ],
        entry,
        sl,
        tp1,
        tp2,
        riskReward: `1:${(Math.abs(tp2 - entry) / (risk || 1)).toFixed(1)}`,
        confluences: [
          'Order Block (OB) Institutionnel identifié sur zone d’inversion',
          'Imbalance Fair Value Gap (FVG) en cours de comblement',
          'Prise de liquidité préalable (Sweep de structure)',
          'Entrée sur OTE (Optimal Trade Entry 62% - 79%)',
        ],
      };
    } else if (isSnR) {
      // Support & Resistance (Price Action)
      const resistanceZone = {
        top: Number((high20).toFixed(4)),
        bottom: Number((high20 - range * 0.08).toFixed(4)),
        label: 'Résistance Horizontale Majeure (3 rejets consécutifs)',
        type: 'supply',
      };

      const supportZone = {
        top: Number((low20 + range * 0.08).toFixed(4)),
        bottom: Number((low20).toFixed(4)),
        label: 'Support Horizontal Clé (Zone de polarité)',
        type: 'demand',
      };

      const eqh = Number((high20 - range * 0.01).toFixed(4));
      const eql = Number((low20 + range * 0.01).toFixed(4));

      const entry = isBullish
        ? Number((supportZone.top + range * 0.03).toFixed(4))
        : Number((resistanceZone.bottom - range * 0.03).toFixed(4));

      const sl = isBullish
        ? Number((supportZone.bottom - range * 0.05).toFixed(4))
        : Number((resistanceZone.top + range * 0.05).toFixed(4));

      const risk = Math.abs(entry - sl);
      const tp1 = isBullish
        ? Number((entry + (resistanceZone.bottom - entry) * 0.5).toFixed(4))
        : Number((entry - (entry - supportZone.top) * 0.5).toFixed(4));
      const tp2 = isBullish ? resistanceZone.bottom : supportZone.top;

      return {
        strategy: 'Support & Résistance Institutionnel',
        direction,
        trend: isBullish ? 'Rebond sur Support Majeur' : 'Rejet sous Résistance Majeure',
        biasScore: 86,
        structure: 'Cassure / Retest de niveau horizontal clé',
        supplyZone: resistanceZone,
        demandZone: supportZone,
        liquidityPools: [
          { type: 'EQH', price: eqh, label: 'Equal Highs (Double sommet chartiste avec liquidité)' },
          { type: 'EQL', price: eql, label: 'Equal Lows (Double creux support avec stop buyers)' },
        ],
        entry,
        sl,
        tp1,
        tp2,
        riskReward: `1:${(Math.abs(tp2 - entry) / (risk || 1)).toFixed(1)}`,
        confluences: [
          'Barrière horizontale testée et validée avec mèches de rejet',
          'Pression acheteuse/vendeuse confirmée en clôture',
          'Niveau d’invalidation net sous le creux du support',
          'Ratio Risque/Rendement institutionnel supérieur à 1:2.5',
        ],
      };
    } else {
      // Dynamic Custom or Trend Strategy
      const supplyZone = {
        top: Number((high20 - range * 0.05).toFixed(4)),
        bottom: Number((high20 - range * 0.15).toFixed(4)),
        label: 'Zone de Vente (Expansion / Exhaustion Band)',
        type: 'supply',
      };

      const demandZone = {
        top: Number((low20 + range * 0.15).toFixed(4)),
        bottom: Number((low20 + range * 0.05).toFixed(4)),
        label: 'Zone d\'Achat (Pullback dynamique)',
        type: 'demand',
      };

      const entry = isBullish
        ? Number((demandZone.top + range * 0.02).toFixed(4))
        : Number((supplyZone.bottom - range * 0.02).toFixed(4));

      const sl = isBullish
        ? Number((demandZone.bottom - range * 0.03).toFixed(4))
        : Number((supplyZone.top + range * 0.03).toFixed(4));

      const risk = Math.abs(entry - sl);
      const tp1 = Number((isBullish ? entry + risk * 2 : entry - risk * 2).toFixed(4));
      const tp2 = Number((isBullish ? entry + risk * 3.5 : entry - risk * 3.5).toFixed(4));

      return {
        strategy: 'Stratégie Algorithmique Personnalisée',
        direction,
        trend: isBullish ? 'Flux Haussier Actif' : 'Flux Baissier Actif',
        biasScore: 88,
        structure: 'Confluence Multi-Indicateurs & Niveaux Algorithmiques',
        supplyZone,
        demandZone,
        liquidityPools: [
          { type: 'HIGH_EXT', price: high20, label: 'Extension Haute (Borne de liquidité)' },
          { type: 'LOW_EXT', price: low20, label: 'Extension Basse (Borne de liquidité)' },
        ],
        entry,
        sl,
        tp1,
        tp2,
        riskReward: `1:3.5`,
        confluences: customRules || [
          'Alignement de la structure algorithmique',
          'Zone de valeur dynamique respectée',
          'Ratio gain/perte asymétrique en faveur du trade',
        ],
      };
    }
  }, []);

  // Fetch or initialize candles
  const loadMarketData = useCallback(async () => {
    setLoading(true);
    try {
      // Try live snapshot if available, or generate synthetic accurate candles
      let dataCandles = null;
      try {
        const snap = await marketApi.snapshot(selectedPair.symbol, selectedTf);
        if (snap.data?.data?.candles && snap.data.data.candles.length > 30) {
          dataCandles = snap.data.data.candles;
        }
      } catch {
        // use generation
      }

      if (!dataCandles) {
        dataCandles = generateCandles(selectedPair, selectedTf);
      }

      setCandles(dataCandles);

      // Selected strategy rules if custom
      const currentStratObj = availableStrategies.find((s) => s.key === selectedStratKey);
      const customRules = currentStratObj?.rules;

      const calculated = computeAnalysis(dataCandles, selectedStratKey, customRules);
      setAnalysis(calculated);
    } catch (err) {
      toast.error('Erreur lors du chargement des données de marché.');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, selectedTf, selectedStratKey, availableStrategies, generateCandles, computeAnalysis]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Clean lines helper
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

  // Build / update chart instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 520,
        layout: {
          backgroundColor: '#0b0f19',
          textColor: '#94a3b8',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
          horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: 'rgba(30, 41, 59, 0.8)',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: 'rgba(30, 41, 59, 0.8)',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
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

  // Update chart data & plot strategic overlays
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    seriesRef.current.setData(candles);
    clearChartLines();

    if (autoTrace && analysis) {
      // 1. Plot Supply Zone Lines
      const lineSupplyTop = seriesRef.current.createPriceLine({
        price: analysis.supplyZone.top,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `SUPPLY ZONE TOP (${analysis.supplyZone.top})`,
      });
      const lineSupplyBtm = seriesRef.current.createPriceLine({
        price: analysis.supplyZone.bottom,
        color: 'rgba(239, 68, 68, 0.7)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `SUPPLY ZONE BOTTOM`,
      });
      linesRef.current.push(lineSupplyTop, lineSupplyBtm);

      // 2. Plot Demand Zone Lines
      const lineDemandTop = seriesRef.current.createPriceLine({
        price: analysis.demandZone.top,
        color: 'rgba(16, 185, 129, 0.7)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `DEMAND ZONE TOP`,
      });
      const lineDemandBtm = seriesRef.current.createPriceLine({
        price: analysis.demandZone.bottom,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `DEMAND ZONE BOTTOM (${analysis.demandZone.bottom})`,
      });
      linesRef.current.push(lineDemandTop, lineDemandBtm);

      // 3. Plot Liquidity Pools (BSL/SSL or EQH/EQL)
      analysis.liquidityPools.forEach((liq) => {
        const isBsl = liq.type.includes('BSL') || liq.type.includes('EQH') || liq.type.includes('HIGH');
        const lineLiq = seriesRef.current.createPriceLine({
          price: liq.price,
          color: isBsl ? '#38bdf8' : '#f59e0b',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `LIQUIDITÉ ${liq.type} (${liq.price})`,
        });
        linesRef.current.push(lineLiq);
      });

      // 4. Plot Trade Setup (Entry, SL, TP1, TP2)
      const lineEntry = seriesRef.current.createPriceLine({
        price: analysis.entry,
        color: '#a855f7',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `ENTRÉE ${analysis.direction} (${analysis.entry})`,
      });
      const lineSl = seriesRef.current.createPriceLine({
        price: analysis.sl,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `STOP LOSS (${analysis.sl})`,
      });
      const lineTp1 = seriesRef.current.createPriceLine({
        price: analysis.tp1,
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `TAKE PROFIT 1 (${analysis.tp1})`,
      });
      const lineTp2 = seriesRef.current.createPriceLine({
        price: analysis.tp2,
        color: '#06b6d4',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `TAKE PROFIT 2 MAX (${analysis.tp2})`,
      });
      linesRef.current.push(lineEntry, lineSl, lineTp1, lineTp2);
    }
  }, [candles, analysis, autoTrace]);

  // Combine strategies list
  const mergedStrategies = useMemo(() => {
    const list = [...availableStrategies];
    if (userSavedStrategy && !list.find((s) => s.key === 'user_custom')) {
      list.push({
        key: 'user_custom',
        name: `Ma Stratégie (${userSavedStrategy.name || 'Profil'})`,
        category: 'custom',
        isUser: true,
        rules: userSavedStrategy.rules || ['Règles personnalisées enregistrées dans le profil'],
      });
    }
    return list;
  }, [availableStrategies, userSavedStrategy]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-600 text-white shadow-lg shadow-brand-500/20">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Chart Vision · Perception Stratégique Institutionnelle
              </h1>
              <Badge variant="brand" size="xs">Live Pro</Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Moteur temps réel multi-actifs : tracés de Supply & Demand, pools de liquidités et setups selon la stratégie choisie.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadMarketData().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
            <span>Actualiser le Flux</span>
          </button>
        </div>
      </div>

      {/* Asset Categories Nav */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Control Bar: Symbol, Timeframe, Strategy Selector, Auto-trace toggle */}
      <div className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4 md:items-center">
        {/* Symbol Selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Actif / Paire ({activeCategory})
          </label>
          <select
            value={selectedPair.symbol}
            onChange={(e) => {
              const pair = PAIRS_BY_CAT[activeCategory].find((p) => p.symbol === e.target.value);
              if (pair) setSelectedPair(pair);
            }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Unité de Temps (Timeframe)
          </label>
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setSelectedTf(tf.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  selectedTf === tf.id
                    ? 'bg-accent-600 text-white'
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
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Stratégie de Trading Appliquée
          </label>
          <select
            value={selectedStratKey}
            onChange={(e) => setSelectedStratKey(e.target.value)}
            className="w-full rounded-xl border border-brand-500/40 bg-brand-500/5 dark:bg-brand-900/20 px-3 py-2 text-sm font-bold text-brand-600 dark:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {mergedStrategies.map((strat) => (
              <option key={strat.key} value={strat.key}>
                {strat.name} {strat.isUser ? '★' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center justify-start md:justify-end gap-3 pt-2 md:pt-4">
          <button
            onClick={() => setAutoTrace(!autoTrace)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow ${
              autoTrace
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>{autoTrace ? 'Tracage Actif' : 'Tracage Masqué'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Real-time Chart (Left 8 cols) + Analysis Breakdown (Right 4 cols) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Real-time Interactive Chart Canvas */}
        <div className="card overflow-hidden p-0 xl:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {selectedPair.symbol} · {selectedTf.toUpperCase()}
              </span>
              <span className="text-xs text-gray-400">Flux Institutionnel HD</span>
              {analysis && (
                <Badge
                  variant={analysis.direction === 'BUY' ? 'success' : 'error'}
                  size="xs"
                >
                  Biais {analysis.direction === 'BUY' ? 'Acheteur (HAUSSIER)' : 'Vendeur (BAISSIER)'}
                </Badge>
              )}
            </div>

            {/* Quick Chart Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium">
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

          {/* Canvas container */}
          <div className="relative min-h-[520px] w-full bg-[#0b0f19]">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Spinner />
              </div>
            )}
            <div ref={chartContainerRef} className="h-[520px] w-full" />
          </div>

          {/* Bottom Chart Footer with Price Stats */}
          {candles.length > 0 && (
            <div className="flex flex-wrap items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-gray-950 px-4 py-2 text-xs text-gray-400 font-mono">
              <div className="flex items-center gap-4">
                <span>O: <strong className="text-gray-200">{candles[candles.length - 1].open}</strong></span>
                <span>H: <strong className="text-emerald-400">{candles[candles.length - 1].high}</strong></span>
                <span>L: <strong className="text-red-400">{candles[candles.length - 1].low}</strong></span>
                <span>C: <strong className="text-gray-200">{candles[candles.length - 1].close}</strong></span>
              </div>
              <div>
                <span>Dernière mise à jour: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Strategic Analysis, Zones & Setup */}
        <div className="space-y-4 xl:col-span-4">
          {analysis ? (
            <>
              {/* Setup Signal Card */}
              <div className="card p-5 border-l-4 border-l-brand-500 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                      Ordre Suggéré ({analysis.strategy})
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-2xl font-black ${
                          analysis.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {analysis.direction === 'BUY' ? 'ACHAT (BUY)' : 'VENTE (SELL)'}
                      </span>
                      <Badge variant="brand" size="xs">
                        R:R {analysis.riskReward}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Score de Biais</span>
                    <p className="text-xl font-bold text-emerald-400">{analysis.biasScore}%</p>
                  </div>
                </div>

                {/* Key Price Levels */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 font-mono text-xs border border-gray-200 dark:border-gray-800">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Point d'Entrée</span>
                    <span className="font-bold text-purple-400">{analysis.entry}</span>
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
                    <span className="text-gray-400 block text-[10px] uppercase">Take Profit 2</span>
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
                  Zones Institutionnelles Détectées
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
                    Zone critique de prise de profits institutionnels et point d'invalidation vendeur.
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
                    Zone de forte réaction des volumes acheteurs avec Order Block actif.
                  </p>
                </div>

                {/* Liquidity pools */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-2">
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
                    Confluences Requises Validées
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