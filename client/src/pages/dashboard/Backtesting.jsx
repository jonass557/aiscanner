import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Scissors,
  TrendingUp,
  TrendingDown,
  Sliders,
  Zap,
  Activity,
  Layers,
  CheckCircle,
  Settings,
  Plus,
  Minus,
  DollarSign,
  Maximize2,
  Trash2,
  RefreshCw,
  Wallet,
  Clock,
  Briefcase,
  ListOrdered,
  History as HistoryIcon,
  LineChart as LineChartIcon,
  ChevronRight,
  ShieldAlert,
  Target,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { marketApi } from '../../services/endpoints.js';
import { formatPrice } from '../../utils/format.js';
import { sanitizeCandles, generateRealisticCandles } from '../../utils/candleSanitizer.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const INITIAL_CAPITAL = 10000;

const ASSET_CATEGORIES = [
  { id: 'forex', labelFr: 'Forex Majors & Cross', labelEn: 'Forex Majors & Cross' },
  { id: 'commodities', labelFr: 'Métaux & Matières', labelEn: 'Metals & Commodities' },
  { id: 'indices', labelFr: 'Indices Mondiaux', labelEn: 'World Indices' },
  { id: 'crypto', labelFr: 'Crypto (Binance)', labelEn: 'Crypto (Binance)' },
  { id: 'synthetic', labelFr: 'Indices Synthétiques Deriv', labelEn: 'Deriv Synthetics' },
];

const ALL_PAIRS = [
  // Forex
  { symbol: 'EURUSD', category: 'forex', label: 'EUR/USD', base: 1.085 },
  { symbol: 'GBPUSD', category: 'forex', label: 'GBP/USD', base: 1.272 },
  { symbol: 'USDJPY', category: 'forex', label: 'USD/JPY', base: 156.4 },
  { symbol: 'AUDUSD', category: 'forex', label: 'AUD/USD', base: 0.665 },
  { symbol: 'USDCAD', category: 'forex', label: 'USD/CAD', base: 1.368 },
  { symbol: 'EURJPY', category: 'forex', label: 'EUR/JPY', base: 169.8 },
  { symbol: 'GBPJPY', category: 'forex', label: 'GBP/JPY', base: 198.5 },
  { symbol: 'EURGBP', category: 'forex', label: 'EUR/GBP', base: 0.855 },

  // Commodities & Métaux
  { symbol: 'XAUUSD', category: 'commodities', label: 'Or (Gold / XAUUSD)', base: 2350.0 },
  { symbol: 'XAGUSD', category: 'commodities', label: 'Argent (Silver / XAGUSD)', base: 29.2 },
  { symbol: 'USOIL', category: 'commodities', label: 'Pétrole Brut (WTI)', base: 78.5 },

  // Indices
  { symbol: 'US30', category: 'indices', label: 'Dow Jones (US30)', base: 39500 },
  { symbol: 'NAS100', category: 'indices', label: 'Nasdaq 100 (NAS100)', base: 18700 },
  { symbol: 'SPX500', category: 'indices', label: 'S&P 500', base: 5480 },
  { symbol: 'GER40', category: 'indices', label: 'DAX 40 (Allemagne)', base: 18350 },

  // Crypto
  { symbol: 'BTCUSD', category: 'crypto', label: 'Bitcoin (BTC/USD)', base: 64500 },
  { symbol: 'ETHUSD', category: 'crypto', label: 'Ethereum (ETH/USD)', base: 3400 },
  { symbol: 'SOLUSD', category: 'crypto', label: 'Solana (SOL/USD)', base: 150 },

  // Synthétiques
  { symbol: 'Volatility 75 Index', category: 'synthetic', label: 'Volatility 75 Index', base: 1850 },
  { symbol: 'Volatility 100 Index', category: 'synthetic', label: 'Volatility 100 Index', base: 980 },
  { symbol: 'Boom 1000 Index', category: 'synthetic', label: 'Boom 1000 Index', base: 12500 },
  { symbol: 'Crash 1000 Index', category: 'synthetic', label: 'Crash 1000 Index', base: 6400 },
];

const TIMEFRAMES = [
  { value: 'M1', label: '1 min (M1)' },
  { value: 'M5', label: '5 min (M5)' },
  { value: 'M15', label: '15 min (M15)' },
  { value: 'M30', label: '30 min (M30)' },
  { value: 'H1', label: '1 heure (H1)' },
  { value: 'H4', label: '4 heures (H4)' },
  { value: 'D1', label: '1 jour (D1)' },
  { value: 'W1', label: '1 semaine (W1)' },
];

const CHART_TYPES = [
  { id: 'candlestick', labelFr: 'Chandeliers Japonais', labelEn: 'Candlesticks' },
  { id: 'bar', labelFr: 'Barres OHLC', labelEn: 'OHLC Bars' },
  { id: 'line', labelFr: 'Ligne', labelEn: 'Line Chart' },
  { id: 'area', labelFr: 'Surface (Area)', labelEn: 'Area Chart' },
];

const THEME_COLORS = [
  { id: 'dark', label: 'Dark Pro', bg: '#131722', text: '#d1d4dc', grid: '#1e222d' },
  { id: 'black', label: 'OLED Black', bg: '#000000', text: '#9ca3af', grid: '#111827' },
  { id: 'slate', label: 'Navy Slate', bg: '#0b0f19', text: '#94a3b8', grid: '#1e293b' },
  { id: 'light', label: 'Light Pro', bg: '#ffffff', text: '#191919', grid: '#f0f3fa' },
];

