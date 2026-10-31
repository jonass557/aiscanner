import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Radar,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  BookMarked,
  Mail,
  CheckCircle,
  CheckCircle2,
  FileText,
  Sliders,
  Bell,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  Layers,
  Crosshair,
  Calculator,
  Calendar,
  Bot,
  Target,
  Edit3,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import OpportunityCard from '../../components/analysis/OpportunityCard.jsx';
import LiveChart from '../../components/analysis/LiveChart.jsx';
import { opportunityApi, userApi, strategyApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatPrice, marketLabel } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const REFRESH_MS = 60 * 1000; // poll every minute for fresh opportunities

const emptyFilters = {
  market: '',
  timeframe: '',
  direction: '',
  setupType: '',
  riskLevel: '',
  minConfidence: '',
};

/**
 * AI Opportunity Scanner:
 * - Tab 1: Live Active Signals with real-time chart, SL, TP, and strategy confluences
 * - Tab 2: Performance Report for closed signals (Winrate %, TP1/TP2 hits, SL hits, Total Pips)
 * - Custom Trading Strategy and Trading Plan configuration
 * - Automatic Email alerts when subscribed
 */
export default function Opportunities() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';

  // Tabs: 'active' | 'closed'
  const [activeTab, setActiveTab] = useState('active');

  const [meta, setMeta] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);

  // Strategy & Trading Plan modal / state
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [adminStrategies, setAdminStrategies] = useState([]);
  const [strategyType, setStrategyType] = useState('smc');
  const [customStrategyName, setCustomStrategyName] = useState('');
  const [strategyMarket, setStrategyMarket] = useState('');
  const [strategyTimeframe, setStrategyTimeframe] = useState('H1');
  const [strategySession, setStrategySession] = useState('Toutes');
  const [minRiskReward, setMinRiskReward] = useState('1:2.5');
  const [customStrategyText, setCustomStrategyText] = useState('');
  const [customTradingPlanText, setCustomTradingPlanText] = useState('');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [minEmailConfidence, setMinEmailConfidence] = useState(80);
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setRefreshing(true);
      try {
        const params = {
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
          tab: activeTab,
        };
        const { data } = await opportunityApi.list(params);
        setOpportunities(data.data.opportunities || []);
        if (data.data.report) {
          setReport(data.data.report);
        }
      } catch (err) {
        if (!isBackground) toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, activeTab]
  );

  // Load preferences, meta, & admin strategies
  useEffect(() => {
    opportunityApi
      .meta()
      .then(({ data }) => setMeta(data.data))
      .catch(() => {});

    strategyApi
      .list()
      .then(({ data }) => setAdminStrategies(data.data.strategies || []))
      .catch(() => {});

    userApi
      .getPreferences()
      .then(({ data }) => {
        const p = data.data.preferences || {};
        setStrategyType(p.favoriteStrategy || 'smc');
        setCustomStrategyName(p.customStrategyName || '');
        setCustomStrategyText(p.customStrategy || '');
        setCustomTradingPlanText(p.customTradingPlan || '');
        setStrategyMarket(p.favoriteMarkets?.[0] || '');
        setStrategyTimeframe(p.favoriteTimeframes?.[0] || 'H1');
        setStrategySession(p.favoriteSession || 'Toutes');
        setMinRiskReward(p.minRiskReward || '1:2.5');
        setEmailAlertsEnabled(p.opportunityEmailAlerts !== false);
        setMinEmailConfidence(p.minOpportunityConfidence || 80);
      })
      .catch(() => {});
  }, []);

  // Reload when filters or tab change & auto-poll
  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const runScan = async (overrideParams = null) => {
    setScanning(true);
    try {
      const scanPayload = {
        market: overrideParams?.market || strategyMarket || filters.market || undefined,
        customParams: {
          strategyName: overrideParams?.strategyName || customStrategyName || strategyType,
          strategyRules: overrideParams?.strategyRules !== undefined ? overrideParams.strategyRules : customStrategyText,
          customTradingPlan: overrideParams?.customTradingPlan !== undefined ? overrideParams.customTradingPlan : customTradingPlanText,
          market: overrideParams?.market || strategyMarket || filters.market || undefined,
          timeframe: overrideParams?.timeframe || strategyTimeframe || filters.timeframe || undefined,
          session: overrideParams?.session || strategySession || undefined,
          minRiskReward: overrideParams?.minRiskReward || minRiskReward || undefined,
        },
      };
      const { data } = await opportunityApi.scan(scanPayload);
      toast.success(
        data.message || (isEn ? 'Real-time scan completed!' : 'Scan en temps réel terminé !')
      );
      await load(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const handleSelectStrategyOption = (val) => {
    setStrategyType(val);
    const foundAdmin = adminStrategies.find((s) => s._id === val || s.key === val);
    if (foundAdmin) {
      setCustomStrategyName(foundAdmin.name);
      setCustomStrategyText((foundAdmin.rules || []).join('\n'));
      if (foundAdmin.targetRiskReward) {
        setMinRiskReward(`1:${foundAdmin.targetRiskReward}`);
      }
    } else if (val === 'smc') {
      setCustomStrategyName('Smart Money Concepts (SMC)');
      setCustomStrategyText('Validation de la tendance institutionnelle\nZone Order Block / FVG non mitigée\nBalayage de liquidité (Sweep) confirmé\nConfirmation bougie de rejet en session clé');
    } else if (val === 'ict') {
      setCustomStrategyName('Inner Circle Trader (ICT)');
      setCustomStrategyText('Prise de liquidité BSL/SSL en Killzone\nChangement de structure de marché (MSS/CHoCH)\nCréation d\'un Fair Value Gap (FVG) évident\nEntrée OTE (Optimal Trade Entry 62%-79%)');
    } else if (val === 'price-action') {
      setCustomStrategyName('Price Action Institutionnel');
      setCustomStrategyText('Rejet net sur niveau Support/Résistance majeur\nBougie de signal (Pinbar ou Engulfing)\nRatio Risque/Rendement minimum 1:2.5');
    } else if (val === 'custom') {
      if (!customStrategyName) setCustomStrategyName('Ma Stratégie Personnalisée');
    }
  };

  const handleSaveStrategyPlan = async () => {
    setSavingPlan(true);
    try {
      await userApi.updatePreferences({
        favoriteStrategy: strategyType,
        customStrategyName,
        customStrategy: customStrategyText,
        customTradingPlan: customTradingPlanText,
        favoriteMarkets: strategyMarket ? [strategyMarket] : undefined,
        favoriteTimeframes: strategyTimeframe ? [strategyTimeframe] : undefined,
        favoriteSession: strategySession,
        minRiskReward,
        opportunityEmailAlerts: emailAlertsEnabled,
        minOpportunityConfidence: Number(minEmailConfidence),
      });
      toast.success(
        isEn
          ? 'Trading Strategy and Plan saved successfully!'
          : 'Stratégie et Plan de Trading enregistrés avec succès !'
      );
      setStrategyModalOpen(false);
      await runScan({
        strategyName: customStrategyName || strategyType,
        strategyRules: customStrategyText,
        customTradingPlan: customTradingPlanText,
        market: strategyMarket,
        timeframe: strategyTimeframe,
        session: strategySession,
        minRiskReward,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters(emptyFilters);

  const Select = ({ label, value, onChange, options, formatOption }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <option value="">{t('all')}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {formatOption ? formatOption(opt) : opt}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md">
              <Radar className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('oppTitle')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('oppSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Strategy & Plan button */}
          <Button
            variant="secondary"
            onClick={() => setStrategyModalOpen(true)}
            className="flex items-center gap-1.5 text-xs border-brand-500/40 text-brand-600 dark:text-brand-400"
          >
            <BookMarked className="h-4 w-4" />
            {isEn ? 'My Strategy & Plan' : 'Ma Stratégie & Mon Plan'}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            onClick={() => load(false)}
            loading={refreshing}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>

          {/* Scan Now */}
          <Button
            variant="primary"
            onClick={() => runScan()}
            loading={scanning}
            className="flex items-center gap-1.5 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            {t('scanNow')}
          </Button>
        </div>
      </div>

      {/* Active Robot Strategy Banner */}
      <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-gray-900 to-accent-950/30 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                  {isEn ? 'Robot Active Strategy' : 'Stratégie Active du Robot'} :
                </span>
                <span className="rounded-md bg-brand-500/20 px-2 py-0.5 text-xs font-bold text-brand-300 border border-brand-500/30">
                  {customStrategyName ||
                    adminStrategies.find((s) => s._id === strategyType || s.key === strategyType)?.name ||
                    strategyType.toUpperCase()}
                </span>
                {strategyMarket && (
                  <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[11px] font-bold text-purple-300 border border-purple-500/30">
                    {marketLabel(strategyMarket)}
                  </span>
                )}
                <span className="rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-bold text-gray-300 border border-gray-700">
                  TF: {strategyTimeframe}
                </span>
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30">
                  Session: {strategySession}
                </span>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                  R:R ≥ {minRiskReward}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-300 line-clamp-1 max-w-3xl">
                {customStrategyText ||
                  customTradingPlanText ||
                  (isEn
                    ? 'Institutional Smart Money setups strictly applied to the letter according to your rules.'
                    : 'Setups institutionnels appliqués à la lettre selon vos règles et confluences.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={() => setStrategyModalOpen(true)}
              className="text-xs border-brand-500/40 text-brand-400 hover:bg-brand-500/10"
            >
              <Sliders className="h-3.5 w-3.5 mr-1" />
              {isEn ? 'Configure Strategy' : 'Modifier ma Stratégie'}
            </Button>
            <Button
              variant="primary"
              onClick={() => runScan()}
              loading={scanning}
              className="text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {isEn ? 'Run Robot Scan' : 'Lancer le Robot'}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs: Live Active Signals vs Closed Performance Report */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'active'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {t('activeSignalsTab')}
        </button>

        <button
          onClick={() => setActiveTab('closed')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'closed'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Award className="h-4 w-4" />
          {t('closedSignalsTab')}
        </button>
      </div>

      {/* Closed Tab: Performance KPI Report */}
      {activeTab === 'closed' && report && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  {t('reportTitle')}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {isEn
                    ? 'Verifiable statistical tracking of past signals, Stop Losses and Take Profits hit.'
                    : 'Suivi statistique vérifiable des signaux passés, des Stop Loss et des Take Profits atteints.'}
                </p>
              </div>
              <span className="rounded-xl bg-brand-500/10 px-3 py-1 font-mono text-xs font-bold text-brand-600 dark:text-brand-300">
                {report.totalClosed} {isEn ? 'Signals Evaluated' : 'Signaux Évalués'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {/* Winrate */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
                <span className="text-[10px] font-bold uppercase text-gray-400">{t('winrate')}</span>
                <p className="mt-1 font-mono text-2xl font-black text-brand-600 dark:text-brand-400">
                  {report.winRate}%
                </p>
              </div>

              {/* Total Pips */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
                <span className="text-[10px] font-bold uppercase text-gray-400">{t('pipsWon')}</span>
                <p
                  className={`mt-1 font-mono text-2xl font-black ${
                    report.totalPips >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {report.totalPips >= 0 ? `+${report.totalPips}` : report.totalPips} pips
                </p>
              </div>

              {/* TP1 Count */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  {t('tp1Hit')}
                </span>
                <p className="mt-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {report.tp1Count}
                </p>
              </div>

              {/* TP2 Count */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-500">
                  {t('tp2Hit')}
                </span>
                <p className="mt-1 font-mono text-2xl font-black text-emerald-500">
                  {report.tp2Count}
                </p>
              </div>

              {/* SL Count */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
                <span className="text-[10px] font-bold uppercase text-rose-500">
                  {t('slHit')}
                </span>
                <p className="mt-1 font-mono text-2xl font-black text-rose-500">
                  {report.slCount}
                </p>
              </div>

              {/* Profit Factor */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
                <span className="text-[10px] font-bold uppercase text-gray-400">Profit Factor</span>
                <p className="mt-1 font-mono text-2xl font-black text-cyan-500">
                  {report.profitFactor}
                </p>
              </div>
            </div>

            {/* Zero State Onboarding Notice for New Users */}
            {report.totalClosed === 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-6 text-center bg-gray-50/50 dark:bg-gray-900/40">
                <Sparkles className="mx-auto h-8 w-8 text-brand-500 mb-2" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {isEn ? 'Your Performance Results Start at 0' : 'Vos Résultats & Rapports Débutent à 0'}
                </h4>
                <p className="mx-auto mt-1 max-w-lg text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {isEn
                    ? 'Configure your strategy preferences or enter your exact rules above, then run the Robot scan. Your personal stats and daily performance tracking will begin counting as trades execute.'
                    : 'Configurez vos préférences ou saisissez vos règles ci-dessus, puis lancez le Robot de Trading. Vos statistiques personnelles et vos rapports de performance quotidiens commenceront à se comptabiliser chaque jour.'}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setStrategyModalOpen(true)}
                  className="mt-3 text-xs"
                >
                  <BookMarked className="h-3.5 w-3.5 mr-1.5" />
                  {isEn ? 'Set My Strategy & Run Scan' : 'Configurer ma Stratégie & Lancer le Robot'}
                </Button>
              </div>
            )}

            {/* Daily Performance Breakdown Table */}
            {report.totalClosed > 0 && report.dailyBreakdown?.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-gray-50/80 dark:bg-gray-800/50 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-500" />
                    {isEn ? 'Daily Performance Breakdown' : 'Rapport Quotidien des Performances (Jour par Jour)'}
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    {report.dailyBreakdown.length} {isEn ? 'Days Tracked' : 'Jours Enregistrés'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100/70 dark:bg-gray-800/40 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-center">{isEn ? 'Closed Trades' : 'Trades Clôturés'}</th>
                        <th className="px-4 py-2.5 text-center">Winrate</th>
                        <th className="px-4 py-2.5 text-center">Pips</th>
                        <th className="px-4 py-2.5 text-center">TP1 / TP2</th>
                        <th className="px-4 py-2.5 text-center">Stop Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                      {report.dailyBreakdown.map((row) => (
                        <tr key={row.date} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{row.date}</td>
                          <td className="px-4 py-3 text-center">{row.closed}</td>
                          <td className="px-4 py-3 text-center font-bold text-brand-600 dark:text-brand-400">{row.winRate}%</td>
                          <td className={`px-4 py-3 text-center font-bold ${row.pips >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {row.pips >= 0 ? `+${row.pips}` : row.pips}
                          </td>
                          <td className="px-4 py-3 text-center text-emerald-500">{row.tp1} / {row.tp2}</td>
                          <td className="px-4 py-3 text-center text-rose-500">{row.sl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold">{t('filter')}</span>
          </div>
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 transition hover:text-brand-600 dark:hover:text-brand-400"
          >
            {isEn ? 'Reset Filters' : 'Réinitialiser filtres'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select
            label="Marché"
            value={filters.market}
            onChange={(v) => setFilter('market', v)}
            options={meta?.markets || []}
            formatOption={marketLabel}
          />
          <Select
            label="Timeframe"
            value={filters.timeframe}
            onChange={(v) => setFilter('timeframe', v)}
            options={meta?.timeframes || []}
          />
          <Select
            label="Direction"
            value={filters.direction}
            onChange={(v) => setFilter('direction', v)}
            options={['BUY', 'SELL']}
          />
          <Select
            label="Type de Setup"
            value={filters.setupType}
            onChange={(v) => setFilter('setupType', v)}
            options={meta?.setupTypes || []}
          />
          <Select
            label="Risque"
            value={filters.riskLevel}
            onChange={(v) => setFilter('riskLevel', v)}
            options={meta?.riskLevels || []}
          />
          <Select
            label="Probabilité Min."
            value={filters.minConfidence}
            onChange={(v) => setFilter('minConfidence', v)}
            options={['70', '80', '85', '90']}
            formatOption={(v) => `≥ ${v}%`}
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <Spinner label={t('loading')} />
      ) : opportunities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-800">
          <Radar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-base font-semibold">
            {isEn ? 'No signals matching criteria' : 'Aucun signal correspondant aux critères'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isEn
              ? 'Try widening your filters or click Scan Now to launch a real-time sweep.'
              : 'Essayez d\'élargir vos filtres ou cliquez sur Scanner Maintenant.'}
          </p>
          <Button variant="secondary" onClick={clearFilters} className="mt-4">
            {isEn ? 'Reset Filters' : 'Réinitialiser les filtres'}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp._id}
              opportunity={opp}
              onClick={() => setSelected(opp)}
            />
          ))}
        </div>
      )}

      {/* Custom Strategy & Trading Plan Modal */}
      {strategyModalOpen && (
        <Modal
          open={strategyModalOpen}
          onClose={() => setStrategyModalOpen(false)}
          size="lg"
          title={isEn ? 'Configure Robot Strategy & Trading Plan' : 'Configurer la Stratégie & le Plan de Trading du Robot'}
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {isEn
                ? 'Input all details of your strategy. The high-probability trading robot will apply your rules strictly to the letter to generate compliant market setups.'
                : 'Saisissez tous les détails de votre stratégie. Le robot de trading haute probabilité appliquera vos règles à la lettre pour ne détecter que les signaux strictement conformes.'}
            </p>

            {/* Strategy Model / Paradigm Selector */}
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{isEn ? 'Strategy Model / Paradigm' : 'Modèle ou Paradigme de Stratégie'}</span>
                <span className="text-[11px] font-normal text-brand-600 dark:text-brand-400">
                  {adminStrategies.length} {isEn ? 'admin strategies available' : 'stratégies administrées disponibles'}
                </span>
              </label>
              <select
                value={strategyType}
                onChange={(e) => handleSelectStrategyOption(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
              >
                <optgroup label={isEn ? 'Standard Paradigms' : 'Paradigmes Standards'}>
                  <option value="smc">Smart Money Concepts (SMC - Par Défaut)</option>
                  <option value="ict">Inner Circle Trader (ICT Precision)</option>
                  <option value="price-action">Price Action Institutionnel & S/R</option>
                </optgroup>

                {adminStrategies.length > 0 && (
                  <optgroup label={isEn ? 'Admin & Platform Strategies' : 'Stratégies Enregistrées Plateforme & Admin'}>
                    {adminStrategies.map((strat) => (
                      <option key={strat._id || strat.key} value={strat._id || strat.key}>
                        {strat.name} ({strat.category?.toUpperCase() || 'SMC'} · Winrate ~{strat.winRateEstimate || 85}%)
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label={isEn ? 'Custom' : 'Sur Mesure'}>
                  <option value="custom">✍️ {isEn ? 'My Custom Strategy' : 'Ma Stratégie 100% Personnalisée'}</option>
                </optgroup>
              </select>
            </div>

            {/* Strategy Name & Category Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {isEn ? 'Strategy Name' : 'Nom de votre Stratégie'}
                </label>
                <input
                  type="text"
                  value={customStrategyName}
                  onChange={(e) => setCustomStrategyName(e.target.value)}
                  placeholder="ex: Scalping London Killzone SMC"
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {isEn ? 'Target Asset Class' : 'Catégorie de Marché Ciblée'}
                </label>
                <select
                  value={strategyMarket}
                  onChange={(e) => setStrategyMarket(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="">{isEn ? 'All Markets (Multi-Asset)' : 'Tous les Marchés (Multi-Actifs)'}</option>
                  <option value="forex">Forex (Majeures & Mineures)</option>
                  <option value="crypto">Cryptomonnaies (BTC, ETH, Altcoins)</option>
                  <option value="indices">Indices Boursiers (NAS100, US30, GER40)</option>
                  <option value="commodities">Métaux & Matières Premières (XAU, XAG, USOIL)</option>
                  <option value="synthetic">Indices Synthétiques (Volatility, Boom, Crash)</option>
                </select>
              </div>
            </div>

            {/* Timeframe, Session, & Min R:R Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Timeframe
                </label>
                <select
                  value={strategyTimeframe}
                  onChange={(e) => setStrategyTimeframe(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="M5">M5 (Scalping Rapide)</option>
                  <option value="M15">M15 (Day Trading Court Terme)</option>
                  <option value="H1">H1 (Day Trading / Swing Standard)</option>
                  <option value="H4">H4 (Swing Institutionnel)</option>
                  <option value="D1">D1 (Position / Moyen Terme)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {isEn ? 'Trading Session' : 'Session de Trading'}
                </label>
                <select
                  value={strategySession}
                  onChange={(e) => setStrategySession(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="Toutes">{isEn ? 'All Sessions (24h/24)' : 'Toutes les Sessions'}</option>
                  <option value="Londres">Session Londres (08h00 - 16h00 UTC)</option>
                  <option value="New York">Session New York (13h00 - 21h00 UTC)</option>
                  <option value="Asie">Session Asiatique (00h00 - 08h00 UTC)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {isEn ? 'Min. Risk/Reward (R:R)' : 'R:R Minimum'}
                </label>
                <select
                  value={minRiskReward}
                  onChange={(e) => setMinRiskReward(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="1:2.0">1:2.0 (Standard)</option>
                  <option value="1:2.5">1:2.5 (Recommandé)</option>
                  <option value="1:3.0">1:3.0 (Haute Rentabilité)</option>
                  <option value="1:4.0">1:4.0 (Sniper Institutionnel)</option>
                  <option value="1:5.0">1:5.0 (Ultra High R:R)</option>
                </select>
              </div>
            </div>

            {/* Detailed Strategy Rules */}
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{isEn ? 'Detailed Strategy Rules & Confluences (Applied strictly by Robot)' : 'Règles Détaillées & Confluences de la Stratégie (Appliquées à la lettre)'}</span>
                <span className="text-[10px] text-gray-400">1 règle par ligne</span>
              </label>
              <textarea
                rows={4}
                value={customStrategyText}
                onChange={(e) => setCustomStrategyText(e.target.value)}
                placeholder={
                  isEn
                    ? 'Validation of higher-timeframe trend\nUnmitigated Order Block / FVG\nLiquidity sweep (BSL/SSL)\nCandlestick rejection confirmation\nEntry during active killzone'
                    : 'Validation de la tendance sur timeframe supérieur\nZone Order Block / Fair Value Gap non mitigée\nPrise de liquidité (Sweep) préalable\nBougie de confirmation de rejet\nExécution pendant la session active'
                }
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-xs leading-relaxed dark:border-gray-700 dark:bg-gray-800 font-mono"
              />
            </div>

            {/* Personal Trading Plan */}
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {isEn ? 'Personal Trading Plan (Money Management & Discipline)' : 'Plan de Trading Personnel (Gestion du Risque & Discipline)'}
              </label>
              <textarea
                rows={2}
                value={customTradingPlanText}
                onChange={(e) => setCustomTradingPlanText(e.target.value)}
                placeholder={
                  isEn
                    ? 'Maximum 1% risk per trade, Maximum 2 trades per day, Move stop loss to breakeven at TP1...'
                    : 'Risque max 1% par trade, Maximum 2 trades par jour, Déplacement du SL à Breakeven après atteinte de TP1...'
                }
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            {/* Email Notifications */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {isEn ? 'Automatic Email Alerts' : 'Alertes Automatiques par Email'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlertsEnabled}
                  onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {isEn
                  ? 'Receive detected opportunities straight into your inbox in real time.'
                  : 'Recevez directement les opportunités conformes à votre stratégie dans votre boîte mail.'}
              </p>

              {emailAlertsEnabled && (
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    {isEn ? 'Minimum Confidence Threshold:' : 'Seuil de Probabilité pour Email :'}
                  </span>
                  <select
                    value={minEmailConfidence}
                    onChange={(e) => setMinEmailConfidence(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                  >
                    <option value="75">75% {isEn ? 'and above' : 'et plus'}</option>
                    <option value="80">80% {isEn ? 'and above (Recommended)' : 'et plus (Recommandé)'}</option>
                    <option value="85">85% {isEn ? 'and above (High Selectivity)' : 'et plus (Très haute sélectivité)'}</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
              <Button variant="ghost" onClick={() => setStrategyModalOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSaveStrategyPlan}
                loading={savingPlan}
                className="bg-brand-600 hover:bg-brand-500 text-white"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {isEn ? 'Save Strategy & Scan Robot' : 'Enregistrer ma Stratégie & Lancer le Robot'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Opportunity Detail Modal with Live Candlestick Chart & Confluences */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="xl"
        title={selected ? `${selected.symbol} · ${selected.direction}` : ''}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{marketLabel(selected.market)}</Badge>
              <Badge tone="gray">{selected.timeframe}</Badge>
              <Badge tone={selected.confidenceScore >= 80 ? 'green' : 'blue'}>
                {selected.confidenceScore}% {isEn ? 'probability' : 'de probabilité'}
              </Badge>
              {selected.strategyMatched && (
                <Badge tone="blue">
                  {t('strategy')} : {selected.strategyMatched}
                </Badge>
              )}
              {selected.outcome && selected.outcome !== 'pending' && (
                <Badge tone={selected.outcome.includes('tp') ? 'green' : 'red'}>
                  {selected.outcome === 'hit_tp2'
                    ? '🎯 TP2 REACHED (+85 pips)'
                    : selected.outcome === 'hit_tp1'
                    ? '🎯 TP1 REACHED (+40 pips)'
                    : '🛑 STOP LOSS HIT'}
                </Badge>
              )}
            </div>

            {/* Real-time Candlestick Chart */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <LiveChart
                symbol={selected.symbol}
                timeframe={selected.timeframe}
                tradePlan={{
                  entry: selected.entry,
                  stopLoss: selected.stopLoss,
                  takeProfit1: selected.takeProfit1,
                  takeProfit2: selected.takeProfit2,
                }}
              />
            </div>

            {/* Levels Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t('entry'), selected.entry],
                [t('stopLoss'), selected.stopLoss],
                ['Take Profit 1', selected.takeProfit1],
                ['Take Profit 2', selected.takeProfit2],
              ].map(([lbl, val]) => (
                <div key={lbl} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500">{lbl}</p>
                  <p className="mt-1 font-mono text-sm font-bold">{formatPrice(val)}</p>
                </div>
              ))}
            </div>

            {/* Position Size Calculator CTA */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-brand-200 bg-brand-50/50 dark:border-brand-900/60 dark:bg-brand-950/20">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                  <Calculator className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {isEn ? 'Calculate Position Size' : 'Calculateur de Taille de Position'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isEn
                      ? 'Adjust lot size to your risk & account equity'
                      : 'Adaptez votre volume au capital et aux spécifications réelles'}
                  </p>
                </div>
              </div>
              <Link
                to={`/dashboard/calculator?symbol=${encodeURIComponent(selected.symbol)}&entry=${selected.entry}&sl=${selected.stopLoss}&tp=${selected.takeProfit1 || selected.takeProfit2 || ''}&direction=${selected.direction}&market=${selected.market || ''}`}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm"
              >
                {isEn ? 'Calculate' : 'Calculer'}
              </Link>
            </div>

            {/* Strategic Zones Detected (Order Block, FVG, Liquidity) */}
            {selected.zones && selected.zones.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-brand-500" />
                  {t('zonesTitle')}
                </p>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {selected.zones.map((zone, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                    >
                      <span className="font-semibold block text-[11px]" style={{ color: zone.color || '#3b82f6' }}>
                        ● {zone.label}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 block mt-1">
                        {formatPrice(zone.priceMin)} - {formatPrice(zone.priceMax)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rationale */}
            {selected.rationale && (
              <div>
                <p className="text-sm font-semibold">{t('rationale')}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {selected.rationale}
                </p>
              </div>
            )}

            {/* Confluences */}
            {selected.confluences?.length > 0 && (
              <div>
                <p className="text-sm font-semibold">{t('confluences')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.confluences.map((c, i) => (
                    <Badge key={i} tone="blue">
                      <CheckCircle className="h-3 w-3 mr-1 text-brand-500" />
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 pt-2 border-t dark:border-gray-800">
              {isEn
                ? 'Generated in real-time for educational and decision-support purposes. Always practice prudent risk management.'
                : 'Généré en temps réel à des fins éducatives et d\'aide à la décision. Respectez toujours votre gestion du risque.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
