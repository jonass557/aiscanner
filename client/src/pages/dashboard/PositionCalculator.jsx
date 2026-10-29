import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calculator, AlertTriangle, CheckCircle, ShieldAlert, DollarSign,
  TrendingUp, TrendingDown, ArrowRightLeft, Layers, Percent,
  Sliders, Copy, RotateCcw, BookOpen, ExternalLink, Info, Check,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculatorApi } from '../../services/endpoints.js';
import toast from 'react-hot-toast';

const MARKET_TABS = [
  { id: 'all', labelFr: 'Tous les marchés', labelEn: 'All Markets' },
  { id: 'forex', labelFr: 'Forex', labelEn: 'Forex' },
  { id: 'commodities', labelFr: 'Métaux & Énergie', labelEn: 'Commodities' },
  { id: 'crypto', labelFr: 'Crypto', labelEn: 'Crypto' },
  { id: 'indices', labelFr: 'Indices Mondiaux', labelEn: 'World Indices' },
  { id: 'synthetic', labelFr: 'Deriv Synthétiques', labelEn: 'Deriv Synthetics' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD', 'ZAR'];

export default function PositionCalculator() {
  const { isEn } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Catalog specs from server
  const [catalogSpecs, setCatalogSpecs] = useState([]);
  const [selectedMarketTab, setSelectedMarketTab] = useState('all');
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form Inputs
  const [capital, setCapital] = useState(10000);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [symbol, setSymbol] = useState('EURUSD');
  const [direction, setDirection] = useState('BUY');
  const [entryPrice, setEntryPrice] = useState(1.0850);
  const [stopLossPrice, setStopLossPrice] = useState(1.0800);
  const [takeProfitPrice, setTakeProfitPrice] = useState(1.1000);
  const [riskMode, setRiskMode] = useState('percent'); // 'percent' | 'amount'
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [riskAmount, setRiskAmount] = useState(100);
  const [leverage, setLeverage] = useState(100);

  // Custom spec overrides
  const [contractSize, setContractSize] = useState(100000);
  const [pipSize, setPipSize] = useState(0.0001);
  const [lotStep, setLotStep] = useState(0.01);
  const [minLot, setMinLot] = useState(0.01);
  const [maxLot, setMaxLot] = useState(100.0);
  const [commissionPerLot, setCommissionPerLot] = useState(7.0);

  // Calculation Result state
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // 1. Fetch catalog specifications on mount
  useEffect(() => {
    calculatorApi
      .specs()
      .then(({ data }) => {
        if (data?.data?.specs) {
          setCatalogSpecs(data.data.specs);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Prefill from URL query params (if opened from Opportunities, Scanner, or TradeValidator)
  useEffect(() => {
    const qSymbol = searchParams.get('symbol');
    const qEntry = searchParams.get('entry');
    const qSL = searchParams.get('sl') || searchParams.get('stopLoss');
    const qTP = searchParams.get('tp') || searchParams.get('takeProfit');
    const qDir = searchParams.get('direction');
    const qCapital = searchParams.get('capital');
    const qRisk = searchParams.get('risk');

    if (qSymbol) setSymbol(qSymbol);
    if (qEntry && !isNaN(Number(qEntry))) setEntryPrice(Number(qEntry));
    if (qSL && !isNaN(Number(qSL))) setStopLossPrice(Number(qSL));
    if (qTP && !isNaN(Number(qTP))) setTakeProfitPrice(Number(qTP));
    if (qDir && (qDir.toUpperCase() === 'BUY' || qDir.toUpperCase() === 'SELL')) {
      setDirection(qDir.toUpperCase());
    }
    if (qCapital && !isNaN(Number(qCapital))) setCapital(Number(qCapital));
    if (qRisk && !isNaN(Number(qRisk))) {
      setRiskPercent(Number(qRisk));
      setRiskAmount((Number(qCapital || 10000) * Number(qRisk)) / 100);
    }
  }, [searchParams]);

  // Sync user preferred risk & currency if available
  useEffect(() => {
    if (user?.preferences?.riskPercent && !searchParams.get('risk')) {
      setRiskPercent(user.preferences.riskPercent);
      setRiskAmount((capital * user.preferences.riskPercent) / 100);
    }
    if (user?.preferences?.currency && !searchParams.get('currency')) {
      setAccountCurrency(user.preferences.currency);
    }
  }, [user]);

  // Update instrument spec fields when symbol changes
  useEffect(() => {
    const match = catalogSpecs.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase());
    if (match) {
      setContractSize(match.contractSize);
      setPipSize(match.pipSize);
      setLotStep(match.lotStep);
      setMinLot(match.minLot);
      setMaxLot(match.maxLot);
      setLeverage(match.defaultLeverage || 100);
      setCommissionPerLot(match.commissionPerLot || 0);
      if (!searchParams.get('entry') && match.base) {
        setEntryPrice(match.base);
        // sensible default SL based on direction
        const delta = match.base * 0.005;
        if (direction === 'BUY') {
          setStopLossPrice(Number((match.base - delta).toFixed(match.pricePrecision || 4)));
          setTakeProfitPrice(Number((match.base + delta * 2).toFixed(match.pricePrecision || 4)));
        } else {
          setStopLossPrice(Number((match.base + delta).toFixed(match.pricePrecision || 4)));
          setTakeProfitPrice(Number((match.base - delta * 2).toFixed(match.pricePrecision || 4)));
        }
      }
    }
  }, [symbol, catalogSpecs]);

  // Reciprocal calculation: Risk % <-> Risk $ Amount
  const handleRiskPercentChange = (val) => {
    const p = Math.max(0.01, Number(val) || 0);
    setRiskPercent(p);
    setRiskAmount(Number(((capital * p) / 100).toFixed(2)));
  };

  const handleRiskAmountChange = (val) => {
    const a = Math.max(0.01, Number(val) || 0);
    setRiskAmount(a);
    if (capital > 0) {
      setRiskPercent(Number(((a / capital) * 100).toFixed(2)));
    }
  };

  const handleCapitalChange = (val) => {
    const c = Math.max(0, Number(val) || 0);
    setCapital(c);
    if (riskMode === 'percent') {
      setRiskAmount(Number(((c * riskPercent) / 100).toFixed(2)));
    } else if (c > 0) {
      setRiskPercent(Number(((riskAmount / c) * 100).toFixed(2)));
    }
  };

  // Perform position calculation (via backend engine for 100% precision)
  const calculate = useCallback(async () => {
    if (!capital || !entryPrice || !stopLossPrice) return;
    setCalculating(true);
    try {
      const payload = {
        capital: Number(capital),
        accountCurrency,
        symbol,
        direction,
        entryPrice: Number(entryPrice),
        stopLossPrice: Number(stopLossPrice),
        takeProfitPrice: takeProfitPrice ? Number(takeProfitPrice) : null,
        riskType: riskMode,
        riskValue: riskMode === 'percent' ? Number(riskPercent) : Number(riskAmount),
        leverage: Number(leverage),
        customSpecs: {
          contractSize: Number(contractSize),
          pipSize: Number(pipSize),
          lotStep: Number(lotStep),
          minLot: Number(minLot),
          maxLot: Number(maxLot),
          commissionPerLot: Number(commissionPerLot),
        },
      };

      const { data } = await calculatorApi.calculate(payload);
      if (data?.data) {
        setResult(data.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Erreur de calcul');
    } finally {
      setCalculating(false);
    }
  }, [
    capital,
    accountCurrency,
    symbol,
    direction,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    riskMode,
    riskPercent,
    riskAmount,
    leverage,
    contractSize,
    pipSize,
    lotStep,
    minLot,
    maxLot,
    commissionPerLot,
  ]);

  // Recalculate whenever core inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      calculate();
    }, 200);
    return () => clearTimeout(timer);
  }, [calculate]);

  // Copy trade plan summary to clipboard
  const handleCopySummary = () => {
    if (!result) return;
    const summary = [
      `🎯 AI SCANNER — TRADE PLAN & POSITION SIZING`,
      `Actif: ${result.symbol} (${result.market?.toUpperCase()})`,
      `Direction: ${result.direction}`,
      `Entrée: ${result.entryPrice}`,
      `Stop-Loss: ${result.stopLossPrice} (${result.slPips} pips / points)`,
      result.takeProfitPrice ? `Take-Profit: ${result.takeProfitPrice} (R:R 1:${result.riskRewardRatio || 'N/A'})` : null,
      `--- GESTION DU RISQUE ---`,
      `Taille de Position: ${result.executableVolume} Lots / Unités`,
      `Risque Monétaire: ${result.actualLossAtSL} ${result.accountCurrency} (${result.actualRiskPercent}%)`,
      result.actualGainAtTP != null ? `Gain Potentiel: ${result.actualGainAtTP} ${result.accountCurrency} (${result.actualGainPercent}%)` : null,
      `Marge Requise: ${result.marginRequired} ${result.accountCurrency} (Levier 1:${result.leverage})`,
      `Statut: ${result.complianceMessage}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success(isEn ? 'Trade plan copied to clipboard!' : 'Plan de position copié dans le presse-papier !');
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered symbols by market tab
  const filteredCatalog = useMemo(() => {
    if (selectedMarketTab === 'all') return catalogSpecs;
    return catalogSpecs.filter((s) => s.market === selectedMarketTab);
  }, [catalogSpecs, selectedMarketTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-md">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {isEn ? 'AI Position Size Calculator' : 'Calculateur de Taille de Position'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {isEn
                  ? 'Institutional risk & contract specification engine (Forex, Commodities, Crypto, Indices, Deriv Synthetics).'
                  : 'Moteur institutionnel de calcul de volume & gestion du risque (Forex, Métaux, Crypto, Indices, Synthétiques Deriv).'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result?.success && (
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 transition"
              title={isEn ? 'Copy Trade Plan' : 'Copier le plan'}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? (isEn ? 'Copied' : 'Copié !') : isEn ? 'Copy Plan' : 'Copier Plan'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setCapital(10000);
              setRiskPercent(1.0);
              setRiskAmount(100);
              setSymbol('EURUSD');
              setDirection('BUY');
              setEntryPrice(1.085);
              setStopLossPrice(1.08);
              setTakeProfitPrice(1.1);
              setSearchParams({});
              toast.success(isEn ? 'Reset to defaults' : 'Réinitialisé aux valeurs par défaut');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isEn ? 'Reset' : 'Réinitialiser'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PARAMETERS (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Market & Symbol Selection */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              {isEn ? '1. Market & Instrument' : '1. Marché & Instrument'}
            </h2>

            {/* Market Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {MARKET_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMarketTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedMarketTab === tab.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
                  }`}
                >
                  {isEn ? tab.labelEn : tab.labelFr}
                </button>
              ))}
            </div>

            {/* Instrument selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? 'Select Instrument' : 'Sélectionner un instrument'}
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {filteredCatalog.length > 0 ? (
                    filteredCatalog.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.label || s.symbol} ({s.market?.toUpperCase()})
                      </option>
                    ))
                  ) : (
                    <option value={symbol}>{symbol}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? 'Or Custom Symbol' : 'Ou Symbole personnalisé'}
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ex: EURUSD, XAUUSD, Boom 1000..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Capital & Account Currency */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {isEn ? '2. Account Capital & Currency' : '2. Capital & Devise du Compte'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? 'Capital / Account Balance' : 'Capital / Solde de référence'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={capital}
                    onChange={(e) => handleCapitalChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-bold text-gray-400">
                    {accountCurrency}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? 'Currency' : 'Devise'}
                </label>
                <select
                  value={accountCurrency}
                  onChange={(e) => setAccountCurrency(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Trade Direction & Price Levels */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {isEn ? '3. Trade Direction & Levels' : '3. Sens & Niveaux de Prix'}
              </h2>

              {/* BUY / SELL Switch */}
              <div className="flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setDirection('BUY')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    direction === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-emerald-500'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SELL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    direction === 'SELL'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-rose-500'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  SELL
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isEn ? 'Entry Price' : "Prix d'Entrée"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                  <span>{isEn ? 'Stop Loss' : 'Stop Loss'}</span>
                  <span className="text-[10px] font-normal text-gray-400">
                    ({direction === 'BUY' ? '< Entrée' : '> Entrée'})
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  className="w-full rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 px-3 py-2 text-sm font-mono font-bold text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                  <span>{isEn ? 'Take Profit (Optional)' : 'Take Profit (Optionnel)'}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={takeProfitPrice}
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 px-3 py-2 text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Risk Management Setting (% or $) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                {isEn ? '4. Risk Management' : '4. Tolérance au Risque'}
              </h2>

              {/* Mode switch */}
              <div className="flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setRiskMode('percent')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    riskMode === 'percent'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  % Capital
                </button>
                <button
                  type="button"
                  onClick={() => setRiskMode('amount')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    riskMode === 'amount'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {accountCurrency} Fixe
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? 'Risk Percentage (%)' : 'Pourcentage de Risque (%)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    value={riskPercent}
                    onChange={(e) => handleRiskPercentChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-gray-400">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {isEn ? `Max Loss Amount (${accountCurrency})` : `Montant Perte Max (${accountCurrency})`}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={riskAmount}
                    onChange={(e) => handleRiskAmountChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-gray-400">
                    {accountCurrency}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 mr-1">{isEn ? 'Quick presets:' : 'Préréglages :'}</span>
              {[0.5, 1.0, 1.5, 2.0, 3.0].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleRiskPercentChange(p)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                    riskPercent === p
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 ring-1 ring-purple-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Contract & Broker Specs Accordion */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-700 dark:text-gray-300"
            >
              <span className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-brand-500" />
                {isEn ? 'Contract & Broker Specifications' : 'Spécifications du Contrat & Broker'}
              </span>
              <span className="text-brand-600 dark:text-brand-400 text-xs">
                {showAdvancedSpecs ? (isEn ? 'Hide' : 'Masquer') : (isEn ? 'Customize' : 'Personnaliser')}
              </span>
            </button>

            {showAdvancedSpecs && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? 'Contract Size' : 'Taille du Contrat'}
                  </label>
                  <input
                    type="number"
                    value={contractSize}
                    onChange={(e) => setContractSize(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? 'Pip / Point Size' : 'Taille Pip / Point'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={pipSize}
                    onChange={(e) => setPipSize(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? 'Lot Step' : "Pas d'incrément (Step)"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lotStep}
                    onChange={(e) => setLotStep(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? 'Min Lot' : 'Lot Minimum'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minLot}
                    onChange={(e) => setMinLot(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? 'Leverage (1:X)' : 'Levier (1:X)'}
                  </label>
                  <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {isEn ? `Commission / Lot (${accountCurrency})` : `Commission / Lot (${accountCurrency})`}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={commissionPerLot}
                    onChange={(e) => setCommissionPerLot(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-mono dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INSTITUTIONAL SIZING & RISK RESULTS (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Hero Result Card */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/70 p-5 shadow-lg dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {isEn ? 'Recommended Position Size' : 'Taille de Position Conseillée'}
                </span>
                <p className="font-mono text-xs text-brand-600 dark:text-brand-400 font-semibold">
                  {symbol} • {direction}
                </p>
              </div>

              {/* Status Badge */}
              {result && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                    result.complianceTone === 'success'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : result.complianceTone === 'warning'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {result.complianceTone === 'success' ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : result.complianceTone === 'warning' ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  {result.complianceTone === 'success'
                    ? isEn
                      ? 'Compliant'
                      : 'Conforme'
                    : result.complianceTone === 'warning'
                    ? isEn
                      ? 'Warning'
                      : 'Attention'
                    : isEn
                    ? 'Non-Compliant'
                    : 'Non Conforme'}
                </span>
              )}
            </div>

            {/* Big Volume Display */}
            <div className="py-4 text-center">
              <div className="inline-flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-gray-900 dark:text-white">
                  {result?.executableVolume != null ? result.executableVolume : '—'}
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400">
                  {isEn ? 'Lots / Units' : 'Lots / Contrats'}
                </span>
              </div>

              {result?.rawVolume != null && result.rawVolume !== result.executableVolume && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {isEn
                    ? `(Raw unfloored: ${result.rawVolume} • Step: ${result.lotStep})`
                    : `(Volume brut non arrondi: ${result.rawVolume} • Pas broker: ${result.lotStep})`}
                </p>
              )}
            </div>

            {/* CRITICAL WARNING BANNER IF MIN LOT RISK EXCEEDED */}
            {result?.isRiskTooHighForMinLot && (
              <div className="mt-2 rounded-xl border border-rose-300 bg-rose-50/90 p-4 dark:border-rose-900 dark:bg-rose-950/40">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                      {isEn ? 'RISK TOO HIGH FOR MINIMUM VOLUME' : 'RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL'}
                    </h3>
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      {isEn
                        ? `The required volume (${result.rawVolume}) is below the broker minimum lot (${result.minLot}). At ${result.minLot} lot(s), loss at Stop Loss would reach ${result.lossAtMinLot} ${result.accountCurrency} (${result.riskPercentAtMinLot}%), exceeding your target risk of ${result.targetRiskAmount} ${result.accountCurrency} (${result.targetRiskPercent}%).`
                        : `Le volume requis (${result.rawVolume}) est inférieur au lot minimal obligatoire imposé par le broker (${result.minLot}). Avec ${result.minLot} lot(s), la perte au Stop Loss s'élèverait à ${result.lossAtMinLot} ${result.accountCurrency} (${result.riskPercentAtMinLot}%), ce qui dépasse votre risque toléré de ${result.targetRiskAmount} ${result.accountCurrency} (${result.targetRiskPercent}%).`}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                      💡 {isEn
                        ? 'Recommendation: Increase capital, reduce Stop Loss distance, or choose an instrument with a lower minimum contract size.'
                        : 'Recommandation : Augmentez votre capital, réduisez la distance du Stop Loss, ou privilégiez un instrument avec un lot minimum inférieur.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* INSUFFICIENT MARGIN BANNER */}
            {result?.insufficientMargin && (
              <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      {isEn ? 'INSUFFICIENT MARGIN' : 'MARGE INSUFFISANTE'}
                    </h3>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      {isEn
                        ? `Required margin (${result.marginRequired} ${result.accountCurrency}) exceeds available capital (${result.capital} ${result.accountCurrency}) at leverage 1:${result.leverage}.`
                        : `La marge requise (${result.marginRequired} ${result.accountCurrency}) dépasse votre capital disponible (${result.capital} ${result.accountCurrency}) au levier 1:${result.leverage}.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Errors display if any input is invalid */}
            {result?.errors?.length > 0 && (
              <div className="mt-2 rounded-xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    • {err}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Financial Breakdown Grid */}
          {result?.success && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {isEn ? 'Financial Metrics & Risk Breakdown' : 'Indicateurs Financiers & Risque'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Real Loss at SL */}
                <div className="rounded-xl bg-rose-50/60 dark:bg-rose-950/20 p-3 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block">
                    {isEn ? 'Actual Loss at SL' : 'Perte Réelle au SL'}
                  </span>
                  <span className="text-lg font-black font-mono text-rose-700 dark:text-rose-300 block mt-0.5">
                    -{result.actualLossAtSL} {result.accountCurrency}
                  </span>
                  <span className="text-[10px] text-rose-500 block">
                    {result.actualRiskPercent}% {isEn ? 'of capital' : 'du capital'}
                  </span>
                </div>

                {/* Gain at TP */}
                <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 p-3 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">
                    {isEn ? 'Actual Gain at TP' : 'Gain Réel au TP'}
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-300 block mt-0.5">
                    {result.actualGainAtTP != null ? `+${result.actualGainAtTP} ${result.accountCurrency}` : '—'}
                  </span>
                  <span className="text-[10px] text-emerald-500 block">
                    {result.actualGainPercent != null ? `+${result.actualGainPercent}%` : 'N/A'}
                  </span>
                </div>

                {/* Risk / Reward */}
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700/60">
                  <span className="text-[11px] font-medium text-gray-500 block">
                    {isEn ? 'Risk / Reward Ratio' : 'Ratio Risque / Rendement'}
                  </span>
                  <span className="text-base font-bold font-mono text-gray-900 dark:text-white block mt-0.5">
                    {result.riskRewardRatio != null ? `1 : ${result.riskRewardRatio}` : '—'}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {result.riskRewardRatio >= 2
                      ? 'Excellent (≥ 1:2)'
                      : result.riskRewardRatio >= 1.5
                      ? 'Acceptable (≥ 1:1.5)'
                      : 'Inférieur à 1:1.5'}
                  </span>
                </div>

                {/* Pip / Point Value */}
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700/60">
                  <span className="text-[11px] font-medium text-gray-500 block">
                    {isEn ? 'Pip / Point Value' : "Valeur d'1 Pip / Point"}
                  </span>
                  <span className="text-base font-bold font-mono text-gray-900 dark:text-white block mt-0.5">
                    {result.pipValueAtVolume} {result.accountCurrency}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {result.accountPipValuePerLot} {result.accountCurrency} / 1.0 lot
                  </span>
                </div>

                {/* Distance to SL */}
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700/60">
                  <span className="text-[11px] font-medium text-gray-500 block">
                    {isEn ? 'Stop Loss Distance' : 'Distance Stop Loss'}
                  </span>
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-white block mt-0.5">
                    {result.slPips} {isEn ? 'pips / pts' : 'pips / points'}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {result.priceDistance} ({result.distancePercent}%)
                  </span>
                </div>

                {/* Margin Required */}
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700/60">
                  <span className="text-[11px] font-medium text-gray-500 block">
                    {isEn ? 'Required Margin' : 'Marge Requise'}
                  </span>
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-white block mt-0.5">
                    {result.marginRequired} {result.accountCurrency}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {result.marginPercentOfCapital}% {isEn ? 'of balance' : 'du capital'} (1:{result.leverage})
                  </span>
                </div>
              </div>

              {/* Free Margin remaining */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-500 dark:text-gray-400">{isEn ? 'Free Margin After Trade:' : 'Marge Libre Restante :'}</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {result.freeMarginAfterTrade} {result.accountCurrency}
                </span>
              </div>

              {/* Commission */}
              {result.totalCommission > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{isEn ? 'Estimated Commissions:' : 'Commissions Estimées :'}</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {result.totalCommission} {result.accountCurrency}
                  </span>
                </div>
              )}

              {/* Quick Link to Trading Journal */}
              <div className="pt-2">
                <Link
                  to={`/dashboard/journal?symbol=${encodeURIComponent(result.symbol)}&direction=${result.direction}&entryPrice=${result.entryPrice}&stopLoss=${result.stopLossPrice}&takeProfit=${result.takeProfitPrice || ''}&lotSize=${result.executableVolume}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:hover:bg-brand-950/70 dark:text-brand-300 text-xs font-bold transition"
                >
                  <BookOpen className="h-4 w-4" />
                  {isEn ? 'Log Trade in Trading Journal' : 'Consigner dans le Journal de Trading'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