// Return lot step, minimum and contract specifications per category
const getLotConfig = (category, symbol) => {
  switch (category) {
    case 'forex':
      return { min: 0.01, step: 0.01, default: 0.1, label: '0.01 - 100 Lots (1 pip ≈ $10/lot)' };
    case 'commodities':
      if (symbol === 'XAUUSD') return { min: 0.01, step: 0.01, default: 0.1, label: '0.01 - 50 Lots ($1 = $100/lot)' };
      if (symbol === 'XAGUSD') return { min: 0.01, step: 0.01, default: 0.1, label: '0.01 - 20 Lots ($1 = $5000/lot)' };
      return { min: 0.01, step: 0.01, default: 0.1, label: '0.01 - 50 Lots ($1 = $1000/lot)' };
    case 'indices':
      return { min: 0.1, step: 0.1, default: 1.0, label: '0.1 - 50 Contrats ($1/pt)' };
    case 'crypto':
      return { min: 0.001, step: 0.001, default: 0.05, label: '0.001 - 10 Coins' };
    case 'synthetic':
      return { min: 0.1, step: 0.1, default: 0.5, label: '0.1 - 20 Lots' };
    default:
      return { min: 0.01, step: 0.01, default: 0.1, label: '0.01 - 10 Lots' };
  }
};

// Calculate realistic P&L for a closed or floating trade
const calculateTradePnl = (pos, currentPrice) => {
  const multiplier = pos.type === 'BUY' ? 1 : -1;
  const diff = (currentPrice - pos.entry) * multiplier;
  const lots = Number(pos.lots) || 0.1;
  const sym = pos.symbol;
  const cat = pos.category;

  let pnl = 0;
  if (cat === 'forex') {
    if (sym && sym.includes('JPY')) {
      pnl = (diff / currentPrice) * lots * 100000;
    } else {
      pnl = diff * lots * 100000;
    }
  } else if (cat === 'commodities') {
    if (sym === 'XAUUSD') pnl = diff * lots * 100;
    else if (sym === 'XAGUSD') pnl = diff * lots * 5000;
    else pnl = diff * lots * 1000;
  } else if (cat === 'indices') {
    pnl = diff * lots * 1;
  } else if (cat === 'crypto') {
    pnl = diff * lots;
  } else if (cat === 'synthetic') {
    pnl = diff * lots * 5;
  } else {
    pnl = diff * lots * 100;
  }

  return Math.round(pnl * 100) / 100;
};

