import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Scissors,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Sliders,
  Zap,
  Activity,
  Layers,
  CheckCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { marketApi } from '../../services/endpoints.js';
import { formatPrice } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const ALL_PAIRS = [
  // Forex
  { symbol: 'EURUSD', category: 'Forex', label: 'EUR/USD' },
  { symbol: 'GBPUSD', category: 'Forex', label: 'GBP/USD' },
  { symbol: 'USDJPY', category: 'Forex', label: 'USD/JPY' },
  { symbol: 'AUDUSD', category: 'Forex', label: 'AUD/USD' },
  { symbol: 'USDCAD', category: 'Forex', label: 'USD/CAD' },
  { symbol: 'EURJPY', category: 'Forex', label: 'EUR/JPY' },
  { symbol: 'GBPJPY', category: 'Forex', label: 'GBP/JPY' },

  // Commodities & Métaux
  { symbol: 'XAUUSD', category: 'Métaux', label: 'Or (Gold / XAUUSD)' },
  { symbol: 'XAGUSD', category: 'Métaux', label: 'Argent (Silver / XAGUSD)' },
  { symbol: 'USOIL', category: 'Matières Premières', label: 'Pétrole Brut (WTI)' },

  // Indices Mondiaux
  { symbol: 'US30', category: 'Indices', label: 'Dow Jones (US30)' },
  { symbol: 'NAS100', category: 'Indices', label: 'Nasdaq 100 (NAS100)' },
  { symbol: 'SPX500', category: 'Indices', label: 'S&P 500' },
  { symbol: 'GER40', category: 'Indices', label: 'DAX 40 (Allemagne)' },

  // Crypto
  { symbol: 'BTCUSD', category: 'Crypto', label: 'Bitcoin (BTC/USD)' },
  { symbol: 'ETHUSD', category: 'Crypto', label: 'Ethereum (ETH/USD)' },
  { symbol: 'SOLUSD', category: 'Crypto', label: 'Solana (SOL/USD)' },

  // Synthétiques
  { symbol: 'Volatility 75 Index', category: 'Synthétiques', label: 'Volatility 75 Index' },
  { symbol: 'Boom 1000 Index', category: 'Synthétiques', label: 'Boom 1000 Index' },
];

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

