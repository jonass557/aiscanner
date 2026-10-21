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
  ShieldAlert,
  Target,
  Zap,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Activity,
  PlusCircle,
  HelpCircle,
  BarChart2,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { marketApi, strategyApi, userApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
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
  { id: 'crypto', label: 'Crypto-Monnaies (Binance)' },
  { id: 'synthetics', label: 'Indices Synthétiques (Deriv)' },
];

const PAIRS_BY_CAT = {
  forex: [
    // Majeures
    { symbol: 'EURUSD', label: 'EUR/USD · Euro / Dollar US', base: 1.0865 },
    { symbol: 'GBPUSD', label: 'GBP/USD · Livre / Dollar US', base: 1.271 },
    { symbol: 'USDJPY', label: 'USD/JPY · Dollar US / Yen', base: 156.2 },
    { symbol: 'USDCHF', label: 'USD/CHF · Dollar US / Franc Suisse', base: 0.904 },
    { symbol: 'AUDUSD', label: 'AUD/USD · Dollar Australien / US', base: 0.664 },
    { symbol: 'USDCAD', label: 'USD/CAD · Dollar US / Canadien', base: 1.368 },
    { symbol: 'NZDUSD', label: 'NZD/USD · Dollar NZ / Dollar US', base: 0.61 },
    // Mineures & Crosses
    { symbol: 'EURGBP', label: 'EUR/GBP · Euro / Livre', base: 0.855 },
    { symbol: 'EURJPY', label: 'EUR/JPY · Euro / Yen', base: 169.7 },
    { symbol: 'GBPJPY', label: 'GBP/JPY · Livre / Yen', base: 198.4 },
    { symbol: 'EURAUD', label: 'EUR/AUD · Euro / Aussie', base: 1.636 },
    { symbol: 'EURCAD', label: 'EUR/CAD · Euro / Dollar Canadien', base: 1.486 },
    { symbol: 'EURCHF', label: 'EUR/CHF · Euro / Franc Suisse', base: 0.982 },
    { symbol: 'EURNZD', label: 'EUR/NZD · Euro / Dollar NZ', base: 1.778 },
    { symbol: 'GBPAUD', label: 'GBP/AUD · Livre / Aussie', base: 1.913 },
    { symbol: 'GBPCAD', label: 'GBP/CAD · Livre / Dollar Canadien', base: 1.738 },
    { symbol: 'GBPCHF', label: 'GBP/CHF · Livre / Franc Suisse', base: 1.148 },
    { symbol: 'GBPNZD', label: 'GBP/NZD · Livre / Dollar NZ', base: 2.082 },
    { symbol: 'AUDCAD', label: 'AUD/CAD · Aussie / Dollar Canadien', base: 0.908 },
    { symbol: 'AUDCHF', label: 'AUD/CHF · Aussie / Franc Suisse', base: 0.601 },
    { symbol: 'AUDJPY', label: 'AUD/JPY · Aussie / Yen', base: 103.7 },
    { symbol: 'AUDNZD', label: 'AUD/NZD · Aussie / Kiwi', base: 1.088 },
    { symbol: 'CADCHF', label: 'CAD/CHF · Dollar Canadien / Franc', base: 0.661 },
    { symbol: 'CADJPY', label: 'CAD/JPY · Dollar Canadien / Yen', base: 114.2 },
    { symbol: 'CHFJPY', label: 'CHF/JPY · Franc Suisse / Yen', base: 172.8 },
    { symbol: 'NZDCAD', label: 'NZD/CAD · Kiwi / Dollar Canadien', base: 0.835 },
    { symbol: 'NZDCHF', label: 'NZD/CHF · Kiwi / Franc Suisse', base: 0.552 },
    { symbol: 'NZDJPY', label: 'NZD/JPY · Kiwi / Yen', base: 95.3 },
    // Exotiques
    { symbol: 'USDZAR', label: 'USD/ZAR · Dollar / Rand Sud-Africain', base: 18.25 },
    { symbol: 'USDMXN', label: 'USD/MXN · Dollar / Peso Mexicain', base: 19.85 },
    { symbol: 'USDTRY', label: 'USD/TRY · Dollar / Livre Turque', base: 34.25 },
    { symbol: 'USDBRL', label: 'USD/BRL · Dollar / Real Brésilien', base: 5.65 },
    { symbol: 'USDSEK', label: 'USD/SEK · Dollar / Couronne Suédoise', base: 10.42 },
    { symbol: 'USDNOK', label: 'USD/NOK · Dollar / Couronne Norvégienne', base: 10.88 },
    { symbol: 'USDPLN', label: 'USD/PLN · Dollar / Zloty Polonais', base: 3.96 },
    { symbol: 'USDSGD', label: 'USD/SGD · Dollar / Dollar Singapour', base: 1.312 },
    { symbol: 'USDHKD', label: 'USD/HKD · Dollar / Dollar Hong Kong', base: 7.77 },
    { symbol: 'USDCNH', label: 'USD/CNH · Dollar / Yuan Offshore', base: 7.12 },
    { symbol: 'EURTRY', label: 'EUR/TRY · Euro / Livre Turque', base: 37.2 },
    { symbol: 'EURZAR', label: 'EUR/ZAR · Euro / Rand Sud-Africain', base: 19.82 },
    { symbol: 'GBPZAR', label: 'GBP/ZAR · Livre / Rand Sud-Africain', base: 23.2 },
  ],
  commodities: [
    { symbol: 'XAUUSD', label: 'Or (Gold / XAUUSD)', base: 2685.0 },
    { symbol: 'XAGUSD', label: 'Argent (Silver / XAGUSD)', base: 31.8 },
    { symbol: 'USOIL', label: 'Pétrole Brut (WTI)', base: 74.5 },
    { symbol: 'UKOIL', label: 'Pétrole Brent Mer du Nord', base: 78.2 },
  ],
  indices: [
    { symbol: 'US30', label: 'Dow Jones (US30)', base: 43250 },
    { symbol: 'NAS100', label: 'Nasdaq 100 (NAS100)', base: 20450 },
    { symbol: 'SPX500', label: 'S&P 500 (SPX500)', base: 5860 },
    { symbol: 'GER40', label: 'DAX 40 (Allemagne)', base: 19550 },
    { symbol: 'UK100', label: 'FTSE 100 (Royaume-Uni)', base: 8250 },
    { symbol: 'FRA40', label: 'CAC 40 (France)', base: 7520 },
    { symbol: 'JPN225', label: 'Nikkei 225 (Japon)', base: 38950 },
  ],
  crypto: [
    { symbol: 'BTCUSD', label: 'Bitcoin (BTC/USD)', base: 68400 },
    { symbol: 'ETHUSD', label: 'Ethereum (ETH/USD)', base: 2640 },
    { symbol: 'SOLUSD', label: 'Solana (SOL/USD)', base: 158.0 },
    { symbol: 'XRPUSD', label: 'XRP (XRP/USD)', base: 0.548 },
    { symbol: 'BNBUSD', label: 'Binance Coin (BNB/USD)', base: 595 },
    { symbol: 'ADAUSD', label: 'Cardano (ADA/USD)', base: 0.355 },
    { symbol: 'DOGEUSD', label: 'Dogecoin (DOGE/USD)', base: 0.142 },
  ],
  synthetics: [
    { symbol: 'Volatility 75 Index', label: 'Volatility 75 Index (V75)', base: 325400 },
    { symbol: 'Volatility 100 Index', label: 'Volatility 100 Index (V100)', base: 1840 },
    { symbol: 'Volatility 50 Index', label: 'Volatility 50 Index (V50)', base: 412.5 },
    { symbol: 'Volatility 25 Index', label: 'Volatility 25 Index (V25)', base: 2450 },
    { symbol: 'Volatility 10 Index', label: 'Volatility 10 Index (V10)', base: 1250 },
    { symbol: 'Boom 1000 Index', label: 'Boom 1000 Index', base: 12500 },
    { symbol: 'Crash 1000 Index', label: 'Crash 1000 Index', base: 6400 },
    { symbol: 'Boom 500 Index', label: 'Boom 500 Index', base: 4820 },
    { symbol: 'Crash 500 Index', label: 'Crash 500 Index', base: 3910 },
    { symbol: 'Boom 300 Index', label: 'Boom 300 Index', base: 3200 },
    { symbol: 'Crash 300 Index', label: 'Crash 300 Index', base: 2800 },
    { symbol: 'Step Index', label: 'Step Index Deriv', base: 8420 },
  ],
};

