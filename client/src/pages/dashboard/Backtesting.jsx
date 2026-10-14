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
  Eye,
  Settings,
  Plus,
  Minus,
  Clock,
  Crosshair,
  BarChart2,
  DollarSign,
  Maximize2,
  HelpCircle,
  Shield,
  Trash2,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { marketApi } from '../../services/endpoints.js';
import { formatPrice } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

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
  { id: 'dark', label: 'TradingView Dark', bg: '#131722', text: '#d1d4dc', grid: '#1e222d' },
  { id: 'black', label: 'OLED Black', bg: '#000000', text: '#9ca3af', grid: '#111827' },
  { id: 'slate', label: 'Navy Slate', bg: '#0b0f19', text: '#94a3b8', grid: '#1e293b' },
  { id: 'light', label: 'TradingView Light', bg: '#ffffff', text: '#191919', grid: '#f0f3fa' },
];

export default function Backtesting() {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';

  // Selection state
  const [selectedCategory, setSelectedCategory] = useState('forex');
  const [selectedPair, setSelectedPair] = useState(ALL_PAIRS[0]);
  const [timeframe, setTimeframe] = useState('H1');
  const [candleLimit, setCandleLimit] = useState(250);

  // Raw dataset and replay pointer
  const [allCandles, setAllCandles] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0); // number of bars currently revealed
  const [cutIndex, setCutIndex] = useState(0); // where the cut was placed
  const [cutMode, setCutMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.5x, 1x, 2x, 3x, 4x, 5x
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
  const [showAsianSession, setShowAsianSession] = useState(false);
  const [showLondonSession, setShowLondonSession] = useState(false);
  const [showNYSession, setShowNYSession] = useState(false);

  // Order Execution & Simulation State
  const [orderType, setOrderType] = useState('BUY'); // BUY, SELL, BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP
  const [lotSize, setLotSize] = useState(1.0);
  const [customEntry, setCustomEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [activePositions, setActivePositions] = useState([]); // [{ id, type, entry, lots, sl, tp, pnl, openTime }]
  const [pendingOrders, setPendingOrders] = useState([]); // [{ id, type, entry, lots, sl, tp }]
  const [tradeLogs, setTradeLogs] = useState([]); // [{ id, symbol, type, entry, exit, pnl, result, rr }]

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

  // Load candle data from server
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setIsPlaying(false);
    try {
      const { data } = await marketApi.snapshot(selectedPair.symbol, timeframe, candleLimit);
      const raw = data?.data?.market?.candles || [];
      if (raw.length > 0) {
        // Ensure strictly sorted by time ascending with valid timestamps
        const sorted = raw
          .map((c, i) => {
            const t = typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time || Date.now() - (raw.length - i) * 3600000).getTime() / 1000);
            return {
              time: t,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            };
          })
          .sort((a, b) => a.time - b.time);

        setAllCandles(sorted);
        // Default cut: show initial 60% of candles to allow replay forward
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
      toast.error(isEn ? 'Failed to fetch market data.' : 'Erreur de chargement des données.');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, timeframe, candleLimit, isEn]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

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

  // Build and Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
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

    // Add Main Series according to chartType
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

    // Handle Click on Chart for Cut Replay Tool
    chart.subscribeClick((param) => {
      if (!cutMode || !param.time) return;
      const clickedTime = param.time;
      const idx = allCandles.findIndex((c) => c.time === clickedTime);
      if (idx !== -1) {
        const newCut = idx + 1;
        setCutIndex(newCut);
        setReplayIndex(newCut);
        setCutMode(false);
        toast.success(
          isEn
            ? `Chart cut at bar #${newCut}. Replay initialized!`
            : `Graphique coupé à la bougie #${newCut}. Replay prêt !`
        );
      }
    });

    // Resize observer for responsive fluid scaling
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
  }, [chartTheme, chartType, upColor, downColor, showEMA9, showEMA21, showEMA50, showEMA200, cutMode, allCandles, isEn]);

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

    // Update EMA series
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

  // Order Matching & PnL Simulation logic per bar
  const evaluateOrdersAtBar = useCallback(
    (currentCandle) => {
      if (!currentCandle) return;

      const { high, low, close } = currentCandle;

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
                type: ord.type.startsWith('BUY') ? 'BUY' : 'SELL',
                entry: ord.entry,
                lots: ord.lots,
                sl: ord.sl,
                tp: ord.tp,
                openTime: currentCandle.time,
                pnl: 0,
              },
            ]);
          } else {
            remaining.push(ord);
          }
        });
        return remaining;
      });

      // 2. Check Open Positions for SL / TP hits and update PnL
      setActivePositions((prevPositions) => {
        const stillOpen = [];
        prevPositions.forEach((pos) => {
          let closed = false;
          let exitPrice = close;
          let exitReason = '';

          // Check SL
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

          // Check TP
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
            const multiplier = pos.type === 'BUY' ? 1 : -1;
            const diff = (exitPrice - pos.entry) * multiplier;
            // PnL in dollars estimation
            const pnl = Math.round(diff * pos.lots * 100000 * 10) / 10;
            toast(
              exitReason === 'TAKE_PROFIT'
                ? `🎯 ${pos.type} TAKE PROFIT HIT: +$${Math.abs(pnl)}`
                : `🛑 ${pos.type} STOP LOSS HIT: -$${Math.abs(pnl)}`,
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
                symbol: selectedPair.symbol,
                type: pos.type,
                lots: pos.lots,
                entry: pos.entry,
                exit: exitPrice,
                pnl,
                reason: exitReason,
                time: currentCandle.time,
              },
              ...logs,
            ]);
          } else {
            // Update floating PnL
            const multiplier = pos.type === 'BUY' ? 1 : -1;
            const diff = (close - pos.entry) * multiplier;
            const floatingPnl = Math.round(diff * pos.lots * 100000 * 10) / 10;
            stillOpen.push({ ...pos, pnl: floatingPnl });
          }
        });
        return stillOpen;
      });
    },
    [isEn, selectedPair.symbol]
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
      const currentCandle = allCandles[nextIndex - 1];
      evaluateOrdersAtBar(currentCandle);
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
    toast.success(isEn ? 'Replay reset to starting cut point.' : 'Replay réinitialisé au point de coupe.');
  };

  // Replay interval timer
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(100, Math.floor(1000 / playbackSpeed));
    const timer = setInterval(() => {
      stepForward();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, stepForward]);

  // Execute Order
  const handlePlaceOrder = () => {
    const currentCandle = allCandles[replayIndex - 1];
    if (!currentCandle) {
      toast.error(isEn ? 'No candle available.' : 'Aucune bougie disponible.');
      return;
    }

    const currentPrice = currentCandle.close;
    const isPending = ['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType);
    const entryPrice = isPending ? parseFloat(customEntry) : currentPrice;

    if (isPending && (!entryPrice || isNaN(entryPrice))) {
      toast.error(isEn ? 'Please specify an Entry Price for pending orders.' : 'Veuillez saisir un Prix d\'entrée pour cet ordre différé.');
      return;
    }

    const orderId = Date.now().toString(36);

    if (isPending) {
      setPendingOrders((prev) => [
        ...prev,
        {
          id: orderId,
          type: orderType,
          entry: entryPrice,
          lots: parseFloat(lotSize) || 1.0,
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
          type: orderType,
          entry: entryPrice,
          lots: parseFloat(lotSize) || 1.0,
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
  };

  // Close position manually
  const closePositionManually = (posId) => {
    const currentCandle = allCandles[replayIndex - 1];
    const pos = activePositions.find((p) => p.id === posId);
    if (!pos || !currentCandle) return;

    const exitPrice = currentCandle.close;
    const multiplier = pos.type === 'BUY' ? 1 : -1;
    const diff = (exitPrice - pos.entry) * multiplier;
    const pnl = Math.round(diff * pos.lots * 100000 * 10) / 10;

    setActivePositions((prev) => prev.filter((p) => p.id !== posId));
    setTradeLogs((prev) => [
      {
        id: pos.id,
        symbol: selectedPair.symbol,
        type: pos.type,
        lots: pos.lots,
        entry: pos.entry,
        exit: exitPrice,
        pnl,
        reason: 'MANUAL_CLOSE',
        time: currentCandle.time,
      },
      ...prev,
    ]);
    toast.success(isEn ? `Position closed. PnL: $${pnl}` : `Position clôturée. PnL: $${pnl}`);
  };

  // Performance calculations
  const totalPnL = useMemo(() => tradeLogs.reduce((acc, t) => acc + t.pnl, 0), [tradeLogs]);
  const winCount = useMemo(() => tradeLogs.filter((t) => t.pnl > 0).length, [tradeLogs]);
  const winRate = useMemo(
    () => (tradeLogs.length > 0 ? Math.round((winCount / tradeLogs.length) * 100) : 0),
    [tradeLogs, winCount]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md">
              <Zap className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('backtestTitle')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('backtestSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Settings className="h-4 w-4" />
            {t('candleStyle')}
          </Button>
          <Button
            variant="primary"
            onClick={fetchCandles}
            loading={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <Activity className="h-4 w-4" />
            {isEn ? 'Reload Real Data' : 'Actualiser Flux Réel'}
          </Button>
        </div>
      </div>

      {/* Settings Drawer / Panel */}
      {settingsOpen && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-brand-500" />
              {isEn ? 'TradingView Chart Customization' : 'Personnalisation du Graphique TradingView'}
            </h3>
            <button
              onClick={() => setSettingsOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Chart Type */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {t('candleType')}
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {t('chartBg')}
              </label>
              <select
                value={chartTheme.id}
                onChange={(e) => setChartTheme(THEME_COLORS.find((th) => th.id === e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {t('upColor')}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={upColor}
                  onChange={(e) => setUpColor(e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-xs">{upColor}</span>
              </div>
            </div>

            {/* Bearish Color */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {t('downColor')}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={downColor}
                  onChange={(e) => setDownColor(e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-xs">{downColor}</span>
              </div>
            </div>
          </div>

          {/* Indicators & Sessions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-4 text-xs font-medium">
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

      {/* Asset Selection & Timeframe Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
          {ASSET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                const first = ALL_PAIRS.find((p) => p.category === cat.id);
                if (first) setSelectedPair(first);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {isEn ? cat.labelEn : cat.labelFr}
            </button>
          ))}
        </div>

        {/* Pair, Timeframe, Limit, Replay Trigger Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Pair Selector */}
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                {isEn ? 'Symbol / Pair' : 'Actif / Paire'}
              </span>
              <select
                value={selectedPair.symbol}
                onChange={(e) => {
                  const p = ALL_PAIRS.find((x) => x.symbol === e.target.value);
                  if (p) setSelectedPair(p);
                }}
                className="mt-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {filteredPairs.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Selector Dropdown */}
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                Timeframe
              </span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="mt-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Candle History Limit */}
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                {isEn ? 'History Depth' : 'Profondeur Historique'}
              </span>
              <select
                value={candleLimit}
                onChange={(e) => setCandleLimit(Number(e.target.value))}
                className="mt-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value={100}>100 {isEn ? 'bars' : 'bougies'}</option>
                <option value={200}>200 {isEn ? 'bars' : 'bougies'}</option>
                <option value={300}>300 {isEn ? 'bars' : 'bougies'}</option>
                <option value={500}>500 {isEn ? 'bars' : 'bougies'}</option>
              </select>
            </div>
          </div>

          {/* Current Live Replay Status */}
          <div className="flex items-center gap-3">
            <span className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 font-mono text-xs font-bold text-brand-600 dark:text-brand-300">
              {isEn ? 'Bar' : 'Bougie'} {replayIndex} / {allCandles.length}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {isEn ? 'Live Market Engine' : 'Moteur Temps Réel'}
            </span>
          </div>
        </div>
      </div>

      {/* Replay Trading Controls Bar (TradingView Replica) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-slate-900 p-3 shadow-md dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
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
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
              cutMode
                ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Scissors className="h-4 w-4" />
            {cutMode ? t('cutActive') : t('cutBar')}
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={replayIndex >= allCandles.length}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? t('pause') : t('play')}
          </button>

          {/* Step Back (-1 candle) */}
          <button
            onClick={stepBack}
            className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            title={t('stepBack')}
          >
            <SkipBack className="h-4 w-4" />
            <span>-1</span>
          </button>

          {/* Step Forward (+1 candle) */}
          <button
            onClick={stepForward}
            className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            title={t('stepForward')}
          >
            <SkipForward className="h-4 w-4" />
            <span>+1</span>
          </button>

          {/* Restart Replay from Cut Point */}
          <button
            onClick={restartReplay}
            className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            title={t('reset')}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isEn ? 'Restart' : 'Début'}</span>
          </button>
        </div>

        {/* Speed Controls (0.5x, 1x, 2x, 3x, 4x, 5x) */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 rounded-xl px-2.5 py-1 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
            {t('speed')}:
          </span>
          <button
            onClick={() => setPlaybackSpeed((s) => Math.max(0.5, s - 0.5))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="font-mono text-xs font-bold text-cyan-400 min-w-8 text-center">
            {playbackSpeed}x
          </span>
          <button
            onClick={() => setPlaybackSpeed((s) => Math.min(5, s + 1))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Plus className="h-3 w-3" />
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

      {/* Main Interactive Chart Canvas */}
      <div className="relative rounded-2xl border border-gray-200 overflow-hidden shadow-xl dark:border-gray-800">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <Spinner />
            <p className="mt-2 text-xs font-semibold text-cyan-300">
              {isEn ? 'Rendering TradingView engine...' : 'Chargement du moteur TradingView...'}
            </p>
          </div>
        )}

        {/* TradingView Chart Container (Pinch zoom, drag time scale, drag price scale) */}
        <div
          ref={chartContainerRef}
          className={`w-full min-h-[520px] ${cutMode ? 'cursor-crosshair' : 'cursor-default'}`}
        />

        {/* Chart Watermark Overlay */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col text-[11px] font-mono text-slate-500/70 select-none">
          <span className="font-bold text-slate-400">
            {selectedPair.label} · {timeframe} · REAL-TIME FEED
          </span>
          <span>{isEn ? 'Drag Price scale vertically / Drag Time scale horizontally' : 'Échelle de prix étirable verticalement / Échelle de temps étirable'}</span>
        </div>
      </div>

      {/* Order Execution & Simulation Station (BUY, SELL, LIMIT, STOP) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Order Placement Box */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            {isEn ? 'Simulator Order Desk' : 'Simulateur de Prise d\'Ordres'}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {isEn
              ? 'Execute market or pending orders. The engine tracks your positions through replay candles.'
              : 'Passez des ordres au marché ou différés. Le moteur suit vos positions au fil des bougies.'}
          </p>

          <div className="mt-4 space-y-3">
            {/* Order Type Selection */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500">
                {t('orderType')}
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="BUY">{t('marketBuy')}</option>
                <option value="SELL">{t('marketSell')}</option>
                <option value="BUY_LIMIT">{t('buyLimit')}</option>
                <option value="SELL_LIMIT">{t('sellLimit')}</option>
                <option value="BUY_STOP">{t('buyStop')}</option>
                <option value="SELL_STOP">{t('sellStop')}</option>
              </select>
            </div>

            {/* Lot Size */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500">
                {t('lotInput')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Entry Price (for pending orders) */}
            {['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType) && (
              <div>
                <label className="text-[10px] font-bold uppercase text-cyan-500">
                  {t('entry')} ({isEn ? 'Target Price' : 'Prix Cible'})
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="ex: 1.0845"
                  value={customEntry}
                  onChange={(e) => setCustomEntry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-cyan-400 bg-cyan-50/20 px-3 py-2 text-xs font-mono font-bold dark:bg-cyan-950/20 dark:text-white"
                />
              </div>
            )}

            {/* Stop Loss & Take Profit */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-rose-500">
                  {t('stopLoss')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="SL Price"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-emerald-500">
                  {t('takeProfit')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="TP Price"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            {/* Order Execution Button */}
            <Button
              variant={orderType.startsWith('SELL') ? 'danger' : 'primary'}
              onClick={handlePlaceOrder}
              className="w-full mt-2 font-bold py-2.5 text-xs flex items-center justify-center gap-2"
            >
              {orderType.startsWith('SELL') ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              {isEn ? `Place ${orderType}` : `Exécuter Ordre ${orderType}`}
            </Button>
          </div>
        </div>

        {/* Active Positions & Pending Orders */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-500" />
                {t('openPositions')} ({activePositions.length}) &amp; {t('pendingOrders')} ({pendingOrders.length})
              </h3>
            </div>

            {activePositions.length === 0 && pendingOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                {isEn
                  ? 'No active positions or pending orders. Use the order desk on the left to trade.'
                  : 'Aucune position active ou ordre en attente. Utilisez le panneau d\'ordre à gauche.'}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {/* Active Positions */}
                {activePositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          pos.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {pos.type} {pos.lots}L
                      </span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {isEn ? 'Entry:' : 'Entrée :'} {formatPrice(pos.entry)}
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

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold ${
                          pos.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {pos.pnl >= 0 ? `+$${pos.pnl}` : `-$${Math.abs(pos.pnl)}`}
                      </span>
                      <button
                        onClick={() => closePositionManually(pos.id)}
                        className="rounded bg-rose-600/20 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-600/30"
                      >
                        {isEn ? 'Close' : 'Clôturer'}
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
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300">
                        PENDING {ord.type}
                      </span>
                      <span className="font-mono text-cyan-200">
                        {isEn ? 'Target:' : 'Cible :'} {formatPrice(ord.entry)} ({ord.lots}L)
                      </span>
                    </div>
                    <button
                      onClick={() => setPendingOrders((p) => p.filter((x) => x.id !== ord.id))}
                      className="text-gray-400 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('totalTrades')}</span>
              <p className="font-mono text-lg font-black text-gray-900 dark:text-white">
                {tradeLogs.length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('winrate')}</span>
              <p className="font-mono text-lg font-black text-brand-600 dark:text-brand-400">
                {winRate}%
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[10px] uppercase font-bold text-gray-500">{t('netPnl')}</span>
              <p
                className={`font-mono text-lg font-black ${
                  totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {totalPnL >= 0 ? `+$${totalPnL}` : `-$${Math.abs(totalPnL)}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
