import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Radar,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  BookMarked,
  Mail,
  CheckCircle,
  FileText,
  Sliders,
  Bell,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  Layers,
  Crosshair,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import OpportunityCard from '../../components/analysis/OpportunityCard.jsx';
import LiveChart from '../../components/analysis/LiveChart.jsx';
import { opportunityApi, userApi } from '../../services/endpoints.js';
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
  const [strategyType, setStrategyType] = useState('smc');
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

  // Load preferences & meta
  useEffect(() => {
    opportunityApi
      .meta()
      .then(({ data }) => setMeta(data.data))
      .catch(() => {});

    userApi
      .getPreferences()
      .then(({ data }) => {
        const p = data.data.preferences || {};
        setStrategyType(p.favoriteStrategy || 'smc');
        setCustomStrategyText(p.customStrategy || '');
        setCustomTradingPlanText(p.customTradingPlan || '');
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

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await opportunityApi.scan({ market: filters.market || undefined });
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

  const handleSaveStrategyPlan = async () => {
    setSavingPlan(true);
    try {
      await userApi.updatePreferences({
        favoriteStrategy: strategyType,
        customStrategy: customStrategyText,
        customTradingPlan: customTradingPlanText,
        opportunityEmailAlerts: emailAlertsEnabled,
        minOpportunityConfidence: Number(minEmailConfidence),
      });
      toast.success(
        isEn
          ? 'Trading Strategy and Plan saved successfully!'
          : 'Stratégie et Plan de Trading enregistrés avec succès !'
      );
      setStrategyModalOpen(false);
      runScan();
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
            onClick={runScan}
            loading={scanning}
            className="flex items-center gap-1.5 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            {t('scanNow')}
          </Button>
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
          title={isEn ? 'My Trading Strategy & Plan' : 'Ma Stratégie & Mon Plan de Trading'}
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {isEn
                ? 'Configure your personal strategy. The Opportunity Scanner will scan live markets according to your exact rules.'
                : 'Configurez votre stratégie personnelle. L\'Opportunity Scanner analysera les marchés selon vos règles exactes.'}
            </p>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {t('strategy')}
              </label>
              <select
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="smc">Smart Money Concepts (SMC - Par Défaut)</option>
                <option value="ict">Inner Circle Trader (ICT)</option>
                <option value="price-action">Price Action Institutionnel</option>
                <option value="custom">Ma Stratégie Personnalisée</option>
              </select>
            </div>

            {strategyType === 'custom' && (
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {isEn ? 'Custom Strategy Description' : 'Description de votre Stratégie'}
                </label>
                <textarea
                  rows={4}
                  value={customStrategyText}
                  onChange={(e) => setCustomStrategyText(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g., Scan for M15 rejections on 1H Order Blocks after Asian session liquidity sweep...'
                      : 'ex: Chercher un rejet M15 sur Order Block 1H après balayage de la liquidité asiatique...'
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {isEn ? 'Personal Trading Plan (Rules & Constraints)' : 'Plan de Trading Personnel (Règles & Contraintes)'}
              </label>
              <textarea
                rows={3}
                value={customTradingPlanText}
                onChange={(e) => setCustomTradingPlanText(e.target.value)}
                placeholder={
                  isEn
                    ? 'e.g., Maximum 1% risk per trade, Minimum 1:2.5 R:R, Only trade during London and NY sessions...'
                    : 'ex: Risque max 1% par trade, Ratio R:R minimum 1:2.5, Ne trader que pendant les sessions Londres et New York...'
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
                  : 'Recevez directement les opportunités détectées dans votre boîte mail dès leur apparition en temps réel.'}
                <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                  {isEn
                    ? '⚠️ Alerts automatically stop when your subscription expires.'
                    : '⚠️ Les alertes s\'arrêtent automatiquement dès que votre abonnement arrive à expiration.'}
                </span>
              </p>

              {emailAlertsEnabled && (
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
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
                {t('save')} &amp; {t('scanNow')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Opportunity Detail Modal with Live Candlestick Chart & Confluences */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
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