const TIMEFRAMES = [
  { id: '1m', label: 'M1' },
  { id: '2m', label: 'M2' },
  { id: '3m', label: 'M3' },
  { id: '5m', label: 'M5' },
  { id: '15m', label: 'M15' },
  { id: '30m', label: 'M30' },
  { id: '45m', label: 'M45' },
  { id: '1h', label: 'H1' },
  { id: '2h', label: 'H2' },
  { id: '3h', label: 'H3' },
  { id: '4h', label: 'H4' },
  { id: '1d', label: 'D1' },
  { id: '1w', label: 'W1' },
  { id: '1mo', label: 'Monthly' },
  { id: '3M', label: '3 Months' },
  { id: '6M', label: '6 Months' },
  { id: '12M', label: '12 Months' },
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // HTML overlay coordinates for shaded Supply/Demand zones & Long/Short Position Tool
  const [zoneBoxes, setZoneBoxes] = useState({ supply: null, demand: null, mid: null });
  const [positionBox, setPositionBox] = useState(null);

  // Left sidebar drawers / accordion states: 'order' | 'zones' | 'confluences' | null
  const [openDrawer, setOpenDrawer] = useState('order');

  const chartContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
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

  // Category switch
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    const firstPair = PAIRS_BY_CAT[catId]?.[0] || PAIRS_BY_CAT.forex[0];
    setSelectedPair(firstPair);
  };

  // Fetch live market data or clean fallback (Unlimited up to 5000 candles)
  const loadMarketData = useCallback(async () => {
    setLoading(true);
    try {
      let finalCandles = [];
      let real = false;

      try {
        const snap = await marketApi.snapshot(selectedPair.symbol, selectedTf, 1500);
        const rawBars = snap.data?.data?.market?.candles || snap.data?.data?.candles;
        if (Array.isArray(rawBars) && rawBars.length > 25) {
          finalCandles = sanitizeCandles(rawBars, selectedPair.base);
          real = Boolean(snap.data?.data?.market?.isRealData);
        }
      } catch (e) {
        console.warn('Live feed snapshot fallback:', e);
      }

      if (!finalCandles || finalCandles.length < 25) {
        finalCandles = generateRealisticCandles(selectedPair.base, selectedTf, 500);
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
        customStrategyText:
          typeof userSavedStrategy === 'string'
            ? userSavedStrategy
            : userSavedStrategy?.rules?.join('\n') || '',
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
        height: chartContainerRef.current.clientHeight || 700,
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
          scaleMargins: { top: 0.1, bottom: 0.1 },
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
            height: chartContainerRef.current.clientHeight || 700,
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

  // Update chart data & plot strategy overlays & Long/Short Position Tool
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const dp = getDecimals(candles[candles.length - 1]?.close || selectedPair.base);
    seriesRef.current.applyOptions({
      priceFormat: {
        type: 'price',
        precision: dp,
        minMove: Math.pow(10, -dp),
      },
    });

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

    // Update shaded overlay box pixel coordinates & TradingView Position Box
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

        // Compute Automatic Long / Short Position tool overlay on the chart
        if (analysis.entry && analysis.sl && analysis.tp1) {
          const entryCoord = seriesRef.current.priceToCoordinate(analysis.entry);
          const slCoord = seriesRef.current.priceToCoordinate(analysis.sl);
          const tpCoord = seriesRef.current.priceToCoordinate(analysis.tp1);

          if (entryCoord !== null && slCoord !== null && tpCoord !== null) {
            const isBuy = analysis.direction === 'BUY';
            const targetTop = isBuy ? Math.min(tpCoord, entryCoord) : Math.min(entryCoord, tpCoord);
            const targetHeight = Math.max(8, Math.abs(entryCoord - tpCoord));
            const stopTop = isBuy ? Math.min(entryCoord, slCoord) : Math.min(slCoord, entryCoord);
            const stopHeight = Math.max(8, Math.abs(slCoord - entryCoord));

            setPositionBox({
              isBuy,
              entryY: entryCoord,
              targetTop,
              targetHeight,
              stopTop,
              stopHeight,
              entryPrice: analysis.entry,
              tpPrice: analysis.tp1,
              slPrice: analysis.sl,
              rr: analysis.riskReward || '1:3.0',
              winRate: analysis.biasScore || 85,
            });
          } else {
            setPositionBox(null);
          }
        } else {
          setPositionBox(null);
        }
      } catch {
        // ignore
      }
    };

    updateOverlays();
  }, [candles, analysis, autoTrace, selectedPair]);

  // Combined strategies list (Defaults + Admin DB + Saved User Strategy)
  const mergedStrategies = useMemo(() => {
    const list = [
      { key: 'smc', name: 'Smart Money Concepts (SMC - Order Blocks & FVG)' },
      { key: 'support_resistance', name: 'Support & Résistance (Price Action / Polarité)' },
      { key: 'ict', name: 'ICT Precision (Killzones & Liquidity Sweeps)' },
      { key: 'trend_following', name: 'Trend Following & Pullback EMA Institutionnel' },
    ];

    // Append admin strategies from backend if not duplicates
    availableStrategies.forEach((st) => {
      if (!list.some((x) => x.key === st.key || x.name === st.name)) {
        list.push({
          key: st.key || st._id,
          name: `${st.name} [Admin]`,
        });
      }
    });

    // Append saved user strategy
    if (userSavedStrategy) {
      list.unshift({
        key: 'user_saved',
        name: `★ Ma Stratégie (${typeof userSavedStrategy === 'string' ? 'Profil' : userSavedStrategy.name || 'Enregistrée'})`,
      });
    }

    return list;
  }, [availableStrategies, userSavedStrategy]);

  const lastCandle = candles[candles.length - 1];

  // Toggle drawer helper
  const handleToggleDrawer = (drawerName) => {
    setOpenDrawer((prev) => (prev === drawerName ? null : drawerName));
  };

  return (
    <div className={`space-y-3 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#090d16] p-3 overflow-hidden flex flex-col' : ''}`}>
      {/* 1. SINGLE SLENDER TOP BAR (DROPDOWNS ON SAME ROW) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/90 backdrop-blur-md px-3.5 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Market Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:inline">
              Marché:
            </span>
            <select
              value={activeCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Pair / Asset Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:inline">
              Actif:
            </span>
            <select
              value={selectedPair.symbol}
              onChange={(e) => {
                const pair = PAIRS_BY_CAT[activeCategory].find((p) => p.symbol === e.target.value);
                if (pair) setSelectedPair(pair);
              }}
              className="rounded-xl border border-brand-500/50 bg-brand-50/50 dark:bg-brand-950/40 px-3 py-1.5 text-xs font-black text-brand-600 dark:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-sm"
            >
              {PAIRS_BY_CAT[activeCategory]?.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Dropdown (including H2, H3, Monthly) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:inline">
              Temps:
            </span>
            <select
              value={selectedTf}
              onChange={(e) => setSelectedTf(e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-sm"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.id} value={tf.id}>
                  {tf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:inline">
              Stratégie:
            </span>
            <select
              value={selectedStratKey}
              onChange={(e) => setSelectedStratKey(e.target.value)}
              className="rounded-xl border border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/40 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm max-w-[210px] truncate"
            >
              {mergedStrategies.map((strat) => (
                <option key={strat.key} value={strat.key}>
                  {strat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side controls: Auto-trace, Refresh, Feed Badge, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Tracage Auto Toggle */}
          <button
            onClick={() => setAutoTrace(!autoTrace)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
              autoTrace
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
            title="Activer/masquer le traçage automatique de la stratégie"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{autoTrace ? 'Tracage On' : 'Tracage Off'}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => {
              setRefreshing(true);
              loadMarketData().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:text-brand-500 transition shadow-sm"
            title="Actualiser le flux de marché"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
          </button>

          {/* Feed status badge */}
          {isRealFeed ? (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
              <Zap className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/20">
              Continu
            </span>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:text-brand-500 transition shadow-sm"
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Admin link if user is admin */}
          {user?.role === 'admin' && (
            <Link
              to="/admin/strategies"
              className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-400 hover:bg-purple-500/20 transition hidden md:inline-flex items-center gap-1"
              title="Gérer les stratégies du système"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: LEFT COLLAPSIBLE ACCORDION SIDEBAR + EXPANSIVE CHART CANVAS */}
      <div className={`flex flex-col lg:flex-row gap-3 ${isFullscreen ? 'flex-1 min-h-0' : ''}`} ref={chartWrapperRef}>
        {/* LEFT SIDEBAR WITH "ORDRE", "ZONES", "CONFLUENCES" DROPDOWNS */}
        <div className={`flex flex-col gap-2 shrink-0 transition-all duration-300 ${openDrawer ? 'w-full lg:w-80' : 'w-full lg:w-14'}`}>
          {/* Sidebar Action Buttons Rail */}
          <div className="flex lg:flex-col gap-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/80 p-1.5 backdrop-blur shadow-sm">
            {/* 1. ORDRE BUTTON */}
            <button
              onClick={() => handleToggleDrawer('order')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition w-full ${
                openDrawer === 'order'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Afficher / Masquer l'Ordre Suggéré"
            >
              <Target className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="font-extrabold uppercase tracking-wide">Ordre</span>
              {openDrawer === 'order' ? (
                <ChevronDown className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              )}
            </button>

            {/* 2. ZONES BUTTON */}
            <button
              onClick={() => handleToggleDrawer('zones')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition w-full ${
                openDrawer === 'zones'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Afficher / Masquer les Zones & Liquidités"
            >
              <Layers className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="font-extrabold uppercase tracking-wide">Zones</span>
              {openDrawer === 'zones' ? (
                <ChevronDown className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              )}
            </button>

            {/* 3. CONFLUENCES BUTTON */}
            <button
              onClick={() => handleToggleDrawer('confluences')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition w-full ${
                openDrawer === 'confluences'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Afficher / Masquer les Confluences Stratégiques"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="font-extrabold uppercase tracking-wide">Confluences</span>
              {openDrawer === 'confluences' ? (
                <ChevronDown className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 ml-auto hidden lg:inline" />
              )}
            </button>
          </div>

          {/* ACTIVE DRAWER CONTENT (ONLY WHEN OPEN) */}
          {openDrawer && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/95 p-3.5 shadow-xl backdrop-blur-md space-y-3 overflow-y-auto max-h-[640px]">
              {/* DRAWER: ORDRE */}
              {openDrawer === 'order' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Ordre Suggéré
                    </span>
                    {analysis && (
                      <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                        R:R {analysis.riskReward}
                      </span>
                    )}
                  </div>

                  {analysis ? (
                    <>
                      <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/80 p-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Biais Actif
                          </span>
                          <p
                            className={`text-xl font-black ${
                              analysis.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {analysis.direction === 'BUY' ? 'ACHAT (LONG)' : 'VENTE (SHORT)'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Win Rate
                          </span>
                          <p className="text-xl font-black text-brand-400">{analysis.biasScore}%</p>
                        </div>
                      </div>

                      {/* Execution Levels */}
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-blue-300">
                          <span className="font-sans font-bold text-[11px]">Entrée (Entry):</span>
                          <span className="font-black text-sm">{analysis.entry}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-red-300">
                          <span className="font-sans font-bold text-[11px]">Stop Loss (SL):</span>
                          <span className="font-black text-sm">{analysis.sl}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-300">
                          <span className="font-sans font-bold text-[11px]">Take Profit 1:</span>
                          <span className="font-black text-sm">{analysis.tp1}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-cyan-300">
                          <span className="font-sans font-bold text-[11px]">Take Profit 2 (Max):</span>
                          <span className="font-black text-sm">{analysis.tp2}</span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-2.5 text-xs text-gray-400">
                        <span className="font-bold text-gray-200 block mb-0.5">Structure:</span>
                        <span>{analysis.structure}</span>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">
                      <Spinner />
                      <p className="mt-2">Détection de l'ordre...</p>
                    </div>
                  )}
                </div>
              )}

              {/* DRAWER: ZONES & LIQUIDITÉS */}
              {openDrawer === 'zones' && (
                <div className="space-y-3">
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Zones & Liquidités Détectées
                    </span>
                  </div>

                  {analysis ? (
                    <>
                      {/* Supply OB */}
                      <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-red-400">SUPPLY (Zone Vendeuse)</span>
                        </div>
                        <p className="font-mono text-sm font-bold text-red-300">
                          {analysis.supplyZone.bottom} — {analysis.supplyZone.top}
                        </p>
                        <p className="text-[10px] text-gray-400">Zone institutionnelle de rejet ou TP.</p>
                      </div>

                      {/* Demand OB */}
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-emerald-400">DEMAND (Zone Acheteuse)</span>
                        </div>
                        <p className="font-mono text-sm font-bold text-emerald-300">
                          {analysis.demandZone.bottom} — {analysis.demandZone.top}
                        </p>
                        <p className="text-[10px] text-gray-400">Zone institutionnelle d'accumulation.</p>
                      </div>

                      {/* Liquidity pools */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Poches de Liquidité Clés
                        </span>
                        {analysis.liquidityPools?.map((liq, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1.5 text-xs"
                          >
                            <span className="text-gray-300 text-[11px] truncate">{liq.type}</span>
                            <span className="font-mono font-bold text-sky-400">{liq.price}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">
                      <Spinner />
                      <p className="mt-2">Cartographie des zones...</p>
                    </div>
                  )}
                </div>
              )}

              {/* DRAWER: CONFLUENCES */}
              {openDrawer === 'confluences' && (
                <div className="space-y-3">
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Confluences Stratégiques
                    </span>
                  </div>

                  {analysis ? (
                    <ul className="space-y-2">
                      {analysis.confluences?.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 text-xs text-gray-300"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">
                      <Spinner />
                      <p className="mt-2">Validation des règles...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. EXPANSIVE REAL-TIME CHART CANVAS (TAKES ALL REMAINING SPACE) */}
        <div className="flex-1 min-w-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#090d16] overflow-hidden flex flex-col justify-between shadow-xl">
          {/* Chart Header Bar with Active Pair, Timeframe, Bias Pill & Legend */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-800 bg-[#090d16]/90 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-base font-black text-white">
                {selectedPair.label?.split('·')[0] || selectedPair.symbol} · {selectedTf.toUpperCase()}
              </span>
              {analysis && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-black border ${
                    analysis.direction === 'BUY'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  Biais {analysis.direction === 'BUY' ? 'ACHAT (HAUSSIER)' : 'VENTE (BAISSIER)'}
                </span>
              )}
              <span className="text-gray-400 hidden sm:inline">
                Stratégie : <strong className="text-gray-200">{analysis?.strategyName || selectedStratKey}</strong>
              </span>
            </div>

            {/* Quick Chart Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-400">
              <span className="flex items-center gap-1 text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Supply OB
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Demand OB
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> Liquidité
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Ordre Auto
              </span>
            </div>
          </div>

          {/* Interactive Chart Container with Visual Shaded Bands & Long/Short Position Tool */}
          <div className="relative flex-1 min-h-[580px] lg:min-h-[700px] w-full bg-[#090d16]">
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <Spinner />
              </div>
            )}

            {/* Visual Shaded Bands for Supply Zone */}
            {autoTrace && zoneBoxes.supply && (
              <div
                className="pointer-events-none absolute left-0 right-16 z-10 border-y border-red-500/40 bg-red-500/10 transition-all"
                style={{
                  top: `${zoneBoxes.supply.top}px`,
                  height: `${zoneBoxes.supply.height}px`,
                }}
              >
                <span className="absolute left-3 top-1 text-[10px] font-black uppercase tracking-wider text-red-400 bg-black/60 px-1.5 py-0.5 rounded">
                  {analysis?.supplyZone?.shortLabel || 'ZONE DE SUPPLY OB'}
                </span>
              </div>
            )}

            {/* Visual Shaded Bands for Demand Zone */}
            {autoTrace && zoneBoxes.demand && (
              <div
                className="pointer-events-none absolute left-0 right-16 z-10 border-y border-emerald-500/40 bg-emerald-500/10 transition-all"
                style={{
                  top: `${zoneBoxes.demand.top}px`,
                  height: `${zoneBoxes.demand.height}px`,
                }}
              >
                <span className="absolute left-3 top-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
                  {analysis?.demandZone?.shortLabel || 'ZONE DE DEMAND OB'}
                </span>
              </div>
            )}

            {/* AUTOMATIC TRADINGVIEW LONG / SHORT POSITION TOOL ON CANVAS */}
            {autoTrace && positionBox && (
              <div className="pointer-events-none absolute left-[30%] right-16 z-20 transition-all">
                {/* Target / Profit Zone (Green Box) */}
                <div
                  className="absolute left-0 right-0 rounded-t border-2 border-emerald-500/80 bg-emerald-500/20 backdrop-blur-[1px] flex items-start justify-between px-3 py-1 shadow-lg"
                  style={{
                    top: `${positionBox.targetTop}px`,
                    height: `${positionBox.targetHeight}px`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-black tracking-wide text-emerald-300 uppercase">
                      TP1 (Objectif) · {positionBox.tpPrice}
                    </span>
                  </div>
                  <span className="rounded bg-emerald-950/90 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/50 shadow">
                    Zone de Profit (Target)
                  </span>
                </div>

                {/* Central Entry Line */}
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-blue-400 z-20 flex items-center justify-between px-3"
                  style={{
                    top: `${positionBox.entryY}px`,
                    transform: 'translateY(-1px)',
                  }}
                >
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow">
                    {positionBox.isBuy ? '▲ ORDRE LONG (ACHAT)' : '▼ ORDRE SHORT (VENTE)'} @ {positionBox.entryPrice}
                  </span>
                  <span className="rounded bg-blue-950/95 px-2 py-0.5 text-[10px] font-bold text-blue-200 border border-blue-500/60 shadow">
                    Ratio R:R {positionBox.rr} · {positionBox.winRate}% Biais
                  </span>
                </div>

                {/* Stop Loss / Risk Zone (Red Box) */}
                <div
                  className="absolute left-0 right-0 rounded-b border-2 border-red-500/80 bg-red-500/20 backdrop-blur-[1px] flex items-end justify-between px-3 py-1 shadow-lg"
                  style={{
                    top: `${positionBox.stopTop}px`,
                    height: `${positionBox.stopHeight}px`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-[11px] font-black tracking-wide text-red-300 uppercase">
                      SL (Stop Loss) · {positionBox.slPrice}
                    </span>
                  </div>
                  <span className="rounded bg-red-950/90 px-2 py-0.5 text-[10px] font-black text-red-300 border border-red-500/50 shadow">
                    Zone de Risque (Stop)
                  </span>
                </div>
              </div>
            )}

            {/* The Lightweight Charts DOM element */}
            <div ref={chartContainerRef} className="h-full min-h-[580px] lg:min-h-[700px] w-full" />
          </div>

          {/* Bottom Chart Footer with Price Stats */}
          {lastCandle && (
            <div className="flex flex-wrap items-center justify-between border-t border-gray-800 bg-[#090d16] px-4 py-2 text-xs text-gray-400 font-mono">
              <div className="flex items-center gap-4">
                <span>O: <strong className="text-gray-200">{lastCandle.open}</strong></span>
                <span>H: <strong className="text-emerald-400">{lastCandle.high}</strong></span>
                <span>L: <strong className="text-red-400">{lastCandle.low}</strong></span>
                <span>C: <strong className="text-gray-200">{lastCandle.close}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">Bougies chargées : {candles.length}</span>
                <span>Dernière bougie : {new Date(lastCandle.time * 1000).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}