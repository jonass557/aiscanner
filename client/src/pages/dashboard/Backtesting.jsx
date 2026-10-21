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
  Minimize2,
  Trash2,
  RefreshCw,
  Wallet,
  Clock,
  Briefcase,
  ListOrdered,
  History as HistoryIcon,
  LineChart as LineChartIcon,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Target,
  PlusCircle,
  PenTool,
  MousePointer,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Ruler,
  Eye,
  X,
  CandlestickChart,
  Sparkles,
  Calendar,
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
  { id: 'forex', labelFr: 'Forex', labelEn: 'Forex' },
  { id: 'commodities', labelFr: 'Matières & Métaux', labelEn: 'Commodities & Metals' },
  { id: 'indices', labelFr: 'Indices Mondiaux', labelEn: 'World Indices' },
  { id: 'crypto', labelFr: 'Crypto (Binance)', labelEn: 'Crypto (Binance)' },
  { id: 'synthetic', labelFr: 'Indices Synthétiques', labelEn: 'Synthetics' },
];

const ALL_PAIRS = [
  // Forex - Paires Majeures
  { symbol: 'EURUSD', category: 'forex', subgroup: 'Majeures', label: 'EUR/USD · Euro / Dollar US', base: 1.0865 },
  { symbol: 'GBPUSD', category: 'forex', subgroup: 'Majeures', label: 'GBP/USD · Livre / Dollar US', base: 1.271 },
  { symbol: 'USDJPY', category: 'forex', subgroup: 'Majeures', label: 'USD/JPY · Dollar US / Yen', base: 156.2 },
  { symbol: 'USDCHF', category: 'forex', subgroup: 'Majeures', label: 'USD/CHF · Dollar US / Franc Suisse', base: 0.904 },
  { symbol: 'AUDUSD', category: 'forex', subgroup: 'Majeures', label: 'AUD/USD · Dollar Australien / US', base: 0.664 },
  { symbol: 'USDCAD', category: 'forex', subgroup: 'Majeures', label: 'USD/CAD · Dollar US / Canadien', base: 1.368 },
  { symbol: 'NZDUSD', category: 'forex', subgroup: 'Majeures', label: 'NZD/USD · Dollar NZ / Dollar US', base: 0.61 },

  // Forex - Paires Mineures (Crosses)
  { symbol: 'EURGBP', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/GBP · Euro / Livre', base: 0.855 },
  { symbol: 'EURJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/JPY · Euro / Yen', base: 169.7 },
  { symbol: 'GBPJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'GBP/JPY · Livre / Yen', base: 198.4 },
  { symbol: 'EURAUD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/AUD · Euro / Aussie', base: 1.636 },
  { symbol: 'EURCAD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/CAD · Euro / Dollar Canadien', base: 1.486 },
  { symbol: 'EURCHF', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/CHF · Euro / Franc Suisse', base: 0.982 },
  { symbol: 'EURNZD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'EUR/NZD · Euro / Dollar NZ', base: 1.778 },
  { symbol: 'GBPAUD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'GBP/AUD · Livre / Aussie', base: 1.913 },
  { symbol: 'GBPCAD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'GBP/CAD · Livre / Dollar Canadien', base: 1.738 },
  { symbol: 'GBPCHF', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'GBP/CHF · Livre / Franc Suisse', base: 1.148 },
  { symbol: 'GBPNZD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'GBP/NZD · Livre / Dollar NZ', base: 2.082 },
  { symbol: 'AUDCAD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'AUD/CAD · Aussie / Dollar Canadien', base: 0.908 },
  { symbol: 'AUDCHF', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'AUD/CHF · Aussie / Franc Suisse', base: 0.601 },
  { symbol: 'AUDJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'AUD/JPY · Aussie / Yen', base: 103.7 },
  { symbol: 'AUDNZD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'AUD/NZD · Aussie / Kiwi', base: 1.088 },
  { symbol: 'CADCHF', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'CAD/CHF · Dollar Canadien / Franc', base: 0.661 },
  { symbol: 'CADJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'CAD/JPY · Dollar Canadien / Yen', base: 114.2 },
  { symbol: 'CHFJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'CHF/JPY · Franc Suisse / Yen', base: 172.8 },
  { symbol: 'NZDCAD', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'NZD/CAD · Kiwi / Dollar Canadien', base: 0.835 },
  { symbol: 'NZDCHF', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'NZD/CHF · Kiwi / Franc Suisse', base: 0.552 },
  { symbol: 'NZDJPY', category: 'forex', subgroup: 'Mineures (Crosses)', label: 'NZD/JPY · Kiwi / Yen', base: 95.3 },

  // Forex - Paires Exotiques
  { symbol: 'USDZAR', category: 'forex', subgroup: 'Exotiques', label: 'USD/ZAR · Dollar / Rand Sud-Africain', base: 18.25 },
  { symbol: 'USDMXN', category: 'forex', subgroup: 'Exotiques', label: 'USD/MXN · Dollar / Peso Mexicain', base: 19.85 },
  { symbol: 'USDTRY', category: 'forex', subgroup: 'Exotiques', label: 'USD/TRY · Dollar / Livre Turque', base: 34.25 },
  { symbol: 'USDBRL', category: 'forex', subgroup: 'Exotiques', label: 'USD/BRL · Dollar / Real Brésilien', base: 5.65 },
  { symbol: 'USDSEK', category: 'forex', subgroup: 'Exotiques', label: 'USD/SEK · Dollar / Couronne Suédoise', base: 10.42 },
  { symbol: 'USDNOK', category: 'forex', subgroup: 'Exotiques', label: 'USD/NOK · Dollar / Couronne Norvégienne', base: 10.88 },
  { symbol: 'USDPLN', category: 'forex', subgroup: 'Exotiques', label: 'USD/PLN · Dollar / Zloty Polonais', base: 3.96 },
  { symbol: 'USDSGD', category: 'forex', subgroup: 'Exotiques', label: 'USD/SGD · Dollar / Dollar Singapour', base: 1.312 },
  { symbol: 'USDHKD', category: 'forex', subgroup: 'Exotiques', label: 'USD/HKD · Dollar / Dollar Hong Kong', base: 7.77 },
  { symbol: 'USDCNH', category: 'forex', subgroup: 'Exotiques', label: 'USD/CNH · Dollar / Yuan Offshore', base: 7.12 },
  { symbol: 'EURTRY', category: 'forex', subgroup: 'Exotiques', label: 'EUR/TRY · Euro / Livre Turque', base: 37.2 },
  { symbol: 'EURZAR', category: 'forex', subgroup: 'Exotiques', label: 'EUR/ZAR · Euro / Rand Sud-Africain', base: 19.82 },
  { symbol: 'GBPZAR', category: 'forex', subgroup: 'Exotiques', label: 'GBP/ZAR · Livre / Rand Sud-Africain', base: 23.2 },

  // Commodities & Métaux
  { symbol: 'XAUUSD', category: 'commodities', label: 'Or (Gold / XAUUSD)', base: 2685.0 },
  { symbol: 'XAGUSD', category: 'commodities', label: 'Argent (Silver / XAGUSD)', base: 31.8 },
  { symbol: 'USOIL', category: 'commodities', label: 'Pétrole Brut (WTI)', base: 74.5 },
  { symbol: 'UKOIL', category: 'commodities', label: 'Pétrole Brent', base: 78.2 },

  // Indices Mondiaux
  { symbol: 'US30', category: 'indices', label: 'Dow Jones (US30)', base: 43250 },
  { symbol: 'NAS100', category: 'indices', label: 'Nasdaq 100 (NAS100)', base: 20450 },
  { symbol: 'SPX500', category: 'indices', label: 'S&P 500 (SPX500)', base: 5860 },
  { symbol: 'GER40', category: 'indices', label: 'DAX 40 (Allemagne)', base: 19550 },
  { symbol: 'UK100', category: 'indices', label: 'FTSE 100 (UK100)', base: 8250 },
  { symbol: 'FRA40', category: 'indices', label: 'CAC 40 (FRA40)', base: 7520 },
  { symbol: 'JPN225', category: 'indices', label: 'Nikkei 225 (JPN225)', base: 38950 },

  // Crypto (Binance)
  { symbol: 'BTCUSD', category: 'crypto', label: 'Bitcoin (BTC/USD)', base: 68400 },
  { symbol: 'ETHUSD', category: 'crypto', label: 'Ethereum (ETH/USD)', base: 2640 },
  { symbol: 'SOLUSD', category: 'crypto', label: 'Solana (SOL/USD)', base: 158.0 },
  { symbol: 'XRPUSD', category: 'crypto', label: 'XRP (XRP/USD)', base: 0.548 },
  { symbol: 'BNBUSD', category: 'crypto', label: 'BNB (BNB/USD)', base: 595 },
  { symbol: 'ADAUSD', category: 'crypto', label: 'Cardano (ADA/USD)', base: 0.355 },
  { symbol: 'DOGEUSD', category: 'crypto', label: 'Dogecoin (DOGE/USD)', base: 0.142 },

  // Indices Synthétiques (Deriv)
  { symbol: 'Volatility 75 Index', category: 'synthetic', label: 'Volatility 75 Index (V75)', base: 325400 },
  { symbol: 'Volatility 100 Index', category: 'synthetic', label: 'Volatility 100 Index (V100)', base: 1840 },
  { symbol: 'Volatility 50 Index', category: 'synthetic', label: 'Volatility 50 Index (V50)', base: 412.5 },
  { symbol: 'Volatility 25 Index', category: 'synthetic', label: 'Volatility 25 Index (V25)', base: 2450 },
  { symbol: 'Volatility 10 Index', category: 'synthetic', label: 'Volatility 10 Index (V10)', base: 1250 },
  { symbol: 'Boom 1000 Index', category: 'synthetic', label: 'Boom 1000 Index', base: 12500 },
  { symbol: 'Crash 1000 Index', category: 'synthetic', label: 'Crash 1000 Index', base: 6400 },
  { symbol: 'Boom 500 Index', category: 'synthetic', label: 'Boom 500 Index', base: 4820 },
  { symbol: 'Crash 500 Index', category: 'synthetic', label: 'Crash 500 Index', base: 3910 },
  { symbol: 'Boom 300 Index', category: 'synthetic', label: 'Boom 300 Index', base: 3200 },
  { symbol: 'Crash 300 Index', category: 'synthetic', label: 'Crash 300 Index', base: 2800 },
  { symbol: 'Step Index', category: 'synthetic', label: 'Step Index Deriv', base: 8420 },
];

export const DRAWING_TOOLS_CATEGORIES = [
  {
    id: 'lines',
    nameFr: 'Catégorie Lignes (Lines)',
    nameEn: 'Lines',
    tools: [
      { id: 'trendline', symbol: '↗', nameFr: 'Trendline (Ligne de tendance)', nameEn: 'Trendline', points: 2 },
      { id: 'ray', symbol: '➔', nameFr: 'Ray (Rayon)', nameEn: 'Ray', points: 2 },
      { id: 'horizontal', symbol: '⎯⎯', nameFr: 'Horizontal line (Ligne horizontale)', nameEn: 'Horizontal Line', points: 1 },
      { id: 'vertical', symbol: '⎪', nameFr: 'Vertical line (Ligne verticale)', nameEn: 'Vertical Line', points: 1 },
    ],
  },
  {
    id: 'fibonacci',
    nameFr: 'Catégorie Fibonacci & Gann',
    nameEn: 'Fibonacci & Gann',
    tools: [
      { id: 'fibonacci', symbol: '𝛗', nameFr: 'Fib retracement (Retracement Fibonacci)', nameEn: 'Fib Retracement', points: 2 },
      { id: 'gann_box', symbol: '⊞', nameFr: 'Gann box (Boîte de Gann)', nameEn: 'Gann Box', points: 2 },
      { id: 'fib_channel', symbol: '⫽', nameFr: 'Fib channel (Canal de Fibonacci)', nameEn: 'Fib Channel', points: 2 },
    ],
  },
  {
    id: 'forecasting',
    nameFr: 'Catégorie Forecasting (Positions)',
    nameEn: 'Forecasting',
    tools: [
      { id: 'long_position', symbol: '📈', nameFr: 'Long position (Position Longue)', nameEn: 'Long Position', points: 1 },
      { id: 'short_position', symbol: '📉', nameFr: 'Short position (Position Courte)', nameEn: 'Short Position', points: 1 },
    ],
  },
];

// Extended Timeframes list including M2, M3, M30, M45, H2, H3, 3 months, 6 months, 12 months
const ALL_TIMEFRAMES = [
  { value: 'M1', label: '1m', group: 'Minutes' },
  { value: 'M2', label: '2m', group: 'Minutes' },
  { value: 'M3', label: '3m', group: 'Minutes' },
  { value: 'M5', label: '5m', group: 'Minutes' },
  { value: 'M15', label: '15m', group: 'Minutes' },
  { value: 'M30', label: '30m', group: 'Minutes' },
  { value: 'M45', label: '45m', group: 'Minutes' },
  { value: 'H1', label: '1h', group: 'Heures' },
  { value: 'H2', label: '2h', group: 'Heures' },
  { value: 'H3', label: '3h', group: 'Heures' },
  { value: 'H4', label: '4h', group: 'Heures' },
  { value: 'D1', label: '1j', group: 'Jours' },
  { value: 'W1', label: '1s', group: 'Semaines' },
  { value: '3M', label: '3 mois', group: 'Mois' },
  { value: '6M', label: '6 mois', group: 'Mois' },
  { value: '12M', label: '12 mois', group: 'Mois' },
];

const QUICK_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const CHART_TYPES = [
  { id: 'candlestick', labelFr: 'Bougies Japonaises', labelEn: 'Candlesticks' },
  { id: 'bar', labelFr: 'Barres OHLC', labelEn: 'OHLC Bars' },
  { id: 'line', labelFr: 'Ligne', labelEn: 'Line Chart' },
  { id: 'area', labelFr: 'Surface (Area)', labelEn: 'Area Chart' },
];

const THEME_COLORS = [
  { id: 'dark', label: 'Dark Pro', bg: '#090d16', text: '#94a3b8', grid: '#1e293b' },
  { id: 'black', label: 'OLED Black', bg: '#000000', text: '#9ca3af', grid: '#111827' },
  { id: 'slate', label: 'Navy Slate', bg: '#0f172a', text: '#94a3b8', grid: '#1e293b' },
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

  // Active drawer overlay: null | 'order' | 'positions' | 'history' | 'indicators' | 'tools' | 'settings' | 'speed'
  const [activeDrawer, setActiveDrawer] = useState(null);

  // Pair & Category dropdown state
  const [selectedCategory, setSelectedCategory] = useState('forex');
  const [selectedPair, setSelectedPair] = useState(ALL_PAIRS[0]);
  const [timeframe, setTimeframe] = useState('H1');
  const [candleLimit, setCandleLimit] = useState(1500); // 1500 deep historical bars (fast & reliable load)

  // Raw dataset and replay pointer
  const [allCandles, setAllCandles] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0); // number of bars currently revealed
  const [cutIndex, setCutIndex] = useState(0); // where the cut was placed
  const [cutMode, setCutMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  // Historical Backtest Period (Mois, Jour, Année)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [modalStartDate, setModalStartDate] = useState(startDate);
  const [modalEndDate, setModalEndDate] = useState(endDate);

  useEffect(() => {
    setModalStartDate(startDate);
    setModalEndDate(endDate);
  }, [startDate, endDate]);

  // Chart Customization State
  const [chartType, setChartType] = useState('candlestick');
  const [chartTheme, setChartTheme] = useState(THEME_COLORS[0]);
  const [upColor, setUpColor] = useState('#10b981');
  const [downColor, setDownColor] = useState('#ef4444');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active Indicators
  const [showEMA9, setShowEMA9] = useState(false);
  const [showEMA21, setShowEMA21] = useState(false);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showSMA20, setShowSMA20] = useState(false);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);

  // TradingView Drawing Tools state
  const [activeDrawingTool, setActiveDrawingTool] = useState('none');
  const [pendingPoints, setPendingPoints] = useState([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [drawings, setDrawings] = useState([]); // [{ id, type, price, time, ... }]
  const [renderTick, setRenderTick] = useState(0);

  // Account Capital & Realistic Trade Simulation ($10,000 initial balance)
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('backtest_balance');
    return saved ? Number(saved) : INITIAL_CAPITAL;
  });

  // Lot size dynamically initialized per category (0.01 for forex, etc.)
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
  const [activePositions, setActivePositions] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [tradeLogs, setTradeLogs] = useState([]);

  // Chart container refs
  const chartContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
  const sma20SeriesRef = useRef(null);
  const sma50SeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Refs for persistent event handling
  const activeDrawingToolRef = useRef(activeDrawingTool);
  useEffect(() => { activeDrawingToolRef.current = activeDrawingTool; }, [activeDrawingTool]);

  const pendingPointsRef = useRef(pendingPoints);
  useEffect(() => { pendingPointsRef.current = pendingPoints; }, [pendingPoints]);

  const replayIndexRef = useRef(replayIndex);
  useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);

  const allCandlesRef = useRef([]);
  useEffect(() => { allCandlesRef.current = allCandles; }, [allCandles]);

  const cutModeRef = useRef(false);
  useEffect(() => { cutModeRef.current = cutMode; }, [cutMode]);

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

  // Load candle data from server or clean continuous generator with timeframe persistence
  const fetchCandles = useCallback(
    async (preserveCurrentTime = false) => {
      setLoading(true);
      setIsPlaying(false);
      try {
        const curTimestamp = allCandlesRef.current[replayIndexRef.current - 1]?.time || null;
        const { data } = await marketApi.snapshot(selectedPair.symbol, timeframe, candleLimit);
        const raw = data?.data?.market?.candles || [];
        const sorted =
          raw.length > 0
            ? sanitizeCandles(raw, selectedPair.base)
            : generateRealisticCandles(selectedPair.base, timeframe, 300);

        if (sorted.length > 0) {
          setAllCandles(sorted);

          let newIdx;
          if (preserveCurrentTime && curTimestamp) {
            const idx = sorted.findIndex((c) => c.time >= curTimestamp);
            newIdx = idx === -1 ? sorted.length : Math.max(1, idx);
          } else {
            newIdx = sorted.length;
            setCutIndex(newIdx);
          }
          setReplayIndex(newIdx);

          const dp = getDecimals(sorted[sorted.length - 1]?.close || selectedPair.base);
          if (mainSeriesRef.current) {
            mainSeriesRef.current.applyOptions({
              priceFormat: {
                type: 'price',
                precision: dp,
                minMove: Math.pow(10, -dp),
              },
            });
            const visible = sorted.slice(0, newIdx);
            if (chartType === 'line' || chartType === 'area') {
              mainSeriesRef.current.setData(visible.map((c) => ({ time: c.time, value: c.close })));
            } else {
              mainSeriesRef.current.setData(visible);
            }
            chartInstanceRef.current?.timeScale().fitContent();
          }
        }
      } catch (err) {
        console.warn('Backtest snapshot fetch error, using realistic fallback:', err);
        const fallback = generateRealisticCandles(selectedPair.base, timeframe, 500);
        setAllCandles(fallback);
        const initCut = fallback.length;
        setCutIndex(initCut);
        setReplayIndex(initCut);
        chartInstanceRef.current?.timeScale().fitContent();
      } finally {
        setLoading(false);
      }
    },
    [selectedPair, timeframe, candleLimit, chartType]
  );

  // Timeframe change without losing backtest progress
  const handleTimeframeChange = (newTf) => {
    if (newTf === timeframe) return;
    setTimeframe(newTf);
  };

  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      fetchCandles(false);
    } else {
      fetchCandles(true);
    }
  }, [timeframe]);

  useEffect(() => {
    if (!initialLoadRef.current) {
      fetchCandles(false);
    }
  }, [selectedPair]);

  // Date range application
  const handleApplyDateRange = (sDate, eDate) => {
    setStartDate(sDate);
    setEndDate(eDate);
    const startSec = Math.floor(new Date(`${sDate}T00:00:00Z`).getTime() / 1000);
    const endSec = Math.floor(new Date(`${eDate}T23:59:59Z`).getTime() / 1000);

    const filtered = allCandles.filter((c) => c.time >= startSec && c.time <= endSec);
    if (filtered.length >= 5) {
      setAllCandles(filtered);
      const initCut = Math.max(1, Math.floor(filtered.length * 0.25));
      setCutIndex(initCut);
      setReplayIndex(initCut);
      chartInstanceRef.current?.timeScale().fitContent();
      setShowDateRangeModal(false);
      toast.success(
        isEn
          ? `Backtest bounded from ${sDate} to ${eDate} (${filtered.length} bars)`
          : `Période délimitée : ${sDate} au ${eDate} (${filtered.length} bougies)`
      );
    } else {
      marketApi
        .snapshot(selectedPair.symbol, timeframe, 5000)
        .then(({ data }) => {
          const raw = data?.data?.market?.candles || [];
          const sorted =
            raw.length > 0
              ? sanitizeCandles(raw, selectedPair.base)
              : generateRealisticCandles(selectedPair.base, timeframe, 500);
          const f = sorted.filter((c) => c.time >= startSec && c.time <= endSec);
          if (f.length > 0) {
            setAllCandles(f);
            setCutIndex(1);
            setReplayIndex(Math.max(1, Math.min(15, f.length)));
            chartInstanceRef.current?.timeScale().fitContent();
            setShowDateRangeModal(false);
            toast.success(`Période délimitée : ${sDate} au ${eDate} (${f.length} bougies)`);
          } else {
            toast.error('Aucune bougie disponible sur cette période précise.');
          }
        })
        .catch(() => {
          toast.error('Impossible de charger les données pour cette période.');
        });
    }
  };

  // Reset Capital function ($10,000)
  const handleResetCapital = () => {
    setBalance(INITIAL_CAPITAL);
    localStorage.setItem('backtest_balance', INITIAL_CAPITAL);
    setActivePositions([]);
    setPendingOrders([]);
    toast.success(
      isEn
        ? `Account balance reset to $${INITIAL_CAPITAL.toLocaleString()}!`
        : `Solde réinitialisé à $${INITIAL_CAPITAL.toLocaleString()} !`
    );
  };

  // Calculate EMA / SMA helpers
  const calculateEMA = (candlesData, period) => {
    if (candlesData.length < period) return [];
    const k = 2 / (period + 1);
    let ema = candlesData[0].close;
    const res = [];
    for (let i = 0; i < candlesData.length; i++) {
      const c = candlesData[i];
      if (i === 0) ema = c.close;
      else ema = c.close * k + ema * (1 - k);
      if (i >= period - 1) res.push({ time: c.time, value: parseFloat(ema.toFixed(5)) });
    }
    return res;
  };

  const calculateSMA = (candlesData, period) => {
    if (candlesData.length < period) return [];
    const res = [];
    for (let i = period - 1; i < candlesData.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candlesData[i - j].close;
      res.push({ time: candlesData[i].time, value: parseFloat((sum / period).toFixed(5)) });
    }
    return res;
  };

  // Initialize Lightweight Charts v5 Instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 740,
      layout: {
        background: { type: ColorType.Solid, color: chartTheme.bg },
        textColor: chartTheme.text,
        fontSize: 12,
      },
      watermark: {
        visible: false,
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
        color: '#2563eb',
        lineWidth: 2,
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        topColor: 'rgba(37, 99, 235, 0.4)',
        bottomColor: 'rgba(37, 99, 235, 0.0)',
        lineColor: '#2563eb',
        lineWidth: 2,
      });
    }
    mainSeriesRef.current = series;

    // Load available visible candles
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

    // Indicators
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
    if (showSMA20) {
      sma20SeriesRef.current = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, title: 'SMA 20' });
    }
    if (showSMA50) {
      sma50SeriesRef.current = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1.5, title: 'SMA 50' });
    }

    // Replay Bar-Cut mode & Interactive Tool placement click handler
    chart.subscribeClick((param) => {
      if (!param || !param.time) return;

      // 1. Cut Mode: set replay cut point
      if (cutModeRef.current) {
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
        return;
      }

      // 2. Interactive Tool Placement
      const activeTool = activeDrawingToolRef.current;
      if (activeTool && activeTool !== 'none') {
        const clickedTime = param.time;
        const clickedPrice =
          mainSeriesRef.current?.coordinateToPrice(param.point?.y) || currentCandle?.close || selectedPair.base;
        const id = Date.now().toString(36);
        const dp = getDecimals(clickedPrice);

        if (activeTool === 'horizontal') {
          const newDrawing = {
            id,
            type: 'horizontal',
            price: Number(clickedPrice.toFixed(dp)),
            time: clickedTime,
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 'solid',
            label: `Ligne @ ${formatPrice(clickedPrice)}`,
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(id);
          setActiveDrawingTool('none');
          toast.success('Ligne Horizontale positionnée');
        } else if (activeTool === 'vertical') {
          const newDrawing = {
            id,
            type: 'vertical',
            price: Number(clickedPrice.toFixed(dp)),
            time: clickedTime,
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 'solid',
            label: 'Ligne Verticale',
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(id);
          setActiveDrawingTool('none');
          toast.success('Ligne Verticale positionnée');
        } else if (activeTool === 'long_position') {
          const delta = clickedPrice * 0.015;
          const tp = Number((clickedPrice + delta).toFixed(dp));
          const sl = Number((clickedPrice - delta * 0.5).toFixed(dp));
          const newDrawing = {
            id,
            type: 'long_position',
            entry: Number(clickedPrice.toFixed(dp)),
            tp,
            sl,
            time: clickedTime,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 'solid',
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(id);
          setActiveDrawingTool('none');
          toast.success('Position Longue configurée avec suivi du prix');
        } else if (activeTool === 'short_position') {
          const delta = clickedPrice * 0.015;
          const tp = Number((clickedPrice - delta).toFixed(dp));
          const sl = Number((clickedPrice + delta * 0.5).toFixed(dp));
          const newDrawing = {
            id,
            type: 'short_position',
            entry: Number(clickedPrice.toFixed(dp)),
            tp,
            sl,
            time: clickedTime,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 'solid',
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(id);
          setActiveDrawingTool('none');
          toast.success('Position Courte configurée avec suivi du prix');
        } else {
          // 2-point tools: trendline, ray, fibonacci, gann_box, fib_channel
          const pts = pendingPointsRef.current;
          if (pts.length === 0) {
            setPendingPoints([{ time: clickedTime, price: Number(clickedPrice.toFixed(dp)) }]);
            toast('Point 1 posé. Cliquez sur le graphique pour poser le Point 2.', { icon: '📍' });
          } else {
            const p1 = pts[0];
            const p2 = { time: clickedTime, price: Number(clickedPrice.toFixed(dp)) };
            const newDrawing = {
              id,
              type: activeTool,
              time: p1.time,
              price: p1.price,
              time2: p2.time,
              price2: p2.price,
              color: activeTool === 'fibonacci' ? '#eab308' : '#3b82f6',
              lineWidth: 2,
              lineStyle: 'solid',
              fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
            };
            setDrawings((prev) => [...prev, newDrawing]);
            setSelectedDrawingId(id);
            setPendingPoints([]);
            setActiveDrawingTool('none');
            toast.success(`Outil tracé sur le graphique.`);
          }
        }
      }
    });

    // Subscribe to chart visible range change to update SVG overlay coordinates in real-time
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      setRenderTick((t) => t + 1);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      setRenderTick((t) => t + 1);
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 740,
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
  }, [
    chartTheme,
    chartType,
    upColor,
    downColor,
    showEMA9,
    showEMA21,
    showEMA50,
    showEMA200,
    showSMA20,
    showSMA50,
    isEn,
  ]);

  // Update chart data when replayIndex or allCandles changes
  useEffect(() => {
    if (!mainSeriesRef.current || allCandles.length === 0) return;

    const visibleData = allCandles.slice(0, replayIndex);
    if (visibleData.length === 0) return;

    if (chartType === 'line' || chartType === 'area') {
      mainSeriesRef.current.setData(visibleData.map((c) => ({ time: c.time, value: c.close })));
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
    if (showSMA20 && sma20SeriesRef.current) {
      sma20SeriesRef.current.setData(calculateSMA(visibleData, 20));
    }
    if (showSMA50 && sma50SeriesRef.current) {
      sma50SeriesRef.current.setData(calculateSMA(visibleData, 50));
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

    // Draw interactive user drawings (Horizontal lines, Zones, etc.)
    drawings.forEach((d) => {
      if (d.type === 'horizontal' || d.type === 'ray') {
        const line = mainSeriesRef.current.createPriceLine({
          price: d.price,
          color: d.color || '#3b82f6',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: d.label || 'Ligne Horizontale',
        });
        priceLinesRef.current.push(line);
      } else if (d.type === 'fibonacci') {
        // Plot Key Fib Levels
        [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((ratio) => {
          const fibPrice = d.low + (d.high - d.low) * ratio;
          const fibLine = mainSeriesRef.current.createPriceLine({
            price: Number(fibPrice.toFixed(4)),
            color: ratio === 0.618 || ratio === 0.5 ? '#eab308' : '#94a3b8',
            lineWidth: ratio === 0.618 ? 2 : 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `Fib ${(ratio * 100).toFixed(1)}%`,
          });
          priceLinesRef.current.push(fibLine);
        });
      } else if (d.type === 'supply_zone') {
        const top = mainSeriesRef.current.createPriceLine({
          price: d.top,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'SUPPLY ZONE TOP',
        });
        const btm = mainSeriesRef.current.createPriceLine({
          price: d.bottom,
          color: 'rgba(239, 68, 68, 0.7)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'SUPPLY ZONE BTM',
        });
        priceLinesRef.current.push(top, btm);
      } else if (d.type === 'demand_zone') {
        const top = mainSeriesRef.current.createPriceLine({
          price: d.top,
          color: 'rgba(16, 185, 129, 0.7)',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'DEMAND ZONE TOP',
        });
        const btm = mainSeriesRef.current.createPriceLine({
          price: d.bottom,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'DEMAND ZONE BTM',
        });
        priceLinesRef.current.push(top, btm);
      }
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
  }, [
    replayIndex,
    allCandles,
    chartType,
    showEMA9,
    showEMA21,
    showEMA50,
    showEMA200,
    showSMA20,
    showSMA50,
    activePositions,
    pendingOrders,
    drawings,
  ]);

  // Order Matching & Realistic PnL / SL / TP Evaluation per bar
  const evaluateOrdersAtBar = useCallback(
    (bar) => {
      if (!bar) return;

      const { high, low, close } = bar;

      // 1. Check Pending Orders Trigger
      if (pendingOrders.length > 0) {
        const remainingPending = [];
        const newPositions = [];

        pendingOrders.forEach((order) => {
          let triggered = false;
          if (order.type === 'BUY_LIMIT' && low <= order.entry) triggered = true;
          else if (order.type === 'SELL_LIMIT' && high >= order.entry) triggered = true;
          else if (order.type === 'BUY_STOP' && high >= order.entry) triggered = true;
          else if (order.type === 'SELL_STOP' && low <= order.entry) triggered = true;

          if (triggered) {
            const actualType = order.type.startsWith('BUY') ? 'BUY' : 'SELL';
            newPositions.push({
              ...order,
              type: actualType,
              openTime: bar.time,
              pnl: 0,
            });
            toast.success(`Ordre différé exécuté : ${order.type} @ ${order.entry}`);
          } else {
            remainingPending.push(order);
          }
        });

        if (newPositions.length > 0) {
          setPendingOrders(remainingPending);
          setActivePositions((prev) => [...prev, ...newPositions]);
        }
      }

      // 2. Evaluate Active Positions SL, TP and Floating P&L
      setActivePositions((prevPositions) => {
        if (!prevPositions.length) return prevPositions;

        const remaining = [];
        let balanceDelta = 0;
        const newLogs = [];

        prevPositions.forEach((pos) => {
          let closed = false;
          let exitPrice = close;
          let reason = '';

          // Check SL
          if (pos.sl) {
            if (pos.type === 'BUY' && low <= pos.sl) {
              closed = true;
              exitPrice = pos.sl;
              reason = 'Stop Loss';
            } else if (pos.type === 'SELL' && high >= pos.sl) {
              closed = true;
              exitPrice = pos.sl;
              reason = 'Stop Loss';
            }
          }

          // Check TP
          if (!closed && pos.tp) {
            if (pos.type === 'BUY' && high >= pos.tp) {
              closed = true;
              exitPrice = pos.tp;
              reason = 'Take Profit';
            } else if (pos.type === 'SELL' && low <= pos.tp) {
              closed = true;
              exitPrice = pos.tp;
              reason = 'Take Profit';
            }
          }

          if (closed) {
            const finalPnl = calculateTradePnl({ ...pos, entry: pos.entry }, exitPrice);
            balanceDelta += finalPnl;
            newLogs.push({
              ...pos,
              exit: exitPrice,
              pnl: finalPnl,
              reason,
              closeTime: bar.time,
            });
            toast(
              `${reason} touché ! Trade ${pos.type} clôturé : ${finalPnl >= 0 ? '+' : ''}$${finalPnl}`,
              {
                icon: finalPnl >= 0 ? '🎯' : '🛑',
              }
            );
          } else {
            const currentPnl = calculateTradePnl(pos, close);
            remaining.push({ ...pos, pnl: currentPnl });
          }
        });

        if (newLogs.length > 0) {
          setTradeLogs((prev) => [...newLogs, ...prev]);
        }
        if (balanceDelta !== 0) {
          setBalance((prev) => {
            const next = Math.round((prev + balanceDelta) * 100) / 100;
            localStorage.setItem('backtest_balance', next);
            return next;
          });
        }

        return remaining;
      });
    },
    [pendingOrders]
  );

  // Advance replay by one candle
  const stepForward = useCallback(() => {
    setReplayIndex((prev) => {
      if (prev >= allCandles.length) {
        setIsPlaying(false);
        toast(isEn ? 'End of historical replay data.' : 'Fin des données historiques de replay.', {
          icon: '🏁',
        });
        return prev;
      }
      const nextIndex = prev + 1;
      const nextBar = allCandles[nextIndex - 1];
      evaluateOrdersAtBar(nextBar);
      return nextIndex;
    });
  }, [allCandles, evaluateOrdersAtBar, isEn]);

  // Step backward by one candle
  const stepBackward = useCallback(() => {
    setReplayIndex((prev) => (prev > 15 ? prev - 1 : prev));
  }, []);

  // Jump back to cut point
  const handleRestartReplay = () => {
    setIsPlaying(false);
    setReplayIndex(cutIndex);
    toast.success(isEn ? 'Replay reset to initial cut point.' : 'Replay remis au début du découpage.');
  };

  // Replay play/pause ticker loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = 1000 / playbackSpeed;
    const timer = setInterval(() => {
      stepForward();
    }, interval);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, stepForward]);

  // Execute Order (Market or Pending)
  const handlePlaceOrder = () => {
    if (!currentCandle) {
      toast.error(isEn ? 'No candle available.' : 'Aucune bougie disponible.');
      return;
    }

    const isPending = ['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType);
    const entryPrice = isPending ? parseFloat(customEntry) : currentPrice;

    if (isPending && (!entryPrice || isNaN(entryPrice))) {
      toast.error(isEn ? 'Please specify an Entry Price.' : 'Veuillez saisir un Prix d’entrée.');
      return;
    }

    const numLots = parseFloat(lotSize) || lotConfig.default;
    const orderId = Date.now().toString(36);

    const orderData = {
      id: orderId,
      symbol: selectedPair.symbol,
      category: selectedPair.category,
      type: orderType,
      entry: entryPrice,
      lots: numLots,
      sl: stopLoss ? parseFloat(stopLoss) : null,
      tp: takeProfit ? parseFloat(takeProfit) : null,
    };

    if (isPending) {
      setPendingOrders((prev) => [...prev, orderData]);
      toast.success(
        isEn
          ? `Pending order placed: ${orderType} ${numLots}L @ ${entryPrice}`
          : `Ordre différé placé : ${orderType} ${numLots}L @ ${entryPrice}`
      );
    } else {
      const positionData = {
        ...orderData,
        openTime: currentCandle.time,
        pnl: 0,
      };
      setActivePositions((prev) => [...prev, positionData]);
      toast.success(
        isEn
          ? `Order executed: ${orderType} ${numLots}L @ ${entryPrice}`
          : `Ordre exécuté : ${orderType} ${numLots}L @ ${entryPrice}`
      );
    }

    // Reset inputs
    setCustomEntry('');
    setStopLoss('');
    setTakeProfit('');
    setActiveDrawer(null);
  };

  // Close an active position manually
  const handleClosePosition = (posId) => {
    const pos = activePositions.find((p) => p.id === posId);
    if (!pos || !currentCandle) return;

    const finalPnl = calculateTradePnl(pos, currentPrice);
    setBalance((prev) => {
      const next = Math.round((prev + finalPnl) * 100) / 100;
      localStorage.setItem('backtest_balance', next);
      return next;
    });

    setTradeLogs((prev) => [
      {
        ...pos,
        exit: currentPrice,
        pnl: finalPnl,
        reason: 'Manuel',
        closeTime: currentCandle.time,
      },
      ...prev,
    ]);

    setActivePositions((prev) => prev.filter((p) => p.id !== posId));
    toast.success(`Position ${pos.type} clôturée à ${currentPrice} (PnL: $${finalPnl})`);
  };

  // Toggle Fullscreen mode
  const handleToggleFullscreen = () => {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Handle Adding Drawing Tools on Chart
  // Handle Selecting a tool to draw (Activates interactive click mode on chart)
  const handleSelectToolToDraw = (toolId) => {
    setActiveDrawingTool(toolId);
    setPendingPoints([]);
    setActiveDrawer(null);
    const toolMeta = DRAWING_TOOLS_CATEGORIES.flatMap((c) => c.tools).find((t) => t.id === toolId);
    toast(
      isEn
        ? `Tool active: ${toolMeta?.nameEn || toolId}. Click on the chart to position.`
        : `Outil actif : ${toolMeta?.nameFr || toolId}. Cliquez sur le graphique pour positionner ou étirer l'outil.`,
      { icon: toolMeta?.symbol || '✏️' }
    );
  };

  // Add drawing immediately at current price with default sizing
  const handleQuickAddDrawing = (type) => {
    const id = Date.now().toString(36);
    const dp = getDecimals(currentPrice);
    const range = currentPrice * 0.008;
    const curTime = currentCandle?.time || Math.floor(Date.now() / 1000);

    if (type === 'horizontal') {
      const d = {
        id,
        type: 'horizontal',
        price: Number(currentPrice.toFixed(dp)),
        time: curTime,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        label: `Ligne @ ${formatPrice(currentPrice)}`,
      };
      setDrawings((prev) => [...prev, d]);
      setSelectedDrawingId(id);
      toast.success(`Ligne horizontale tracée à ${formatPrice(currentPrice)}`);
    } else if (type === 'vertical') {
      const d = {
        id,
        type: 'vertical',
        price: Number(currentPrice.toFixed(dp)),
        time: curTime,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        label: 'Ligne Verticale',
      };
      setDrawings((prev) => [...prev, d]);
      setSelectedDrawingId(id);
      toast.success('Ligne verticale tracée');
    } else if (type === 'long_position') {
      const delta = currentPrice * 0.015;
      const tp = Number((currentPrice + delta).toFixed(dp));
      const sl = Number((currentPrice - delta * 0.5).toFixed(dp));
      const d = {
        id,
        type: 'long_position',
        entry: Number(currentPrice.toFixed(dp)),
        tp,
        sl,
        time: curTime,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 'solid',
      };
      setDrawings((prev) => [...prev, d]);
      setSelectedDrawingId(id);
      toast.success('Position Longue configurée avec suivi du prix en direct');
    } else if (type === 'short_position') {
      const delta = currentPrice * 0.015;
      const tp = Number((currentPrice - delta).toFixed(dp));
      const sl = Number((currentPrice + delta * 0.5).toFixed(dp));
      const d = {
        id,
        type: 'short_position',
        entry: Number(currentPrice.toFixed(dp)),
        tp,
        sl,
        time: curTime,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 'solid',
      };
      setDrawings((prev) => [...prev, d]);
      setSelectedDrawingId(id);
      toast.success('Position Courte configurée avec suivi du prix en direct');
    } else {
      // Trendline, Ray, Fibonacci, Gann box, Fib channel
      const tfSec = 3600;
      const d = {
        id,
        type,
        time: curTime - tfSec * 15,
        price: Number((currentPrice - range).toFixed(dp)),
        time2: curTime + tfSec * 10,
        price2: Number((currentPrice + range).toFixed(dp)),
        color: type === 'fibonacci' ? '#eab308' : '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
      };
      setDrawings((prev) => [...prev, d]);
      setSelectedDrawingId(id);
      toast.success(`Outil ${type} positionné sur le graphique`);
    }
    setActiveDrawer(null);
  };

  // Update specific property of selected drawing (color, lineWidth, lineStyle, tp, sl, etc.)
  const updateDrawingProperty = (id, patch) => {
    setDrawings((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  // Delete a drawing
  const handleDeleteDrawing = (id) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    if (selectedDrawingId === id) setSelectedDrawingId(null);
    toast.success('Outil supprimé du graphique.');
  };

  const handleClearDrawings = () => {
    setDrawings([]);
    setSelectedDrawingId(null);
    toast.success('Tous les tracés ont été effacés.');
    setActiveDrawer(null);
  };

  // Currently selected drawing object
  const selectedDrawing = useMemo(() => {
    return drawings.find((d) => d.id === selectedDrawingId) || null;
  }, [drawings, selectedDrawingId]);

  const selectedToolMeta = useMemo(() => {
    if (!selectedDrawing) return null;
    return DRAWING_TOOLS_CATEGORIES.flatMap((c) => c.tools).find((t) => t.id === selectedDrawing.type);
  }, [selectedDrawing]);

  const activeToolMeta = useMemo(() => {
    if (activeDrawingTool === 'none') return null;
    return DRAWING_TOOLS_CATEGORIES.flatMap((c) => c.tools).find((t) => t.id === activeDrawingTool);
  }, [activeDrawingTool]);

  // Coordinate mapper for drawings overlay
  const getCoords = (time, price) => {
    if (!chartInstanceRef.current || !mainSeriesRef.current || !time || price == null) return null;
    try {
      const x = chartInstanceRef.current.timeScale().timeToCoordinate(time);
      const y = mainSeriesRef.current.priceToCoordinate(price);
      if (x == null || y == null || isNaN(x) || isNaN(y)) return null;
      return { x, y };
    } catch {
      return null;
    }
  };

  return (
    <div
      ref={chartWrapperRef}
      className="flex flex-col h-[calc(100vh-65px)] w-full bg-[#090d16] text-gray-200 select-none overflow-hidden"
    >
      {/* 1. TOP NAVBAR: Pairs, Timeframes, Period (Dates), Candle Style, Indicators, Solde, Équité & Reset */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-800 bg-[#0d1322] px-3 py-1.5 gap-2 text-xs">
        {/* Left: Category + Symbol + Timeframes + Period + Candle Style + Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              const cat = e.target.value;
              setSelectedCategory(cat);
              const first = ALL_PAIRS.find((p) => p.category === cat) || ALL_PAIRS[0];
              setSelectedPair(first);
            }}
            className="rounded-lg border border-gray-700 bg-gray-800/90 px-2 py-1 text-xs font-bold text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            title="Catégorie d'actif"
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labelFr}
              </option>
            ))}
          </select>

          {/* Pair Selector with Grouping for Forex Majors, Minors, Exotics */}
          <select
            value={selectedPair.symbol}
            onChange={(e) => {
              const p = ALL_PAIRS.find((x) => x.symbol === e.target.value);
              if (p) setSelectedPair(p);
            }}
            className="rounded-lg border border-brand-500/50 bg-brand-500/10 px-2.5 py-1 text-xs font-black text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            title="Sélectionner l'actif"
          >
            {selectedCategory === 'forex' ? (
              <>
                <optgroup label="Forex · Paires Majeures" className="bg-gray-900 text-brand-400 font-bold">
                  {filteredPairs
                    .filter((p) => p.subgroup === 'Majeures')
                    .map((p) => (
                      <option key={p.symbol} value={p.symbol} className="bg-gray-900 text-white font-medium">
                        {p.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Forex · Paires Mineures (Crosses)" className="bg-gray-900 text-brand-400 font-bold">
                  {filteredPairs
                    .filter((p) => p.subgroup === 'Mineures (Crosses)')
                    .map((p) => (
                      <option key={p.symbol} value={p.symbol} className="bg-gray-900 text-white font-medium">
                        {p.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Forex · Paires Exotiques" className="bg-gray-900 text-brand-400 font-bold">
                  {filteredPairs
                    .filter((p) => p.subgroup === 'Exotiques')
                    .map((p) => (
                      <option key={p.symbol} value={p.symbol} className="bg-gray-900 text-white font-medium">
                        {p.label}
                      </option>
                    ))}
                </optgroup>
              </>
            ) : (
              filteredPairs.map((p) => (
                <option key={p.symbol} value={p.symbol} className="bg-gray-900 text-white font-medium">
                  {p.label}
                </option>
              ))
            )}
          </select>

          <span className="font-mono font-bold text-white px-1">
            {formatPrice(currentPrice)}
          </span>

          <div className="h-4 w-[1px] bg-gray-800" />

          {/* Quick Timeframes */}
          <div className="hidden sm:flex items-center gap-1">
            {QUICK_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`rounded px-1.5 py-0.5 text-xs font-bold transition ${
                  timeframe === tf
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* All Timeframes Dropdown (M2, M3, M45, H2, H3, 3M, 6M, 12M etc.) */}
          <select
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            className="rounded border border-gray-800 bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-gray-300 hover:text-white focus:outline-none"
            title="Toutes les unités de temps (M2, M3, M30, M45, H2, H3, 3 mois, 6 mois, 12 mois)"
          >
            <option value={timeframe}>TF: {timeframe}</option>
            <optgroup label="Minutes">
              <option value="M1">1 minute (M1)</option>
              <option value="M2">2 minutes (M2)</option>
              <option value="M3">3 minutes (M3)</option>
              <option value="M5">5 minutes (M5)</option>
              <option value="M15">15 minutes (M15)</option>
              <option value="M30">30 minutes (M30)</option>
              <option value="M45">45 minutes (M45)</option>
            </optgroup>
            <optgroup label="Heures">
              <option value="H1">1 heure (H1)</option>
              <option value="H2">2 heures (H2)</option>
              <option value="H3">3 heures (H3)</option>
              <option value="H4">4 heures (H4)</option>
            </optgroup>
            <optgroup label="Jours & Semaines">
              <option value="D1">1 jour (D1)</option>
              <option value="W1">1 semaine (W1)</option>
            </optgroup>
            <optgroup label="Mois & Long Terme">
              <option value="3M">3 mois (Trimestriel)</option>
              <option value="6M">6 mois (Semestriel)</option>
              <option value="12M">12 mois (Annuel)</option>
            </optgroup>
          </select>

          <div className="h-4 w-[1px] bg-gray-800" />

          {/* Historical Period (Mois, Jour, Année) Button */}
          <button
            onClick={() => setShowDateRangeModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-xs font-bold text-gray-200 hover:border-brand-500 hover:text-white transition"
            title="Délimiter la période historique de début et de fin du Backtest (Mois, Jour, Année)"
          >
            <Calendar className="h-3.5 w-3.5 text-brand-400" />
            <span className="hidden lg:inline text-[11px] font-semibold text-gray-400">Période:</span>
            <span className="font-mono text-[11px]">{startDate} → {endDate}</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-800" />

          {/* Candle Style Icon Selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const styles = ['candlestick', 'bar', 'line', 'area'];
                const next = styles[(styles.indexOf(chartType) + 1) % styles.length];
                setChartType(next);
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-gray-300 hover:bg-gray-800 hover:text-white transition"
              title={`Style de bougie : ${chartType.toUpperCase()} (Cliquer pour alterner)`}
            >
              <CandlestickChart className="h-4 w-4 text-brand-400" />
              <span className="hidden md:inline uppercase font-bold text-[11px]">{chartType}</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-gray-800" />

          {/* Indicators Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'indicators' ? null : 'indicators')}
            className={`flex items-center gap-1.5 rounded px-2 py-1 font-bold transition ${
              activeDrawer === 'indicators' || showEMA9 || showEMA21 || showEMA50 || showEMA200 || showSMA20
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
            title="Indicateurs Techniques (EMA, SMA, Bollinger, etc.)"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="font-bold">Indicateurs (fx)</span>
          </button>
        </div>

        {/* Right: Solde, Équité, Reset Capital, Settings */}
        <div className="flex items-center gap-3">
          {/* Solde (Balance) */}
          <div
            className="flex items-center gap-1.5 rounded-lg bg-gray-900/90 px-2.5 py-1 border border-gray-800"
            title="Solde du compte (Balance de départ $10,000)"
          >
            <Wallet className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-[11px] text-gray-400 font-semibold uppercase">Solde:</span>
            <span className="font-mono font-bold text-white">${balance.toLocaleString()}</span>
          </div>

          {/* Équité (Equity) */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border ${
              floatingPnl >= 0
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
            }`}
            title="Équité en temps réel (Solde + PnL flottant des positions ouvertes)"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] opacity-75 font-semibold uppercase">Équité:</span>
            <span className="font-mono font-black">${equity.toLocaleString()}</span>
          </div>

          {/* Réinitialiser le Solde Icon Button */}
          <button
            onClick={handleResetCapital}
            className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 px-2 py-1 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition"
            title="Réinitialiser le capital du simulateur à $10,000"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden xl:inline text-[11px] font-bold">Reset $10K</span>
          </button>

          {/* Theme Settings Icon */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'settings' ? null : 'settings')}
            className="p-1 rounded text-gray-400 hover:bg-gray-800 hover:text-white transition"
            title="Paramètres d'affichage du graphique"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: Left Sidebar Toolbar + Central Chart Canvas + Side Drawers */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* LEFT VERTICAL TOOLBAR (TradingView Style Icon Rail) */}
        <aside className="w-14 shrink-0 border-r border-gray-800 bg-[#0d1322] flex flex-col items-center justify-between py-3 z-20">
          {/* Top Actions: Fullscreen, Order, Positions, History, TradingView Tools */}
          <div className="flex flex-col items-center gap-3 w-full">
            {/* Fullscreen Icon */}
            <button
              onClick={handleToggleFullscreen}
              className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition group relative"
              title="Graphique Plein Écran (TradingView)"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>

            {/* Passer un Ordre Icon */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'order' ? null : 'order')}
              className={`p-2.5 rounded-xl transition relative group ${
                activeDrawer === 'order'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-blue-400'
              }`}
              title="Passer un Ordre (Achat / Vente / Différé)"
            >
              <PlusCircle className="h-5 w-5" />
            </button>

            {/* Positions Ouvertes Icon with Badge */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'positions' ? null : 'positions')}
              className={`p-2.5 rounded-xl transition relative group ${
                activeDrawer === 'positions'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-emerald-400'
              }`}
              title="Positions en cours et PnL flottant"
            >
              <Briefcase className="h-5 w-5" />
              {activePositions.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-black">
                  {activePositions.length}
                </span>
              )}
            </button>

            {/* Historique des Trades Icon */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'history' ? null : 'history')}
              className={`p-2.5 rounded-xl transition group ${
                activeDrawer === 'history'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-purple-400'
              }`}
              title="Historique des trades et statistiques"
            >
              <HistoryIcon className="h-5 w-5" />
            </button>

            <div className="w-8 h-[1px] bg-gray-800 my-1" />

            {/* TradingView Drawing Tools Menu Button */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'tools' ? null : 'tools')}
              className={`p-2.5 rounded-xl transition group relative ${
                activeDrawer === 'tools' || drawings.length > 0
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-amber-400'
              }`}
              title="Outils d'analyse TradingView (Lignes, Fib, Supply/Demand, Règle)"
            >
              <PenTool className="h-5 w-5" />
              {drawings.length > 0 && (
                <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Bottom Actions: Replay Toolbar Group (Cut, Play, Step, Speed, Restart) */}
          <div className="flex flex-col items-center gap-2.5 w-full border-t border-gray-800 pt-3">
            {/* Cut Tool (Ciseaux) */}
            <button
              onClick={() => {
                setCutMode(!cutMode);
                if (!cutMode) {
                  toast('Cliquez sur une bougie pour couper le graphique et démarrer le Replay.', {
                    icon: '✂️',
                  });
                }
              }}
              className={`p-2.5 rounded-xl transition ${
                cutMode
                  ? 'bg-amber-500 text-black font-black animate-pulse shadow-lg shadow-amber-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-amber-400'
              }`}
              title={cutMode ? 'Mode Découpage Actif (Cliquez une bougie)' : 'Découper le graphique (Mode Cut)'}
            >
              <Scissors className="h-5 w-5" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2.5 rounded-xl transition ${
                isPlaying
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              }`}
              title={isPlaying ? 'Pause Replay' : 'Lancer le Replay automatique'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            {/* Step Forward (Avancer d'une bougie) */}
            <button
              onClick={stepForward}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
              title="Avancer d'une bougie (Step Forward)"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Step Backward (Reculer) */}
            <button
              onClick={stepBackward}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
              title="Reculer d'une bougie (Step Backward)"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            {/* Speed Selector (Dropdown/Popup) */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'speed' ? null : 'speed')}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition flex flex-col items-center"
              title="Vitesse du replay"
            >
              <Clock className="h-4 w-4" />
              <span className="text-[9px] font-black">{playbackSpeed}x</span>
            </button>

            {/* Recommencer au début du Replay */}
            <button
              onClick={handleRestartReplay}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-amber-400 transition"
              title="Revenir au point de départ du Replay"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* CENTRAL CHART CANVAS: Stretches 100% full width and height */}
        <div className="flex-1 relative h-full w-full bg-[#090d16] overflow-hidden">
          <style>{`
            #tv-attr-logo, a[href*="tradingview"], [class*="watermark"], [class*="tradingview"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `}</style>

          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <Spinner />
              <span className="ml-3 text-sm text-gray-300">Chargement des données historiques...</span>
            </div>
          )}

          {/* Cut Mode Top Banner */}
          {cutMode && (
            <div className="absolute top-2 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Scissors className="h-4 w-4 animate-bounce" />
                <span>Mode Découpage Actif : Cliquez sur n’importe quelle bougie du graphique pour placer la coupure du replay.</span>
              </div>
              <button
                onClick={() => setCutMode(false)}
                className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-black hover:bg-amber-400 transition"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Active Drawing Tool Placement Banner */}
          {activeDrawingTool !== 'none' && (
            <div className="absolute top-2 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-brand-500/50 bg-brand-500/10 px-4 py-2 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-400">
                <PenTool className="h-4 w-4 animate-pulse" />
                <span>
                  Outil actif : <strong className="text-white uppercase">{activeToolMeta?.nameFr || activeDrawingTool}</strong>.
                  {pendingPoints.length === 0
                    ? ' Cliquez sur le graphique pour positionner le 1er point.'
                    : ' Cliquez sur le graphique pour poser le 2ème point et finaliser le tracé.'}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveDrawingTool('none');
                  setPendingPoints([]);
                }}
                className="rounded-lg bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300 hover:bg-gray-700 transition"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Floating TradingView Properties Toolbar when a drawing is selected */}
          {selectedDrawing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl border border-gray-700 bg-[#0d1322]/95 px-3 py-1.5 shadow-2xl backdrop-blur-md animate-fadeIn text-xs">
              <div className="flex items-center gap-1.5 border-r border-gray-700 pr-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-800 text-amber-400 font-bold text-xs">
                  {selectedToolMeta?.symbol || '✏️'}
                </span>
                <span className="font-bold text-gray-200">
                  {selectedToolMeta?.nameFr?.split('(')[0] || selectedDrawing.type}
                </span>
              </div>

              {/* Colors */}
              <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                {['#3b82f6', '#10b981', '#ef4444', '#eab308', '#a855f7', '#06b6d4', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateDrawingProperty(selectedDrawing.id, { color: c })}
                    className={`h-4 w-4 rounded-full border transition ${
                      selectedDrawing.color === c ? 'scale-125 border-white ring-2 ring-brand-400' : 'border-gray-600 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    title={`Couleur ${c}`}
                  />
                ))}
              </div>

              {/* Line Width */}
              <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    onClick={() => updateDrawingProperty(selectedDrawing.id, { lineWidth: w })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                      (selectedDrawing.lineWidth || 2) === w ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    title={`Épaisseur ${w}px`}
                  >
                    {w}px
                  </button>
                ))}
              </div>

              {/* Line Style */}
              <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                {[
                  { id: 'solid', label: '—' },
                  { id: 'dashed', label: '--' },
                  { id: 'dotted', label: '···' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => updateDrawingProperty(selectedDrawing.id, { lineStyle: st.id })}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                      (selectedDrawing.lineStyle || 'solid') === st.id ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    title={`Style ${st.id}`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowToolSettings(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
                title="Paramètres avancés"
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteDrawing(selectedDrawing.id)}
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
                title="Supprimer cet outil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              {/* Close */}
              <button
                onClick={() => setSelectedDrawingId(null)}
                className="p-1 rounded text-gray-500 hover:text-white ml-1"
                title="Désélectionner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Lightweight Chart Container */}
          <div ref={chartContainerRef} className="h-full w-full" />

          {/* SVG Overlay for Interactive Drawings & Live Setup Tracking */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none z-10" style={{ overflow: 'hidden' }}>
            {drawings.map((d) => {
              const isSelected = selectedDrawingId === d.id;

              if (d.type === 'horizontal') {
                const y = mainSeriesRef.current?.priceToCoordinate(d.price);
                if (y == null) return null;
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line
                      x1={0}
                      y1={y}
                      x2="100%"
                      y2={y}
                      stroke={d.color || '#3b82f6'}
                      strokeWidth={d.lineWidth || 2}
                      strokeDasharray={d.lineStyle === 'dashed' ? '6,6' : d.lineStyle === 'dotted' ? '2,4' : 'none'}
                    />
                    <line x1={0} y1={y} x2="100%" y2={y} stroke="transparent" strokeWidth={16} />
                    <rect x={12} y={y - 9} width={75} height={18} rx={4} fill="#0d1322" stroke={d.color || '#3b82f6'} strokeWidth={1} />
                    <text x={16} y={y + 3} fill="#f1f5f9" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      {formatPrice(d.price)}
                    </text>
                    {isSelected && <circle cx={60} cy={y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />}
                  </g>
                );
              }

              if (d.type === 'vertical') {
                const x = chartInstanceRef.current?.timeScale().timeToCoordinate(d.time);
                if (x == null) return null;
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2="100%"
                      stroke={d.color || '#3b82f6'}
                      strokeWidth={d.lineWidth || 2}
                      strokeDasharray={d.lineStyle === 'dashed' ? '6,6' : d.lineStyle === 'dotted' ? '2,4' : 'none'}
                    />
                    <line x1={x} y1={0} x2={x} y2="100%" stroke="transparent" strokeWidth={16} />
                    {isSelected && <circle cx={x} cy={60} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />}
                  </g>
                );
              }

              if (d.type === 'trendline') {
                const p1 = getCoords(d.time, d.price);
                const p2 = getCoords(d.time2, d.price2);
                if (!p1 || !p2) return null;
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={d.color || '#3b82f6'}
                      strokeWidth={d.lineWidth || 2}
                      strokeDasharray={d.lineStyle === 'dashed' ? '6,6' : d.lineStyle === 'dotted' ? '2,4' : 'none'}
                    />
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={16} />
                    {isSelected && (
                      <>
                        <circle cx={p1.x} cy={p1.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                        <circle cx={p2.x} cy={p2.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              }

              if (d.type === 'ray') {
                const p1 = getCoords(d.time, d.price);
                const p2 = getCoords(d.time2, d.price2);
                if (!p1 || !p2) return null;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const extX = dx >= 0 ? 3000 : -1000;
                const extY = dx !== 0 ? p1.y + (dy / dx) * (extX - p1.x) : p2.y;
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={extX}
                      y2={extY}
                      stroke={d.color || '#3b82f6'}
                      strokeWidth={d.lineWidth || 2}
                      strokeDasharray={d.lineStyle === 'dashed' ? '6,6' : d.lineStyle === 'dotted' ? '2,4' : 'none'}
                    />
                    <line x1={p1.x} y1={p1.y} x2={extX} y2={extY} stroke="transparent" strokeWidth={16} />
                    {isSelected && (
                      <>
                        <circle cx={p1.x} cy={p1.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                        <circle cx={p2.x} cy={p2.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              }

              if (d.type === 'fibonacci') {
                const p1 = getCoords(d.time, d.price);
                const p2 = getCoords(d.time2, d.price2);
                if (!p1 || !p2) return null;
                const lvls = d.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x) + 260;
                const diff = d.price2 - d.price;
                const y50 = mainSeriesRef.current?.priceToCoordinate(d.price + diff * 0.5);
                const y618 = mainSeriesRef.current?.priceToCoordinate(d.price + diff * 0.618);
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={d.color || '#eab308'} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
                    {y50 != null && y618 != null && (
                      <rect
                        x={minX}
                        y={Math.min(y50, y618)}
                        width={maxX - minX}
                        height={Math.abs(y618 - y50)}
                        fill="#eab308"
                        fillOpacity={0.15}
                      />
                    )}
                    {lvls.map((lvl) => {
                      const lvlPrice = d.price + diff * lvl;
                      const lvlY = mainSeriesRef.current?.priceToCoordinate(lvlPrice);
                      if (lvlY == null) return null;
                      const isGolden = lvl === 0.618 || lvl === 0.5;
                      return (
                        <g key={lvl}>
                          <line
                            x1={minX}
                            y1={lvlY}
                            x2={maxX}
                            y2={lvlY}
                            stroke={isGolden ? '#eab308' : d.color || '#94a3b8'}
                            strokeWidth={isGolden ? 1.5 : 1}
                            strokeDasharray={lvl === 0 || lvl === 1 ? 'none' : '4,4'}
                          />
                          <text x={minX + 4} y={lvlY - 3} fill={isGolden ? '#facc15' : '#cbd5e1'} fontSize={10} fontFamily="monospace" fontWeight="bold">
                            {lvl} ({formatPrice(lvlPrice)})
                          </text>
                        </g>
                      );
                    })}
                    {isSelected && (
                      <>
                        <circle cx={p1.x} cy={p1.y} r={4.5} fill="#facc15" stroke="#fff" strokeWidth={1.5} />
                        <circle cx={p2.x} cy={p2.y} r={4.5} fill="#facc15" stroke="#fff" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              }

              if (d.type === 'gann_box') {
                const p1 = getCoords(d.time, d.price);
                const p2 = getCoords(d.time2, d.price2);
                if (!p1 || !p2) return null;
                const x = Math.min(p1.x, p2.x);
                const y = Math.min(p1.y, p2.y);
                const w = Math.max(1, Math.abs(p2.x - p1.x));
                const h = Math.max(1, Math.abs(p2.y - p1.y));
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <rect x={x} y={y} width={w} height={h} fill="#3b82f6" fillOpacity={0.08} stroke={d.color || '#3b82f6'} strokeWidth={d.lineWidth || 1.5} />
                    <line x1={x} y1={y + h * 0.25} x2={x + w} y2={y + h * 0.25} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
                    <line x1={x} y1={y + h * 0.5} x2={x + w} y2={y + h * 0.5} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.8} />
                    <line x1={x} y1={y + h * 0.75} x2={x + w} y2={y + h * 0.75} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
                    <line x1={x + w * 0.25} y1={y} x2={x + w * 0.25} y2={y + h} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
                    <line x1={x + w * 0.5} y1={y} x2={x + w * 0.5} y2={y + h} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.8} />
                    <line x1={x + w * 0.75} y1={y} x2={x + w * 0.75} y2={y + h} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
                    <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={d.color || '#3b82f6'} strokeWidth={1} opacity={0.5} />
                    <line x1={x} y1={y + h} x2={x + w} y2={y} stroke={d.color || '#3b82f6'} strokeWidth={1} opacity={0.5} />
                    {isSelected && (
                      <>
                        <circle cx={x} cy={y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                        <circle cx={x + w} cy={y + h} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              }

              if (d.type === 'fib_channel') {
                const p1 = getCoords(d.time, d.price);
                const p2 = getCoords(d.time2, d.price2);
                if (!p1 || !p2) return null;
                const offY = 40;
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={d.color || '#3b82f6'} strokeWidth={2} />
                    <line x1={p1.x} y1={p1.y - offY} x2={p2.x} y2={p2.y - offY} stroke={d.color || '#3b82f6'} strokeWidth={1.5} strokeDasharray="4,4" />
                    <line x1={p1.x} y1={p1.y - offY * 1.618} x2={p2.x} y2={p2.y - offY * 1.618} stroke={d.color || '#3b82f6'} strokeWidth={1} strokeDasharray="3,3" />
                    <polygon
                      points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x},${p2.y - offY} ${p1.x},${p1.y - offY}`}
                      fill="#3b82f6"
                      fillOpacity={0.08}
                    />
                    {isSelected && (
                      <>
                        <circle cx={p1.x} cy={p1.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                        <circle cx={p2.x} cy={p2.y} r={4.5} fill="#60a5fa" stroke="#fff" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              }

              if (d.type === 'long_position') {
                const entryY = mainSeriesRef.current?.priceToCoordinate(d.entry);
                const tpY = mainSeriesRef.current?.priceToCoordinate(d.tp);
                const slY = mainSeriesRef.current?.priceToCoordinate(d.sl);
                const startX = chartInstanceRef.current?.timeScale().timeToCoordinate(d.time);
                if (entryY == null || tpY == null || slY == null || startX == null) return null;
                const boxW = 240;
                const endX = startX + boxW;
                const currentX = currentCandle ? chartInstanceRef.current?.timeScale().timeToCoordinate(currentCandle.time) : startX;
                const progX = currentX != null ? Math.max(startX, Math.min(currentX, endX)) : startX;
                const traversedW = progX - startX;
                const remainingW = Math.max(0, endX - progX);
                const targetH = Math.max(1, entryY - tpY);
                const stopH = Math.max(1, slY - entryY);
                const rr = ((d.tp - d.entry) / Math.max(0.000001, d.entry - d.sl)).toFixed(2);
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    {/* Target Box: Traversed part (darker + dashed border) */}
                    {traversedW > 0 && (
                      <rect
                        x={startX}
                        y={tpY}
                        width={traversedW}
                        height={targetH}
                        fill="#065f46"
                        fillOpacity={0.55}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                      />
                    )}
                    {/* Target Box: Untraversed future part */}
                    {remainingW > 0 && (
                      <rect
                        x={progX}
                        y={tpY}
                        width={remainingW}
                        height={targetH}
                        fill="#10b981"
                        fillOpacity={0.16}
                        stroke="#10b981"
                        strokeWidth={1}
                      />
                    )}

                    {/* Stop Box: Traversed part (darker + dashed border) */}
                    {traversedW > 0 && (
                      <rect
                        x={startX}
                        y={entryY}
                        width={traversedW}
                        height={stopH}
                        fill="#881337"
                        fillOpacity={0.55}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                      />
                    )}
                    {/* Stop Box: Untraversed future part */}
                    {remainingW > 0 && (
                      <rect
                        x={progX}
                        y={entryY}
                        width={remainingW}
                        height={stopH}
                        fill="#ef4444"
                        fillOpacity={0.16}
                        stroke="#ef4444"
                        strokeWidth={1}
                      />
                    )}

                    {/* Entry separator line */}
                    <line x1={startX} y1={entryY} x2={endX} y2={entryY} stroke="#ffffff" strokeWidth={1.5} />

                    {/* Price Progress Indicator line */}
                    {progX > startX && (
                      <line x1={progX} y1={tpY} x2={progX} y2={slY} stroke="#facc15" strokeWidth={1.5} strokeDasharray="3,3" />
                    )}

                    {/* Labels */}
                    <text x={startX + 6} y={tpY + 14} fill="#6ee7b7" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      TP: {formatPrice(d.tp)} (Target)
                    </text>
                    <text x={startX + 6} y={entryY - 4} fill="#ffffff" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      Entrée: {formatPrice(d.entry)} · R:R 1:{rr}
                    </text>
                    <text x={startX + 6} y={slY - 6} fill="#fca5a5" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      SL: {formatPrice(d.sl)} (Stop)
                    </text>

                    {isSelected && (
                      <circle cx={startX} cy={entryY} r={5} fill="#60a5fa" stroke="#ffffff" strokeWidth={1.5} />
                    )}
                  </g>
                );
              }

              if (d.type === 'short_position') {
                const entryY = mainSeriesRef.current?.priceToCoordinate(d.entry);
                const tpY = mainSeriesRef.current?.priceToCoordinate(d.tp);
                const slY = mainSeriesRef.current?.priceToCoordinate(d.sl);
                const startX = chartInstanceRef.current?.timeScale().timeToCoordinate(d.time);
                if (entryY == null || tpY == null || slY == null || startX == null) return null;
                const boxW = 240;
                const endX = startX + boxW;
                const currentX = currentCandle ? chartInstanceRef.current?.timeScale().timeToCoordinate(currentCandle.time) : startX;
                const progX = currentX != null ? Math.max(startX, Math.min(currentX, endX)) : startX;
                const traversedW = progX - startX;
                const remainingW = Math.max(0, endX - progX);
                const stopH = Math.max(1, entryY - slY);
                const targetH = Math.max(1, tpY - entryY);
                const rr = ((d.entry - d.tp) / Math.max(0.000001, d.sl - d.entry)).toFixed(2);
                return (
                  <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDrawingId(d.id); }}>
                    {/* Stop Loss Box (Upper, Red) */}
                    {traversedW > 0 && (
                      <rect
                        x={startX}
                        y={slY}
                        width={traversedW}
                        height={stopH}
                        fill="#881337"
                        fillOpacity={0.55}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                      />
                    )}
                    {remainingW > 0 && (
                      <rect
                        x={progX}
                        y={slY}
                        width={remainingW}
                        height={stopH}
                        fill="#ef4444"
                        fillOpacity={0.16}
                        stroke="#ef4444"
                        strokeWidth={1}
                      />
                    )}

                    {/* Target Box (Lower, Green) */}
                    {traversedW > 0 && (
                      <rect
                        x={startX}
                        y={entryY}
                        width={traversedW}
                        height={targetH}
                        fill="#065f46"
                        fillOpacity={0.55}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                      />
                    )}
                    {remainingW > 0 && (
                      <rect
                        x={progX}
                        y={entryY}
                        width={remainingW}
                        height={targetH}
                        fill="#10b981"
                        fillOpacity={0.16}
                        stroke="#10b981"
                        strokeWidth={1}
                      />
                    )}

                    {/* Entry separator line */}
                    <line x1={startX} y1={entryY} x2={endX} y2={entryY} stroke="#ffffff" strokeWidth={1.5} />

                    {/* Price Progress Indicator line */}
                    {progX > startX && (
                      <line x1={progX} y1={slY} x2={progX} y2={tpY} stroke="#facc15" strokeWidth={1.5} strokeDasharray="3,3" />
                    )}

                    {/* Labels */}
                    <text x={startX + 6} y={slY + 14} fill="#fca5a5" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      SL: {formatPrice(d.sl)} (Stop)
                    </text>
                    <text x={startX + 6} y={entryY - 4} fill="#ffffff" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      Entrée: {formatPrice(d.entry)} · R:R 1:{rr}
                    </text>
                    <text x={startX + 6} y={tpY - 6} fill="#6ee7b7" fontSize={10} fontFamily="monospace" fontWeight="bold">
                      TP: {formatPrice(d.tp)} (Target)
                    </text>

                    {isSelected && (
                      <circle cx={startX} cy={entryY} r={5} fill="#60a5fa" stroke="#ffffff" strokeWidth={1.5} />
                    )}
                  </g>
                );
              }

              return null;
            })}
          </svg>

          {/* Bottom Bar: Candle Metrics (O, H, L, C, Replay Bar Index) */}
          {currentCandle && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between border-t border-gray-800 bg-[#0d1322]/90 px-4 py-1.5 text-xs font-mono text-gray-400 backdrop-blur">
              <div className="flex items-center gap-4">
                <span>O: <strong className="text-gray-200">{currentCandle.open}</strong></span>
                <span>H: <strong className="text-emerald-400">{currentCandle.high}</strong></span>
                <span>L: <strong className="text-rose-400">{currentCandle.low}</strong></span>
                <span>C: <strong className="text-gray-200">{currentCandle.close}</strong></span>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span>Bougie: <strong className="text-brand-400">{replayIndex}</strong> / {allCandles.length}</span>
                <span>Date: {new Date(currentCandle.time * 1000).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. SIDE OVERLAY DRAWERS (Order Placement, Positions, History, Tools, Indicators) */}

        {/* ORDER PLACEMENT DRAWER */}
        {activeDrawer === 'order' && (
          <aside className="absolute top-0 right-0 bottom-0 w-84 max-w-full border-l border-gray-800 bg-[#0d1322] shadow-2xl z-30 p-4 overflow-y-auto animate-fadeIn flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-sm text-white">Passer un Ordre</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* BUY / SELL Switcher */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setOrderType('BUY')}
                  className={`py-2 rounded-xl text-xs font-black transition ${
                    orderType === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  ACHAT (BUY)
                </button>
                <button
                  onClick={() => setOrderType('SELL')}
                  className={`py-2 rounded-xl text-xs font-black transition ${
                    orderType === 'SELL'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  VENTE (SELL)
                </button>
              </div>

              {/* Order Execution Type */}
              <div className="mb-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Type d'Ordre
                </label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none"
                >
                  <option value="BUY">Marché Direct (Achat)</option>
                  <option value="SELL">Marché Direct (Vente)</option>
                  <option value="BUY_LIMIT">Buy Limit (Retracement bas)</option>
                  <option value="SELL_LIMIT">Sell Limit (Retracement haut)</option>
                  <option value="BUY_STOP">Buy Stop (Cassure haute)</option>
                  <option value="SELL_STOP">Sell Stop (Cassure basse)</option>
                </select>
              </div>

              {/* Pending Entry Price */}
              {['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'].includes(orderType) && (
                <div className="mb-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Prix d'Entrée Différé
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customEntry}
                    onChange={(e) => setCustomEntry(e.target.value)}
                    placeholder={currentPrice.toString()}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              )}

              {/* Lot Size based on category */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Volume (Lots)
                  </label>
                  <span className="text-[10px] text-gray-500">{lotConfig.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={lotConfig.step}
                    min={lotConfig.min}
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => setLotSize((prev) => Math.max(lotConfig.min, Math.round((Number(prev) - lotConfig.step) * 100) / 100))}
                      className="rounded-lg bg-gray-800 px-2.5 py-2 text-xs font-bold text-gray-300 hover:bg-gray-700"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setLotSize((prev) => Math.round((Number(prev) + lotConfig.step) * 100) / 100)}
                      className="rounded-lg bg-gray-800 px-2.5 py-2 text-xs font-bold text-gray-300 hover:bg-gray-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Stop Loss & Take Profit */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                    Stop Loss (SL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs font-mono font-bold text-rose-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                    Take Profit (TP)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs font-mono font-bold text-emerald-300 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handlePlaceOrder}
              className={`w-full py-3 text-sm font-black ${
                orderType.startsWith('BUY') ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              Exécuter {orderType} ({lotSize}L)
            </Button>
          </aside>
        )}

        {/* POSITIONS EN COURS DRAWER */}
        {activeDrawer === 'positions' && (
          <aside className="absolute top-0 right-0 bottom-0 w-96 max-w-full border-l border-gray-800 bg-[#0d1322] shadow-2xl z-30 p-4 overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  Positions Ouvertes ({activePositions.length})
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activePositions.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Aucune position ouverte actuellement. Utilisez le bouton "Passer un ordre" sur la barre gauche.
              </div>
            ) : (
              <div className="space-y-3">
                {activePositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-black text-[10px] ${
                            pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {pos.type}
                        </span>
                        <span className="font-bold text-white">{pos.symbol}</span>
                        <span className="text-gray-400">({pos.lots}L)</span>
                      </div>
                      <span
                        className={`font-mono font-black ${
                          pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono">
                      <div>Entrée: {pos.entry}</div>
                      <div>Actuel: {currentPrice}</div>
                      {pos.sl && <div>SL: {pos.sl}</div>}
                      {pos.tp && <div>TP: {pos.tp}</div>}
                    </div>

                    <button
                      onClick={() => handleClosePosition(pos.id)}
                      className="w-full rounded-lg bg-gray-800 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-950/40 hover:border-rose-800 transition border border-gray-700"
                    >
                      Clôturer au Marché (${currentPrice})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* HISTORIQUE DES TRADES DRAWER */}
        {activeDrawer === 'history' && (
          <aside className="absolute top-0 right-0 bottom-0 w-96 max-w-full border-l border-gray-800 bg-[#0d1322] shadow-2xl z-30 p-4 overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">
                  Historique des Trades ({tradeLogs.length})
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {tradeLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Aucun trade clôturé pour le moment.
              </div>
            ) : (
              <div className="space-y-2.5">
                {tradeLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className={log.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.type} · {log.symbol} ({log.lots}L)
                      </span>
                      <span
                        className={`font-mono font-black ${
                          log.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {log.pnl >= 0 ? '+' : ''}${log.pnl}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                      <span>In: {log.entry} → Out: {log.exit}</span>
                      <span className="text-gray-500">{log.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* TRADINGVIEW DRAWING TOOLS POPOVER */}
        {activeDrawer === 'tools' && (
          <aside className="absolute top-12 left-16 w-84 max-w-sm border border-gray-800 bg-[#0d1322] rounded-2xl shadow-2xl z-30 p-4 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <PenTool className="h-4 w-4 text-amber-400" /> Outils d'Analyse TradingView
              </span>
              <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {DRAWING_TOOLS_CATEGORIES.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-brand-400 font-bold block">
                    {cat.nameFr}
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    {cat.tools.map((tl) => (
                      <button
                        key={tl.id}
                        onClick={() => {
                          setActiveDrawingTool(tl.id);
                          setPendingPoints([]);
                          setActiveDrawer(null);
                          toast(`Outil ${tl.nameFr} sélectionné. Cliquez sur le graphique pour positionner.`);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition ${
                          activeDrawingTool === tl.id
                            ? 'bg-brand-600 text-white font-bold'
                            : 'bg-gray-800/60 hover:bg-gray-800 text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-900 border border-gray-700 text-sm font-bold text-amber-400">
                            {tl.symbol}
                          </span>
                          <span>{tl.nameFr}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {tl.points === 1 ? '1 clic' : '2 clics'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {drawings.length > 0 && (
              <button
                onClick={handleClearDrawings}
                className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-gray-800 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 text-xs font-bold transition border border-gray-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Effacer tous les tracés ({drawings.length})
              </button>
            )}
          </aside>
        )}

        {/* INDICATORS SELECTOR POPOVER */}
        {activeDrawer === 'indicators' && (
          <aside className="absolute top-12 left-64 w-80 border border-gray-800 bg-[#0d1322] rounded-2xl shadow-2xl z-30 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-purple-400" /> Indicateurs Techniques
              </span>
              <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-yellow-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" /> EMA 9 (Moyenne Rapide)
                </span>
                <input
                  type="checkbox"
                  checked={showEMA9}
                  onChange={(e) => setShowEMA9(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-orange-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-orange-400" /> EMA 21 (Tendance Courte)
                </span>
                <input
                  type="checkbox"
                  checked={showEMA21}
                  onChange={(e) => setShowEMA21(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-cyan-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> EMA 50 (Dynamique Clé)
                </span>
                <input
                  type="checkbox"
                  checked={showEMA50}
                  onChange={(e) => setShowEMA50(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-purple-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> EMA 200 (Tendance Majeure)
                </span>
                <input
                  type="checkbox"
                  checked={showEMA200}
                  onChange={(e) => setShowEMA200(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-blue-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> SMA 20 (Base Bollinger)
                </span>
                <input
                  type="checkbox"
                  checked={showSMA20}
                  onChange={(e) => setShowSMA20(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> SMA 50 (Moyen Terme)
                </span>
                <input
                  type="checkbox"
                  checked={showSMA50}
                  onChange={(e) => setShowSMA50(e.target.checked)}
                  className="rounded text-brand-500"
                />
              </label>
            </div>
          </aside>
        )}

        {/* SPEED SELECTOR POPOVER */}
        {activeDrawer === 'speed' && (
          <aside className="absolute bottom-16 left-16 w-44 border border-gray-800 bg-[#0d1322] rounded-xl shadow-2xl z-30 p-2 space-y-1 animate-fadeIn">
            <span className="text-[10px] uppercase font-bold text-gray-400 block px-2 py-1">
              Vitesse de Replay
            </span>
            {[0.2, 0.5, 1, 2, 3, 5].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPlaybackSpeed(s);
                  setActiveDrawer(null);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  playbackSpeed === s ? 'bg-brand-500 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {s}x {s === 1 ? '(Normal 1s)' : s < 1 ? `(Lent ${1 / s}s)` : `(Rapide ${s} bougies/s)`}
              </button>
            ))}
          </aside>
        )}

        {/* SETTINGS THEME POPOVER */}
        {activeDrawer === 'settings' && (
          <aside className="absolute top-12 right-4 w-60 border border-gray-800 bg-[#0d1322] rounded-2xl shadow-2xl z-30 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-xs text-white">Thème du Graphique</span>
              <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {THEME_COLORS.map((thm) => (
                <button
                  key={thm.id}
                  onClick={() => setChartTheme(thm)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                    chartTheme.id === thm.id ? 'bg-brand-500 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{thm.label}</span>
                  <span className="h-3 w-3 rounded-full border border-gray-600" style={{ backgroundColor: thm.bg }} />
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* DATE RANGE MODAL (Mois, Jour, Année) */}
      {showDateRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#0d1322] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-400" />
                <h3 className="font-bold text-sm text-white">Délimiter la Période du Backtest</h3>
              </div>
              <button onClick={() => setShowDateRangeModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Sélectionnez la période historique de début et de fin pour initialiser le backtest (Mois, Jour, Année).
            </p>

            {/* Date Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Date de Début
                </label>
                <input
                  type="date"
                  value={modalStartDate}
                  onChange={(e) => setModalStartDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Date de Fin
                </label>
                <input
                  type="date"
                  value={modalEndDate}
                  onChange={(e) => setModalEndDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-500">Périodes prédéfinies :</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: '30 Jours', days: 30 },
                  { label: '3 Mois', days: 90 },
                  { label: '6 Mois', days: 180 },
                  { label: '1 An', days: 365 },
                  { label: 'Année 2025', year: 2025 },
                  { label: 'Année 2026', year: 2026 },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      if (p.year) {
                        setModalStartDate(`${p.year}-01-01`);
                        setModalEndDate(`${p.year}-12-31`);
                      } else {
                        const past = new Date();
                        past.setDate(past.getDate() - p.days);
                        setModalStartDate(past.toISOString().slice(0, 10));
                        setModalEndDate(now.toISOString().slice(0, 10));
                      }
                    }}
                    className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-1.5 text-center text-[11px] font-semibold text-gray-300 hover:border-brand-500/50 hover:bg-gray-800 hover:text-white transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={() => setShowDateRangeModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={() => handleApplyDateRange(modalStartDate, modalEndDate)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-lg shadow-brand-600/30 transition"
              >
                Appliquer la période
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOOL SETTINGS MODAL */}
      {showToolSettings && selectedDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#0d1322] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-800 text-sm font-bold text-amber-400">
                  {selectedToolMeta?.symbol || '⚙️'}
                </span>
                <h3 className="font-bold text-sm text-white">
                  Paramètres : {selectedToolMeta?.nameFr || selectedDrawing.type}
                </h3>
              </div>
              <button onClick={() => setShowToolSettings(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Color & Line Appearance */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                Couleur & Épaisseur
              </label>
              <div className="flex items-center gap-2">
                {['#3b82f6', '#10b981', '#ef4444', '#eab308', '#a855f7', '#06b6d4', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateDrawingProperty(selectedDrawing.id, { color: c })}
                    className={`h-6 w-6 rounded-full border transition ${
                      selectedDrawing.color === c ? 'scale-110 border-white ring-2 ring-brand-400' : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Position Specific Settings (Long / Short) */}
            {(selectedDrawing.type === 'long_position' || selectedDrawing.type === 'short_position') && (
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Prix d'Entrée
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={selectedDrawing.entry}
                    onChange={(e) =>
                      updateDrawingProperty(selectedDrawing.id, { entry: parseFloat(e.target.value) || selectedDrawing.entry })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Take Profit (TP)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={selectedDrawing.tp}
                      onChange={(e) =>
                        updateDrawingProperty(selectedDrawing.id, { tp: parseFloat(e.target.value) || selectedDrawing.tp })
                      }
                      className="w-full rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs font-mono font-bold text-emerald-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                      Stop Loss (SL)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={selectedDrawing.sl}
                      onChange={(e) =>
                        updateDrawingProperty(selectedDrawing.id, { sl: parseFloat(e.target.value) || selectedDrawing.sl })
                      }
                      className="w-full rounded-xl border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs font-mono font-bold text-rose-300 focus:outline-none"
                    />
                  </div>
                </div>
                {/* Risk / Reward preview */}
                <div className="rounded-xl bg-gray-900 p-2.5 flex items-center justify-between text-xs">
                  <span className="text-gray-400">Ratio Risque / Rendement :</span>
                  <span className="font-mono font-bold text-brand-400">
                    1 :{' '}
                    {selectedDrawing.type === 'long_position'
                      ? (
                          (selectedDrawing.tp - selectedDrawing.entry) /
                          Math.max(0.000001, selectedDrawing.entry - selectedDrawing.sl)
                        ).toFixed(2)
                      : (
                          (selectedDrawing.entry - selectedDrawing.tp) /
                          Math.max(0.000001, selectedDrawing.sl - selectedDrawing.entry)
                        ).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Fibonacci Levels Config */}
            {selectedDrawing.type === 'fibonacci' && (
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                  Niveaux de Fibonacci
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618].map((lvl) => {
                    const currentLvls = selectedDrawing.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
                    const checked = currentLvls.includes(lvl);
                    return (
                      <label key={lvl} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...currentLvls, lvl].sort((a, b) => a - b)
                              : currentLvls.filter((x) => x !== lvl);
                            updateDrawingProperty(selectedDrawing.id, { fibLevels: next });
                          }}
                          className="rounded text-brand-500"
                        />
                        <span className="font-mono font-bold text-gray-200">{lvl * 100}%</span>
                        {lvl === 0.618 && <span className="text-[10px] text-amber-400 font-bold">(Golden)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <button
                onClick={() => handleDeleteDrawing(selectedDrawing.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs font-bold text-rose-400 hover:bg-rose-900/50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
              <button
                onClick={() => setShowToolSettings(false)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