export default function Backtesting() {
  const { t, lang } = useLanguage();
  const [selectedPair, setSelectedPair] = useState(ALL_PAIRS[0]);
  const [timeframe, setTimeframe] = useState('H1');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Replay State
  const [replayIndex, setReplayIndex] = useState(0); // number of visible candles
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x
  const [cutMode, setCutMode] = useState(false);

  // Position Simulation
  const [simulatedPosition, setSimulatedPosition] = useState(null); // { type: 'BUY'|'SELL', entry, pnl }
  const [tradeLogs, setTradeLogs] = useState([]);

  // Fetch full candles for replay
  useEffect(() => {
    let active = true;
    const fetchCandles = async () => {
      setLoading(true);
      setIsPlaying(false);
      try {
        const { data } = await marketApi.snapshot(selectedPair.symbol, timeframe);
        if (active && data?.data?.market?.candles?.length) {
          const rawCandles = data.data.market.candles;
          setCandles(rawCandles);
          // Default cut: show initial 60% of candles to allow replay forward
          const initialCut = Math.max(10, Math.floor(rawCandles.length * 0.6));
          setReplayIndex(initialCut);
        }
      } catch (err) {
        toast.error(lang === 'fr' ? 'Erreur de chargement des flux de données.' : 'Failed to fetch live candles.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCandles();
    return () => {
      active = false;
    };
  }, [selectedPair, timeframe, lang]);

  // Replay ticker
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = Math.max(200, 1000 / playbackSpeed);

    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= candles.length) {
          setIsPlaying(false);
          toast.success(lang === 'fr' ? 'Fin du replay atteinte.' : 'Replay finished.');
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, candles.length, lang]);

  // Update simulated position PnL with newest candle close
  useEffect(() => {
    if (!simulatedPosition || replayIndex <= 0) return;
    const currentBar = candles[replayIndex - 1];
    if (!currentBar) return;

    const diff = currentBar.close - simulatedPosition.entry;
    const pnl = simulatedPosition.type === 'BUY' ? diff : -diff;
    setSimulatedPosition((prev) => (prev ? { ...prev, currentPnl: pnl } : null));
  }, [replayIndex, candles, simulatedPosition?.entry, simulatedPosition?.type]);

  const visibleCandles = useMemo(() => {
    return candles.slice(0, replayIndex);
  }, [candles, replayIndex]);

  // Chart coordinate calculations
  const chartHeight = 420;
  const padding = { top: 20, right: 70, bottom: 25, left: 10 };

  const scale = useMemo(() => {
    if (!visibleCandles.length) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const c of visibleCandles) {
      if (c.low != null) min = Math.min(min, c.low);
      if (c.high != null) max = Math.max(max, c.high);
    }
    if (simulatedPosition) {
      min = Math.min(min, simulatedPosition.entry);
      max = Math.max(max, simulatedPosition.entry);
    }
    if (max <= min) return null;
    const pad = (max - min) * 0.05;
    min -= pad;
    max += pad;
    const plotH = chartHeight - padding.top - padding.bottom;
    const y = (price) => padding.top + ((max - price) / (max - min)) * plotH;
    return { min, max, y };
  }, [visibleCandles, simulatedPosition]);

  const handleCutClick = (index) => {
    if (cutMode) {
      setReplayIndex(index + 1);
      setCutMode(false);
      toast.success(lang === 'fr' ? `Point de replay fixé à la bougie ${index + 1}.` : `Replay cut set to bar ${index + 1}.`);
    }
  };

  const openSimulatedTrade = (type) => {
    if (replayIndex <= 0) return;
    const curBar = candles[replayIndex - 1];
    setSimulatedPosition({
      type,
      entry: curBar.close,
      currentPnl: 0,
      openIndex: replayIndex,
    });
    toast.success(lang === 'fr' ? `Position ${type} ouverte à ${formatPrice(curBar.close)}` : `Position ${type} opened at ${formatPrice(curBar.close)}`);
  };

  const closeSimulatedTrade = () => {
    if (!simulatedPosition) return;
    const curBar = candles[replayIndex - 1];
    const log = {
      ...simulatedPosition,
      exit: curBar.close,
      closeIndex: replayIndex,
    };
    setTradeLogs((prev) => [log, ...prev]);
    setSimulatedPosition(null);
    toast.success(lang === 'fr' ? 'Position clôturée.' : 'Position closed.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-gray-900 dark:text-white">
            <Zap className="h-7 w-7 text-brand-500 animate-pulse" /> {t('backtestTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('backtestSubtitle')}
          </p>
        </div>

        {/* Pair & Timeframe Selector Ribbon */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedPair.symbol}
            onChange={(e) => {
              const found = ALL_PAIRS.find((p) => p.symbol === e.target.value);
              if (found) setSelectedPair(found);
            }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {ALL_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>
                [{p.category}] {p.label}
              </option>
            ))}
          </select>

          <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  timeframe === tf
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chart Canvas & Interactive Replay Controls */}
      <div className="card overflow-hidden p-5 shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Replay Toolbar (TradingView-Style) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Button
              variant={isPlaying ? 'primary' : 'secondary'}
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? t('pause') : t('play')}</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                setIsPlaying(false);
                setReplayIndex((prev) => Math.min(candles.length, prev + 1));
              }}
              disabled={replayIndex >= candles.length}
              className="flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
              title={t('stepForward')}
            >
              <SkipForward className="h-4 w-4" />
              <span>+1 Barre</span>
            </Button>

            <Button
              variant={cutMode ? 'primary' : 'secondary'}
              onClick={() => setCutMode(!cutMode)}
              className={`flex items-center gap-1.5 !px-3 !py-1.5 text-xs ${
                cutMode ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : ''
              }`}
            >
              <Scissors className="h-4 w-4" />
              <span>{cutMode ? 'Cliquez sur une barre' : t('cutBar')}</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setIsPlaying(false);
                setReplayIndex(Math.floor(candles.length * 0.4));
              }}
              className="!px-2 !py-1.5 text-xs text-gray-500"
              title={t('reset')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed Multiplier */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{t('speed')} :</span>
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`rounded px-1.5 py-0.5 font-bold ${
                    playbackSpeed === spd
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Position Simulation Buttons */}
            {!simulatedPosition ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openSimulatedTrade('BUY')}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 flex items-center gap-1"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> BUY
                </button>
                <button
                  onClick={() => openSimulatedTrade('SELL')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-red-500 flex items-center gap-1"
                >
                  <TrendingDown className="h-3.5 w-3.5" /> SELL
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold ${
                    simulatedPosition.currentPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {simulatedPosition.type} @ {formatPrice(simulatedPosition.entry)} (
                  {simulatedPosition.currentPnl >= 0 ? `+${formatPrice(simulatedPosition.currentPnl)}` : formatPrice(simulatedPosition.currentPnl)})
                </span>
                <button
                  onClick={closeSimulatedTrade}
                  className="rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white px-2.5 py-1 text-xs font-bold hover:opacity-90"
                >
                  {t('closePosition')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SVG Replay Candlestick Chart */}
        {loading ? (
          <Spinner label={t('loading')} />
        ) : !visibleCandles.length || !scale ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-gray-400">
            Aucune donnée de bougie disponible pour cette paire.
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto select-none">
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 1000 ${chartHeight}`}
              preserveAspectRatio="none"
              className={`block bg-gray-950 rounded-xl ${cutMode ? 'cursor-crosshair' : 'cursor-default'}`}
            >
              {/* Grid lines */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                const yPos = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
                return (
                  <line
                    key={ratio}
                    x1={padding.left}
                    y1={yPos}
                    x2={1000 - padding.right}
                    y2={yPos}
                    stroke="#1f2937"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Simulated Position Entry Line */}
              {simulatedPosition && (
                <g>
                  <line
                    x1={padding.left}
                    y1={scale.y(simulatedPosition.entry)}
                    x2={1000 - padding.right}
                    y2={scale.y(simulatedPosition.entry)}
                    stroke={simulatedPosition.type === 'BUY' ? '#10b981' : '#ef4444'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={1000 - padding.right + 4}
                    y={scale.y(simulatedPosition.entry) + 4}
                    fill={simulatedPosition.type === 'BUY' ? '#10b981' : '#ef4444'}
                    fontSize="10"
                    fontWeight="bold"
                  >
                    ENTRY {formatPrice(simulatedPosition.entry)}
                  </text>
                </g>
              )}

              {/* Candles */}
              {visibleCandles.map((c, i) => {
                const step = (1000 - padding.left - padding.right) / Math.max(1, visibleCandles.length);
                const cx = padding.left + i * step + step / 2;
                const cw = Math.max(2, Math.min(10, step * 0.7));

                const up = c.close >= c.open;
                const color = up ? '#10b981' : '#ef4444';
                const yHigh = scale.y(c.high);
                const yLow = scale.y(c.low);
                const yOpen = scale.y(c.open);
                const yClose = scale.y(c.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

                return (
                  <g key={i} onClick={() => handleCutClick(i)}>
                    {/* Wick */}
                    <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth="1.2" />
                    {/* Body */}
                    <rect x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} rx="1" />
                  </g>
                );
              })}

              {/* Current Price Label on Y Axis */}
              {visibleCandles.length > 0 && (
                <g>
                  <rect
                    x={1000 - padding.right + 2}
                    y={scale.y(visibleCandles[visibleCandles.length - 1].close) - 9}
                    width={padding.right - 4}
                    height={18}
                    fill="#3b82f6"
                    rx="3"
                  />
                  <text
                    x={1000 - padding.right + 5}
                    y={scale.y(visibleCandles[visibleCandles.length - 1].close) + 4}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {formatPrice(visibleCandles[visibleCandles.length - 1].close)}
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}

        {/* Footer info bar */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            Barres affichées : {visibleCandles.length} / {candles.length} (Replay actif)
          </span>
          <span className="font-mono text-emerald-500">
            ● Flux de marché 100% réel synchronisé
          </span>
        </div>
      </div>
    </div>
  );
}