export default function Backtesting() {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';

  // Page Tab state to maximize chart area: 'chart' | 'orders' | 'positions' | 'history'
  const [activeTab, setActiveTab] = useState('chart');

  // Pair & Category dropdown state
  const [selectedCategory, setSelectedCategory] = useState('forex');
  const [selectedPair, setSelectedPair] = useState(ALL_PAIRS[0]);
  const [timeframe, setTimeframe] = useState('H1');
  const [candleLimit, setCandleLimit] = useState(2000); // Unlimited / Deep history

  // Raw dataset and replay pointer
  const [allCandles, setAllCandles] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0); // number of bars currently revealed
  const [cutIndex, setCutIndex] = useState(0); // where the cut was placed
  const [cutMode, setCutMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  // Chart Customization State
  const [chartType, setChartType] = useState('candlestick');
  const [chartTheme, setChartTheme] = useState(THEME_COLORS[0]);
  const [upColor, setUpColor] = useState('#26a69a');
  const [downColor, setDownColor] = useState('#ef5350');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Active Indicators & Sessions
  const [showEMA9, setShowEMA9] = useState(false);
  const [showEMA21, setShowEMA21] = useState(false);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);

  // Account Capital & Realistic Trade Simulation ($10,000 initial balance)
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('backtest_balance');
    return saved ? Number(saved) : INITIAL_CAPITAL;
  });

  // Lot size dynamically initialized per category
  const lotConfig = useMemo(
    () => getLotConfig(selectedPair.category, selectedPair.symbol),
    [selectedPair]
  );
  const [lotSize, setLotSize] = useState(lotConfig.default);

  // Order Placement Inputs
  const [orderType, setOrderType] = useState('BUY'); // BUY, SELL, BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP
  const [customEntry, setCustomEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  // Active positions & Pending Orders & Execution Logs
  const [activePositions, setActivePositions] = useState([]); // [{ id, symbol, category, type, entry, lots, sl, tp, pnl, openTime }]
  const [pendingOrders, setPendingOrders] = useState([]); // [{ id, symbol, category, type, entry, lots, sl, tp }]
  const [tradeLogs, setTradeLogs] = useState([]); // [{ id, symbol, category, type, lots, entry, exit, pnl, reason, time }]

  // Chart container refs
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Filtered pairs according to category
  const filteredPairs = useMemo(() => {
    return ALL_PAIRS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  // Adjust lot size default whenever selectedPair changes
  useEffect(() => {
    setLotSize(lotConfig.default);
  }, [lotConfig]);

  // Current replay bar price
  const currentCandle = useMemo(() => {
    if (!allCandles.length || replayIndex <= 0) return null;
    return allCandles[Math.min(replayIndex - 1, allCandles.length - 1)];
  }, [allCandles, replayIndex]);

  const currentPrice = currentCandle ? currentCandle.close : selectedPair.base;

  // Real-time Account Metrics
  const floatingPnl = useMemo(() => {
    return Math.round(activePositions.reduce((acc, pos) => acc + (pos.pnl || 0), 0) * 100) / 100;
  }, [activePositions]);

  const equity = useMemo(() => {
    return Math.round((balance + floatingPnl) * 100) / 100;
  }, [balance, floatingPnl]);

  // Load candle data from server
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setIsPlaying(false);
    try {
      const { data } = await marketApi.snapshot(selectedPair.symbol, timeframe, candleLimit);
      const raw = data?.data?.market?.candles || [];
      const sorted =
        raw.length > 0
          ? sanitizeCandles(raw, selectedPair.base)
          : generateRealisticCandles(selectedPair.base, timeframe, 300);

      if (sorted.length > 0) {
        setAllCandles(sorted);
        // Default cut: show initial 60% of candles to allow deep forward replay
        const initCut = Math.max(15, Math.floor(sorted.length * 0.6));
        setCutIndex(initCut);
        setReplayIndex(initCut);
        toast.success(
          isEn
            ? `Loaded ${sorted.length} bars for ${selectedPair.label}. Replay ready!`
            : `${sorted.length} bougies chargées pour ${selectedPair.label}. Prêt pour le Replay !`
        );
      } else {
        toast.error(isEn ? 'No candle data available.' : 'Aucune donnée disponible.');
      }
    } catch (err) {
      const fallback = generateRealisticCandles(selectedPair.base, timeframe, 300);
      setAllCandles(fallback);
      const initCut = Math.max(15, Math.floor(fallback.length * 0.6));
      setCutIndex(initCut);
      setReplayIndex(initCut);
    } finally {
      setLoading(false);
    }
  }, [selectedPair, timeframe, candleLimit, isEn]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Reset Capital function
  const handleResetCapital = () => {
    setBalance(INITIAL_CAPITAL);
    localStorage.setItem('backtest_balance', INITIAL_CAPITAL);
    setActivePositions([]);
    setPendingOrders([]);
    toast.success(
      isEn
        ? `Account balance reset to $${INITIAL_CAPITAL.toLocaleString()}!`
        : `Solde du compte réinitialisé à $${INITIAL_CAPITAL.toLocaleString()} !`
    );
  };

  // Calculate EMA helper
  const calculateEMA = (candlesData, period) => {
    if (candlesData.length < period) return [];
    const k = 2 / (period + 1);
    let ema = candlesData[0].close;
    const res = [];
    for (let i = 0; i < candlesData.length; i++) {
      const c = candlesData[i];
      if (i === 0) {
        ema = c.close;
      } else {
        ema = c.close * k + ema * (1 - k);
      }
      if (i >= period - 1) {
        res.push({ time: c.time, value: parseFloat(ema.toFixed(5)) });
      }
    }
    return res;
  };

  // Persistent refs to avoid recreating chart when cutMode or candles change
  const cutModeRef = useRef(false);
  useEffect(() => {
    cutModeRef.current = cutMode;
  }, [cutMode]);

  const allCandlesRef = useRef([]);
  useEffect(() => {
    allCandlesRef.current = allCandles;
  }, [allCandles]);

  // Build and Initialize Interactive Pro Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 620, // Tall and immersive for maximum screen coverage
      layout: {
        background: { type: ColorType.Solid, color: chartTheme.bg },
        textColor: chartTheme.text,
      },
      grid: {
        vertLines: { color: chartTheme.grid },
        horzLines: { color: chartTheme.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: chartTheme.grid,
        autoScale: true,
      },
      timeScale: {
        borderColor: chartTheme.grid,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // Add Main Series
    let series;
    if (chartType === 'candlestick') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: upColor,
        downColor: downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else if (chartType === 'bar') {
      series = chart.addSeries(BarSeries, {
        upColor: upColor,
        downColor: downColor,
      });
    } else if (chartType === 'line') {
      series = chart.addSeries(LineSeries, {
        color: '#2196f3',
        lineWidth: 2,
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        topColor: 'rgba(33, 150, 243, 0.4)',
        bottomColor: 'rgba(33, 150, 243, 0.0)',
        lineColor: '#2196f3',
        lineWidth: 2,
      });
    }
    mainSeriesRef.current = series;

    // Immediately load available candles so chart is never blank
    if (allCandlesRef.current.length > 0) {
      const visibleData = allCandlesRef.current.slice(0, replayIndex);
      if (visibleData.length > 0) {
        if (chartType === 'line' || chartType === 'area') {
          series.setData(visibleData.map((c) => ({ time: c.time, value: c.close })));
        } else {
          series.setData(visibleData);
        }
      }
    }

    // Optional EMA lines
    if (showEMA9) {
      ema9SeriesRef.current = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1.5, title: 'EMA 9' });
    }
    if (showEMA21) {
      ema21SeriesRef.current = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1.5, title: 'EMA 21' });
    }
    if (showEMA50) {
      ema50SeriesRef.current = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1.5, title: 'EMA 50' });
    }
    if (showEMA200) {
      ema200SeriesRef.current = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2, title: 'EMA 200' });
    }

    // Handle Click on Chart for Cut Replay Tool (reads cutModeRef without rebuilding chart)
    chart.subscribeClick((param) => {
      if (!cutModeRef.current || !param.time) return;
      const clickedTime = param.time;
      const idx = allCandlesRef.current.findIndex((c) => c.time === clickedTime);
      if (idx !== -1) {
        const newCut = idx + 1;
        setCutIndex(newCut);
        setReplayIndex(newCut);
        setCutMode(false);
        toast.success(
          isEn
            ? `Chart cut at bar #${newCut}. Replay initialized!`
            : `Graphique découpé à la bougie #${newCut}. Replay prêt !`
        );
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [chartTheme, chartType, upColor, downColor, showEMA9, showEMA21, showEMA50, showEMA200, isEn]);

  // Adjust chart width whenever user switches back to 'chart' tab
  useEffect(() => {
    if (activeTab === 'chart' && chartInstanceRef.current && chartContainerRef.current) {
      chartInstanceRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, [activeTab]);

  // Update chart data when replayIndex or allCandles changes
  useEffect(() => {
    if (!mainSeriesRef.current || allCandles.length === 0) return;

    const visibleData = allCandles.slice(0, replayIndex);
    if (visibleData.length === 0) return;

    if (chartType === 'line' || chartType === 'area') {
      mainSeriesRef.current.setData(
        visibleData.map((c) => ({ time: c.time, value: c.close }))
      );
    } else {
      mainSeriesRef.current.setData(visibleData);
    }

    if (showEMA9 && ema9SeriesRef.current) {
      ema9SeriesRef.current.setData(calculateEMA(visibleData, 9));
    }
    if (showEMA21 && ema21SeriesRef.current) {
      ema21SeriesRef.current.setData(calculateEMA(visibleData, 21));
    }
    if (showEMA50 && ema50SeriesRef.current) {
      ema50SeriesRef.current.setData(calculateEMA(visibleData, 50));
    }
    if (showEMA200 && ema200SeriesRef.current) {
      ema200SeriesRef.current.setData(calculateEMA(visibleData, 200));
    }

    // Update Price Lines for Orders on the series
    priceLinesRef.current.forEach((line) => {
      try {
        mainSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Draw active positions
    activePositions.forEach((pos) => {
      const line = mainSeriesRef.current.createPriceLine({
        price: pos.entry,
        color: pos.type === 'BUY' ? '#10b981' : '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${pos.type} ${pos.lots}L`,
      });
      priceLinesRef.current.push(line);

      if (pos.sl) {
        const slLine = mainSeriesRef.current.createPriceLine({
          price: Number(pos.sl),
          color: '#f43f5e',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL (${pos.type})`,
        });
        priceLinesRef.current.push(slLine);
      }
      if (pos.tp) {
        const tpLine = mainSeriesRef.current.createPriceLine({
          price: Number(pos.tp),
          color: '#10b981',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP (${pos.type})`,
        });
        priceLinesRef.current.push(tpLine);
      }
    });

    // Draw pending orders
    pendingOrders.forEach((order) => {
      const line = mainSeriesRef.current.createPriceLine({
        price: order.entry,
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: `${order.type} @ ${order.entry}`,
      });
      priceLinesRef.current.push(line);
    });

    // Position Markers
    const markers = [];
    activePositions.forEach((pos) => {
      markers.push({
        time: pos.openTime,
        position: pos.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: pos.type === 'BUY' ? '#10b981' : '#ef4444',
        shape: pos.type === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${pos.type} ${pos.lots}L`,
      });
    });
    createSeriesMarkers(mainSeriesRef.current, markers);
  }, [replayIndex, allCandles, chartType, showEMA9, showEMA21, showEMA50, showEMA200, activePositions, pendingOrders]);

  // Order Matching & Realistic PnL / SL / TP Evaluation per bar
  const evaluateOrdersAtBar = useCallback(
    (bar) => {
      if (!bar) return;

      const { high, low, close } = bar;

      // 1. Check Pending Orders Trigger
      setPendingOrders((prevPending) => {
        const remaining = [];
        prevPending.forEach((ord) => {
          let triggered = false;
          if (ord.type === 'BUY_LIMIT' && low <= ord.entry) triggered = true;
          else if (ord.type === 'SELL_LIMIT' && high >= ord.entry) triggered = true;
          else if (ord.type === 'BUY_STOP' && high >= ord.entry) triggered = true;
          else if (ord.type === 'SELL_STOP' && low <= ord.entry) triggered = true;

          if (triggered) {
            toast.success(
              isEn
                ? `Pending order triggered: ${ord.type} @ ${ord.entry}!`
                : `Ordre différé exécuté : ${ord.type} @ ${ord.entry} !`
            );
            setActivePositions((prevPos) => [
              ...prevPos,
              {
                id: ord.id,
                symbol: ord.symbol,
                category: ord.category,
                type: ord.type.startsWith('BUY') ? 'BUY' : 'SELL',
                entry: ord.entry,
                lots: ord.lots,
                sl: ord.sl,
                tp: ord.tp,
                openTime: bar.time,
                pnl: 0,
              },
            ]);
          } else {
            remaining.push(ord);
          }
        });
        return remaining;
      });

      // 2. Check Open Positions for SL / TP hits and update real PnL
      setActivePositions((prevPositions) => {
        const stillOpen = [];
        prevPositions.forEach((pos) => {
          let closed = false;
          let exitPrice = close;
          let exitReason = '';

          // Check SL Hit
          if (pos.sl) {
            const sl = Number(pos.sl);
            if (pos.type === 'BUY' && low <= sl) {
              closed = true;
              exitPrice = sl;
              exitReason = 'STOP_LOSS';
            } else if (pos.type === 'SELL' && high >= sl) {
              closed = true;
              exitPrice = sl;
              exitReason = 'STOP_LOSS';
            }
          }

          // Check TP Hit
          if (!closed && pos.tp) {
            const tp = Number(pos.tp);
            if (pos.type === 'BUY' && high >= tp) {
              closed = true;
              exitPrice = tp;
              exitReason = 'TAKE_PROFIT';
            } else if (pos.type === 'SELL' && low <= tp) {
              closed = true;
              exitPrice = tp;
              exitReason = 'TAKE_PROFIT';
            }
          }

          if (closed) {
            const realizedPnl = calculateTradePnl(pos, exitPrice);
            // Update balance
            setBalance((prevBal) => {
              const updated = Math.round((prevBal + realizedPnl) * 100) / 100;
              localStorage.setItem('backtest_balance', updated);
              return updated;
            });

            toast(
              exitReason === 'TAKE_PROFIT'
                ? `🎯 ${pos.type} TAKE PROFIT: +$${Math.abs(realizedPnl)}`
                : `🛑 ${pos.type} STOP LOSS: -$${Math.abs(realizedPnl)}`,
              {
                icon: exitReason === 'TAKE_PROFIT' ? '💰' : '🛑',
                style: {
                  borderRadius: '10px',
                  background: exitReason === 'TAKE_PROFIT' ? '#064e3b' : '#7f1d1d',
                  color: '#fff',
                },
              }
            );

            setTradeLogs((logs) => [
              {
                id: pos.id,
                symbol: pos.symbol,
                category: pos.category,
                type: pos.type,
                lots: pos.lots,
                entry: pos.entry,
                exit: exitPrice,
                pnl: realizedPnl,
                reason: exitReason,
                time: bar.time,
              },
              ...logs,
            ]);
          } else {
            // Update floating PnL
            const currentFloating = calculateTradePnl(pos, close);
            stillOpen.push({ ...pos, pnl: currentFloating });
          }
        });
        return stillOpen;
      });
    },
    [isEn]
  );

  // Replay Clock: Step Forward
  const stepForward = useCallback(() => {
    setReplayIndex((prev) => {
      if (prev >= allCandles.length) {
        setIsPlaying(false);
        toast(isEn ? 'End of historical market data reached.' : 'Fin des données historiques atteinte.', { icon: '🏁' });
        return prev;
      }
      const nextIndex = prev + 1;
      const bar = allCandles[nextIndex - 1];
      evaluateOrdersAtBar(bar);
      return nextIndex;
    });
  }, [allCandles, evaluateOrdersAtBar, isEn]);

  // Replay Clock: Step Back
  const stepBack = useCallback(() => {
    setReplayIndex((prev) => Math.max(cutIndex || 5, prev - 1));
  }, [cutIndex]);

  // Restart replay to cut point
  const restartReplay = () => {
    setIsPlaying(false);
    setReplayIndex(cutIndex || 15);
    setActivePositions([]);
    toast.success(isEn ? 'Replay reset to starting cut point.' : 'Replay réinitialisé au point de découpe.');
  };

  // Replay interval timer
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(80, Math.floor(1000 / playbackSpeed));
    const timer = setInterval(() => {
      stepForward();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, stepForward]);

  // Execute Order
  const handlePlaceOrder = () => {
    if (!currentCandle) {
      toast.error(isEn ? 'No candle available.' : 'Aucune bougie disponible.');
      return;
    }

    const isPending = ['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType);
    const entryPrice = isPending ? parseFloat(customEntry) : currentPrice;

    if (isPending && (!entryPrice || isNaN(entryPrice))) {
      toast.error(isEn ? 'Please specify an Entry Price for pending orders.' : 'Veuillez saisir un Prix d\'entrée pour cet ordre différé.');
      return;
    }

    const numLots = parseFloat(lotSize) || lotConfig.default;
    const orderId = Date.now().toString(36);

    if (isPending) {
      setPendingOrders((prev) => [
        ...prev,
        {
          id: orderId,
          symbol: selectedPair.symbol,
          category: selectedPair.category,
          type: orderType,
          entry: entryPrice,
          lots: numLots,
          sl: stopLoss ? parseFloat(stopLoss) : null,
          tp: takeProfit ? parseFloat(takeProfit) : null,
        },
      ]);
      toast.success(
        isEn
          ? `Pending ${orderType} placed at ${entryPrice}`
          : `Ordre ${orderType} placé à ${entryPrice}`
      );
    } else {
      setActivePositions((prev) => [
        ...prev,
        {
          id: orderId,
          symbol: selectedPair.symbol,
          category: selectedPair.category,
          type: orderType,
          entry: entryPrice,
          lots: numLots,
          sl: stopLoss ? parseFloat(stopLoss) : null,
          tp: takeProfit ? parseFloat(takeProfit) : null,
          openTime: currentCandle.time,
          pnl: 0,
        },
      ]);
      toast.success(
        isEn
          ? `Market ${orderType} executed @ ${entryPrice}`
          : `Ordre Marché ${orderType} exécuté @ ${entryPrice}`
      );
    }

    // Switch smoothly to chart so user can observe their order
    setActiveTab('chart');
  };

  // Close position manually
  const closePositionManually = (posId) => {
    const pos = activePositions.find((p) => p.id === posId);
    if (!pos || !currentCandle) return;

    const exitPrice = currentCandle.close;
    const realizedPnl = calculateTradePnl(pos, exitPrice);

    setBalance((prevBal) => {
      const updated = Math.round((prevBal + realizedPnl) * 100) / 100;
      localStorage.setItem('backtest_balance', updated);
      return updated;
    });

    setActivePositions((prev) => prev.filter((p) => p.id !== posId));
    setTradeLogs((prev) => [
      {
        id: pos.id,
        symbol: pos.symbol,
        category: pos.category,
        type: pos.type,
        lots: pos.lots,
        entry: pos.entry,
        exit: exitPrice,
        pnl: realizedPnl,
        reason: 'MANUAL_CLOSE',
        time: currentCandle.time,
      },
      ...prev,
    ]);

    toast.success(
      isEn
        ? `Position closed: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl}`
        : `Position clôturée : ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl}`
    );
  };

  // Performance calculations
  const totalPnL = useMemo(
    () => Math.round(tradeLogs.reduce((acc, t) => acc + t.pnl, 0) * 100) / 100,
    [tradeLogs]
  );
  const winCount = useMemo(() => tradeLogs.filter((t) => t.pnl > 0).length, [tradeLogs]);
  const lossCount = useMemo(() => tradeLogs.filter((t) => t.pnl < 0).length, [tradeLogs]);
  const winRate = useMemo(
    () => (tradeLogs.length > 0 ? Math.round((winCount / tradeLogs.length) * 100) : 0),
    [tradeLogs, winCount]
  );

  return (
    <div className="space-y-4">
      {/* Top Header & Account Status Card */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md">
              <Zap className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('backtestTitle')}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t('backtestSubtitle')}
          </p>
        </div>

        {/* Real Capital & Performance Badge Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 border border-gray-200 dark:border-gray-800 dark:bg-gray-800/70">
            <Wallet className="h-4 w-4 text-brand-500" />
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">
                {t('balance')}
              </span>
              <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 border border-gray-200 dark:border-gray-800 dark:bg-gray-800/70">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">
                {t('equity')}
              </span>
              <span
                className={`font-mono text-xs font-bold ${
                  equity >= balance ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                ${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={handleResetCapital}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            title={t('resetCapital')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('resetCapital')}</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Settings className="h-4 w-4" />
            {t('candleStyle')}
          </Button>
        </div>
      </div>

      {/* Settings Drawer / Panel */}
      {settingsOpen && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2.5 dark:border-gray-800">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-brand-500" />
              {isEn ? 'Chart Customization' : 'Personnalisation du Graphique'}
            </h3>
            <button
              onClick={() => setSettingsOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Chart Type */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                {t('candleType')}
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {CHART_TYPES.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {isEn ? ct.labelEn : ct.labelFr}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Theme */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                {t('chartBg')}
              </label>
              <select
                value={chartTheme.id}
                onChange={(e) => setChartTheme(THEME_COLORS.find((th) => th.id === e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {THEME_COLORS.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bullish Color */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                {t('upColor')}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={upColor}
                  onChange={(e) => setUpColor(e.target.value)}
                  className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-xs">{upColor}</span>
              </div>
            </div>

            {/* Bearish Color */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                {t('downColor')}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={downColor}
                  onChange={(e) => setDownColor(e.target.value)}
                  className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-xs">{downColor}</span>
              </div>
            </div>
          </div>

          {/* Indicators */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-4 text-xs font-medium">
            <span className="text-gray-500 font-semibold">{t('indicators')}:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA9}
                onChange={(e) => setShowEMA9(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span className="text-amber-400 font-bold">EMA 9</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA21}
                onChange={(e) => setShowEMA21(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span className="text-orange-400 font-bold">EMA 21</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA50}
                onChange={(e) => setShowEMA50(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span className="text-cyan-400 font-bold">EMA 50</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA200}
                onChange={(e) => setShowEMA200(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span className="text-purple-400 font-bold">EMA 200</span>
            </label>
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar to optimize Chart Space */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 rounded-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'chart'
                ? 'bg-brand-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <LineChartIcon className="h-3.5 w-3.5" />
            <span>{t('chartTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'orders'
                ? 'bg-brand-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span>{t('ordersTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'positions'
                ? 'bg-brand-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>{t('positionsTab')}</span>
            {(activePositions.length > 0 || pendingOrders.length > 0) && (
              <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {activePositions.length + pendingOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-brand-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            <span>{t('historyTab')}</span>
            {tradeLogs.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 dark:bg-gray-700 px-1.5 py-0.2 text-[10px] font-bold text-gray-700 dark:text-gray-300">
                {tradeLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Floating Quick Summary when outside chart tab */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-gray-500 font-sans">{selectedPair.label} ({timeframe}):</span>
          <span className="font-bold text-cyan-400">{formatPrice(currentPrice)}</span>
          <span className={`font-bold ${floatingPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            P&L: {floatingPnl >= 0 ? `+$${floatingPnl}` : `-$${Math.abs(floatingPnl)}`}
          </span>
        </div>
      </div>

      {/* TAB 1: FULL SCREEN CHART & COMPACT REPLAY CONTROLS */}
      <div className={activeTab === 'chart' ? 'space-y-3' : 'hidden'}>
        {/* Compact Dropdown Bar: Category, Pair, Timeframe, Unlimited Bars */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Category Dropdown (Menu déroulant to save space) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 hidden sm:inline">
                {t('assetCategory')}:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setSelectedCategory(newCat);
                  const first = ALL_PAIRS.find((p) => p.category === newCat);
                  if (first) setSelectedPair(first);
                }}
                className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {isEn ? cat.labelEn : cat.labelFr}
                  </option>
                ))}
              </select>
            </div>

            {/* Pair Selector Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 hidden sm:inline">
                {t('pairSymbol')}:
              </span>
              <select
                value={selectedPair.symbol}
                onChange={(e) => {
                  const p = ALL_PAIRS.find((x) => x.symbol === e.target.value);
                  if (p) setSelectedPair(p);
                }}
                className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {filteredPairs.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 hidden sm:inline">TF:</span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Unlimited Candles Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 hidden sm:inline">
                {isEn ? 'History:' : 'Historique:'}
              </span>
              <select
                value={candleLimit}
                onChange={(e) => setCandleLimit(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value={500}>500 {isEn ? 'bars' : 'bougies'}</option>
                <option value={1000}>1000 {isEn ? 'bars' : 'bougies'}</option>
                <option value={2000}>2000 {isEn ? 'bars' : 'bougies'}</option>
                <option value={5000}>{t('unlimitedBars')}</option>
              </select>
            </div>
          </div>

          {/* Quick status */}
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-bold text-brand-600 dark:text-brand-300">
              {replayIndex} / {allCandles.length} bars
            </span>
            <Button
              variant="secondary"
              onClick={fetchCandles}
              loading={loading}
              className="flex items-center gap-1 text-[11px] py-1 px-2.5"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{t('refresh')}</span>
            </Button>
          </div>
        </div>

        {/* Replay Trading Controls Bar (TradingView Replica) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-slate-900 p-2.5 shadow-md dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Chart Cut Replay Button */}
            <button
              onClick={() => {
                setCutMode(!cutMode);
                if (!cutMode) {
                  toast(
                    isEn
                      ? 'Scissors Active: Click any historical candle on the chart to cut time.'
                      : 'Ciseaux Actifs : Cliquez sur la bougie souhaitée sur le graphique pour couper le temps.',
                    { icon: '✂️' }
                  );
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                cutMode
                  ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Scissors className="h-3.5 w-3.5" />
              {cutMode ? t('cutActive') : t('cutBar')}
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={replayIndex >= allCandles.length}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white transition ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? t('pause') : t('play')}
            </button>

            {/* Step Back (-1 candle) */}
            <button
              onClick={stepBack}
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              title={t('stepBack')}
            >
              <SkipBack className="h-3.5 w-3.5" />
              <span>-1</span>
            </button>

            {/* Step Forward (+1 candle) */}
            <button
              onClick={stepForward}
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              title={t('stepForward')}
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span>+1</span>
            </button>

            {/* Restart Replay from Cut Point */}
            <button
              onClick={restartReplay}
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              title={t('reset')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isEn ? 'Restart' : 'Début'}</span>
            </button>
          </div>

          {/* Speed Controls (0.5x, 1x, 2x, 3x, 4x, 5x) */}
          <div className="flex items-center gap-1 bg-slate-950/80 rounded-lg px-2 py-1 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline">
              {t('speed')}:
            </span>
            <button
              onClick={() => setPlaybackSpeed((s) => Math.max(0.5, s - 0.5))}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="font-mono text-xs font-bold text-cyan-400 min-w-7 text-center">
              {playbackSpeed}x
            </span>
            <button
              onClick={() => setPlaybackSpeed((s) => Math.min(5, s + 1))}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
            {[1, 2, 3, 4].map((sp) => (
              <button
                key={sp}
                onClick={() => setPlaybackSpeed(sp)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  playbackSpeed === sp
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        {/* Main Interactive Chart Canvas - Extended Height to Cover Screen */}
        <div className="relative rounded-2xl border border-gray-200 overflow-hidden shadow-xl dark:border-gray-800">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
              <Spinner />
              <p className="mt-2 text-xs font-semibold text-cyan-300">
                {isEn ? 'Loading real-time market data...' : 'Chargement du flux en temps réel...'}
              </p>
            </div>
          )}

          <div
            ref={chartContainerRef}
            className={`w-full min-h-[620px] ${cutMode ? 'cursor-crosshair' : 'cursor-default'}`}
          />

          {/* Chart Watermark Overlay */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col text-[11px] font-mono text-slate-500/70 select-none">
            <span className="font-bold text-slate-400">
              {selectedPair.label} · {timeframe} · 100% REAL HISTORICAL FEED
            </span>
            <span>
              {isEn
                ? 'Drag Price scale vertically / Drag Time scale horizontally / Pinch to zoom'
                : 'Échelle de prix étirable verticalement / Échelle de temps étirable'}
            </span>
          </div>

          {/* Quick Floating Action Dock over Chart */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-lg">
            <button
              onClick={() => setActiveTab('orders')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 shadow transition"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{isEn ? 'Place Order' : 'Placer Ordre'}</span>
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                {activePositions.length} {isEn ? 'Open' : 'Actifs'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 2: DEDICATED ORDER PLACEMENT DESK */}
      {activeTab === 'orders' && (
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                {t('ordersTab')} — {selectedPair.label} ({timeframe})
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {isEn
                  ? 'Simulate professional position execution with realistic lot sizing and automatic SL/TP tracking.'
                  : 'Simulez une véritable prise de position avec gestion réaliste des lots et déclenchement automatique SL/TP.'}
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                {isEn ? 'Replay Price' : 'Prix Replay'}
              </span>
              <span className="text-lg font-black text-cyan-400">{formatPrice(currentPrice)}</span>
            </div>
          </div>

          {/* Account Snapshot Bar */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50 text-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">{t('balance')}</span>
              <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">{t('equity')}</span>
              <span
                className={`font-mono text-sm font-bold ${
                  equity >= balance ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                ${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">{t('floatingPnl')}</span>
              <span
                className={`font-mono text-sm font-bold ${
                  floatingPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {floatingPnl >= 0 ? `+$${floatingPnl}` : `-$${Math.abs(floatingPnl)}`}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Order Type */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
                {t('orderType')}
              </label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'BUY', label: t('marketBuy'), color: 'emerald' },
                  { id: 'SELL', label: t('marketSell'), color: 'rose' },
                  { id: 'BUY_LIMIT', label: t('buyLimit'), color: 'cyan' },
                  { id: 'SELL_LIMIT', label: t('sellLimit'), color: 'cyan' },
                  { id: 'BUY_STOP', label: t('buyStop'), color: 'amber' },
                  { id: 'SELL_STOP', label: t('sellStop'), color: 'amber' },
                ].map((ot) => (
                  <button
                    key={ot.id}
                    type="button"
                    onClick={() => setOrderType(ot.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold border transition ${
                      orderType === ot.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 ring-2 ring-brand-500/50'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {ot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lot Size Configuration (starts at 0.01 for forex, custom for others) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
                  {t('lotInput')}
                </label>
                <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400 font-semibold">
                  {lotConfig.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  step={lotConfig.step}
                  min={lotConfig.min}
                  max="500"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono font-bold dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <div className="flex gap-1">
                  {[0.01, 0.05, 0.1, 0.5, 1.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLotSize(preset)}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-mono font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {preset}L
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Entry (for pending orders) */}
            {['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType) && (
              <div>
                <label className="text-xs font-bold uppercase text-cyan-500">
                  {t('entry')} ({isEn ? 'Target Price' : 'Prix Cible'})
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder={`ex: ${formatPrice(currentPrice)}`}
                  value={customEntry}
                  onChange={(e) => setCustomEntry(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-cyan-400 bg-cyan-50/20 px-3 py-2 text-sm font-mono font-bold dark:bg-cyan-950/20 dark:text-white"
                />
              </div>
            )}

            {/* Stop Loss & Take Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-rose-500 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  {t('stopLoss')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="SL Price"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                {stopLoss && currentPrice && (
                  <p className="mt-1 text-[11px] font-mono text-rose-500">
                    Risque: $
                    {Math.abs(
                      calculateTradePnl(
                        {
                          symbol: selectedPair.symbol,
                          category: selectedPair.category,
                          type: orderType.startsWith('SELL') ? 'SELL' : 'BUY',
                          entry: currentPrice,
                          lots: parseFloat(lotSize) || 0.1,
                        },
                        parseFloat(stopLoss)
                      )
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-emerald-500 flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  {t('takeProfit')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="TP Price"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                {takeProfit && currentPrice && (
                  <p className="mt-1 text-[11px] font-mono text-emerald-500">
                    Gain estimé: +$
                    {Math.abs(
                      calculateTradePnl(
                        {
                          symbol: selectedPair.symbol,
                          category: selectedPair.category,
                          type: orderType.startsWith('SELL') ? 'SELL' : 'BUY',
                          entry: currentPrice,
                          lots: parseFloat(lotSize) || 0.1,
                        },
                        parseFloat(takeProfit)
                      )
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Execution Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant={orderType.startsWith('SELL') ? 'danger' : 'primary'}
                onClick={handlePlaceOrder}
                className="flex-1 font-bold py-3 text-sm flex items-center justify-center gap-2"
              >
                {orderType.startsWith('SELL') ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                {isEn ? `Execute ${orderType} Order` : `Exécuter Ordre ${orderType}`}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setActiveTab('chart')}
                className="py-3 px-4 text-xs font-bold"
              >
                {isEn ? 'Return to Chart' : 'Retour au Graphique'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE POSITIONS & PENDING ORDERS */}
      {activeTab === 'positions' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-brand-500" />
                {t('openPositions')} ({activePositions.length}) &amp; {t('pendingOrders')} ({pendingOrders.length})
              </h2>
              <span className="font-mono text-xs font-bold">
                P&L Flottant Total:{' '}
                <span className={floatingPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {floatingPnl >= 0 ? `+$${floatingPnl}` : `-$${Math.abs(floatingPnl)}`}
                </span>
              </span>
            </div>

            {activePositions.length === 0 && pendingOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <p>
                  {isEn
                    ? 'No active positions or pending orders. Click Place Order to start trading on the replay.'
                    : 'Aucune position active ou ordre en attente. Cliquez sur Passer un Ordre pour commencer.'}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('orders')}
                  className="mt-3 text-xs"
                >
                  {t('ordersTab')}
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {/* Active Positions Table */}
                {activePositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-xs dark:border-gray-800 dark:bg-gray-800/70"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          pos.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {pos.type} {pos.lots}L
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {pos.symbol}
                      </span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {isEn ? 'Entry:' : 'Entrée:'} {formatPrice(pos.entry)}
                      </span>
                      <span className="font-mono text-cyan-400">
                        {isEn ? 'Now:' : 'Actuel:'} {formatPrice(currentPrice)}
                      </span>
                      {pos.sl && (
                        <span className="font-mono text-rose-400">
                          SL: {formatPrice(pos.sl)}
                        </span>
                      )}
                      {pos.tp && (
                        <span className="font-mono text-emerald-400">
                          TP: {formatPrice(pos.tp)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span
                        className={`font-mono text-sm font-black ${
                          pos.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {pos.pnl >= 0 ? `+$${pos.pnl}` : `-$${Math.abs(pos.pnl)}`}
                      </span>
                      <button
                        onClick={() => closePositionManually(pos.id)}
                        className="rounded-lg bg-rose-600/20 px-3 py-1 text-xs font-bold text-rose-400 hover:bg-rose-600/30 transition"
                      >
                        {isEn ? 'Close Position' : 'Clôturer Position'}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pending Orders */}
                {pendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/10 p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300">
                        PENDING {ord.type}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{ord.symbol}</span>
                      <span className="font-mono text-cyan-200">
                        {isEn ? 'Target:' : 'Cible:'} {formatPrice(ord.entry)} ({ord.lots}L)
                      </span>
                    </div>
                    <button
                      onClick={() => setPendingOrders((p) => p.filter((x) => x.id !== ord.id))}
                      className="text-gray-400 hover:text-rose-400 p-1"
                      title={t('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TRADE HISTORY & PERFORMANCE JOURNAL */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('totalTrades')}</span>
              <p className="font-mono text-xl font-black text-gray-900 dark:text-white mt-1">
                {tradeLogs.length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('winrate')}</span>
              <p className="font-mono text-xl font-black text-brand-600 dark:text-brand-400 mt-1">
                {winRate}%
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">
                {isEn ? 'Wins / Losses' : 'Gains / Pertes'}
              </span>
              <p className="font-mono text-xl font-black text-gray-900 dark:text-white mt-1">
                <span className="text-emerald-500">{winCount}</span> /{' '}
                <span className="text-rose-500">{lossCount}</span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('netPnl')}</span>
              <p
                className={`font-mono text-xl font-black mt-1 ${
                  totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {totalPnL >= 0 ? `+$${totalPnL}` : `-$${Math.abs(totalPnL)}`}
              </p>
            </div>
          </div>

          {/* Trade History Table */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-brand-500" />
                {t('historyTab')}
              </h2>
              {tradeLogs.length > 0 && (
                <button
                  onClick={() => setTradeLogs([])}
                  className="text-xs text-rose-500 hover:text-rose-400"
                >
                  {isEn ? 'Clear History' : 'Effacer l\'historique'}
                </button>
              )}
            </div>

            {tradeLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                {isEn
                  ? 'No executed trades yet. Trades closed during replay will appear here.'
                  : 'Aucun trade exécuté pour le moment. Vos trades clôturés en replay apparaîtront ici.'}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] uppercase text-gray-400">
                      <th className="py-2">{isEn ? 'Asset' : 'Actif'}</th>
                      <th className="py-2">{isEn ? 'Type' : 'Sens'}</th>
                      <th className="py-2">Lots</th>
                      <th className="py-2">{isEn ? 'Entry' : 'Entrée'}</th>
                      <th className="py-2">{isEn ? 'Exit' : 'Sortie'}</th>
                      <th className="py-2">P&L ($)</th>
                      <th className="py-2">{isEn ? 'Reason' : 'Motif'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {tradeLogs.map((trade) => (
                      <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2.5 font-bold">{trade.symbol}</td>
                        <td className="py-2.5">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              trade.type === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono">{trade.lots}</td>
                        <td className="py-2.5 font-mono">{formatPrice(trade.entry)}</td>
                        <td className="py-2.5 font-mono">{formatPrice(trade.exit)}</td>
                        <td
                          className={`py-2.5 font-mono font-bold ${
                            trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {trade.pnl >= 0 ? `+$${trade.pnl}` : `-$${Math.abs(trade.pnl)}`}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                            {trade.reason === 'TAKE_PROFIT' && '🎯 Take Profit'}
                            {trade.reason === 'STOP_LOSS' && '🛑 Stop Loss'}
                            {trade.reason === 'MANUAL_CLOSE' && '✋ Clôture Manuelle'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
