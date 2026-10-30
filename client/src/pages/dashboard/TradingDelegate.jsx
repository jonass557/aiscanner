import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Radar, Bell, CheckCircle, AlertTriangle, ShieldCheck,
  Play, Pause, Sliders, RefreshCw, Layers, ExternalLink,
  Clock, Zap, Check, X, Info, Target, ArrowRight, BookOpen,
  Calculator, Cpu, ChevronRight, Activity, BellRing,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { delegateApi } from '../../services/endpoints.js';
import toast from 'react-hot-toast';

const MARKET_OPTIONS = [
  { id: 'forex', label: 'Forex' },
  { id: 'commodities', label: 'Métaux & Énergie' },
  { id: 'crypto', label: 'Cryptomonnaies' },
  { id: 'indices', label: 'Indices Mondiaux' },
  { id: 'synthetic', label: 'Indices Synthétiques Deriv' },
];

const TIMEFRAME_OPTIONS = ['M15', 'H1', 'H4', 'D1'];
const STRATEGY_OPTIONS = ['SMC', 'ICT', 'Price-Action', 'Supply-Demand'];
const SESSION_OPTIONS = [
  { id: 'Any', label: 'Toutes Sessions' },
  { id: 'London', label: 'Session de Londres' },
  { id: 'New-York', label: 'Session de New York' },
  { id: 'Asian', label: 'Session Asiatique' },
];

export default function TradingDelegate() {
  const { isEn } = useLanguage();
  const { user } = useAuth();

  // Core Delegate Config & State
  const [config, setConfig] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'notifications' | 'settings'
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Opportunity for Detailed Sheet Modal
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);

  // Form State for Delegate Settings
  const [selectedMarkets, setSelectedMarkets] = useState(['forex', 'commodities', 'indices', 'synthetic']);
  const [selectedTimeframes, setSelectedTimeframes] = useState(['H1', 'H4']);
  const [selectedStrategies, setSelectedStrategies] = useState(['SMC', 'ICT']);
  const [selectedSession, setSelectedSession] = useState('Any');
  const [minConfidence, setMinConfidence] = useState(75);
  const [minRR, setMinRR] = useState(2.0);
  const [maxRisk, setMaxRisk] = useState(1.0);
  const [maxSignalsDay, setMaxSignalsDay] = useState(5);
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('20:00');
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Load delegate data from backend
  const loadData = useCallback(async (isBg = false) => {
    if (!isBg) setRefreshing(true);
    try {
      const [cfgRes, oppRes, notifRes] = await Promise.all([
        delegateApi.getConfig(),
        delegateApi.getOpportunities({ status: statusFilter || undefined, limit: 40 }),
        delegateApi.getNotifications({ limit: 30 }),
      ]);

      if (cfgRes?.data?.data?.config) {
        const c = cfgRes.data.data.config;
        setConfig(c);
        setSelectedMarkets(c.markets || ['forex', 'commodities']);
        setSelectedTimeframes(c.timeframes || ['H1']);
        setSelectedStrategies(c.strategies || ['SMC']);
        setSelectedSession(c.sessions?.[0] || 'Any');
        setMinConfidence(c.minConfidenceScore || 75);
        setMinRR(c.minRiskReward || 2.0);
        setMaxRisk(c.maxRiskPerTradePercent || 1.0);
        setMaxSignalsDay(c.maxSignalsPerDay || 5);
        setHoursEnabled(Boolean(c.operatingHours?.enabled));
        setStartTime(c.operatingHours?.start || '08:00');
        setEndTime(c.operatingHours?.end || '20:00');
        setNotifyInApp(Boolean(c.notifications?.inApp !== false));
        setNotifyEmail(Boolean(c.notifications?.email !== false));
      }

      if (oppRes?.data?.data?.opportunities) {
        setOpportunities(oppRes.data.data.opportunities);
      }

      if (notifRes?.data?.data) {
        setNotifications(notifRes.data.data.notifications || []);
        setUnreadCount(notifRes.data.data.unreadCount || 0);
      }
    } catch (err) {
      if (!isBg) toast.error(err?.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
    // 15-second background auto-poll for live status
    const interval = setInterval(() => loadData(true), 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Toggle Global Delegation State
  const handleToggleDelegate = async () => {
    try {
      const { data } = await delegateApi.toggle();
      setConfig(data.data.config);
      toast.success(data.message);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur lors du basculement');
    }
  };

  // Toggle "Je n'ai pas le temps de trader" Mode
  const handleTogglePassiveMode = async () => {
    try {
      const { data } = await delegateApi.passiveMode({ activate: !config?.isPassiveMode });
      setConfig(data.data.config);
      toast.success(data.message);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur');
    }
  };

  // Trigger Immediate Sweep
  const handleTriggerSweep = async () => {
    setRefreshing(true);
    try {
      const { data } = await delegateApi.triggerSweep();
      toast.success(data.message || 'Balayage terminé');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur de balayage');
    } finally {
      setRefreshing(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await delegateApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success(isEn ? 'All notifications marked as read' : 'Toutes les notifications sont lues');
    } catch {
      toast.error('Erreur');
    }
  };

  // Save Settings Form
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        markets: selectedMarkets,
        timeframes: selectedTimeframes,
        strategies: selectedStrategies,
        sessions: [selectedSession],
        minConfidenceScore: Number(minConfidence),
        minRiskReward: Number(minRR),
        maxRiskPerTradePercent: Number(maxRisk),
        maxSignalsPerDay: Number(maxSignalsDay),
        operatingHours: {
          enabled: hoursEnabled,
          start: startTime,
          end: endTime,
        },
        notifications: {
          inApp: notifyInApp,
          email: notifyEmail,
          minScoreForEmail: 80,
        },
      };

      const { data } = await delegateApi.updateConfig(payload);
      setConfig(data.data.config);
      setActiveTab('feed');
      toast.success(isEn ? 'Surveillance settings updated!' : 'Paramètres de surveillance mis à jour !');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur d\'enregistrement');
    } finally {
      setSavingSettings(false);
    }
  };

  const isDelegateActive = config?.isEnabled && config?.serverStatus === 'active';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-md">
              <Radar className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {isEn ? 'AI Trading Delegate' : 'AI Trading Delegate — Surveillance Autonome'}
                </h1>
                {/* Live Server Heartbeat Indicator */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isDelegateActive
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : config?.serverStatus === 'outside_hours'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isDelegateActive ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'
                    }`}
                  />
                  {isDelegateActive
                    ? isEn ? 'Server Watching Live' : 'Surveillance Active (Serveur)'
                    : config?.serverStatus === 'outside_hours'
                    ? isEn ? 'Outside Hours' : 'Hors Plages Horaires'
                    : isEn ? 'Delegate Paused' : 'Surveillance en Pause'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {isEn
                  ? 'Delegate market monitoring to the server. Get alerted only when high-confluence SMC setups form.'
                  : 'Déléguez la surveillance continue des marchés à l\'IA. Soyez alerté uniquement sur vos critères précis.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Sweep */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Pause / Resume Button */}
          <button
            onClick={handleToggleDelegate}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              config?.isEnabled
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {config?.isEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {config?.isEnabled
              ? isEn ? 'Pause Surveillance' : 'Mettre en Pause'
              : isEn ? 'Start Surveillance' : 'Démarrer la Surveillance'}
          </button>

          {/* Trigger Sweep */}
          <button
            onClick={handleTriggerSweep}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 transition"
            title="Lancer un balayage immédiat des marchés"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{isEn ? 'Scan Now' : 'Balayer'}</span>
          </button>
        </div>
      </div>

      {/* MODE : "JE N'AI PAS LE TEMPS DE TRADER" SPECIAL PROMOTIONAL BANNER */}
      <div className="rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50/70 via-indigo-50/40 to-white p-5 shadow-sm dark:border-brand-900/60 dark:from-brand-950/40 dark:via-indigo-950/20 dark:to-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-xl bg-brand-600 text-white shadow-md shrink-0">
              <Zap className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                  {isEn ? 'Mode: "I Don\'t Have Time to Trade"' : 'Mode : « Je n\'ai pas le temps de trader »'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-600 text-white">
                  100% Autonome
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                {isEn
                  ? 'Activate passive delegation: the server monitors markets 24/7 in the background even if you close the app. It filters out noise and sends only Grade-A institutional setups directly to your email and notification center.'
                  : 'Délégation passive totale : l\'IA surveille les marchés 24h/24 en arrière-plan sur le serveur même quand votre navigateur est fermé. Elle filtre le bruit et vous alerte uniquement sur les opportunités de haute qualité prêtes à être exécutées.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleTogglePassiveMode}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-md shrink-0 ${
              config?.isPassiveMode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            {config?.isPassiveMode
              ? isEn ? '✓ Passive Mode Active' : '✓ Mode Actif'
              : isEn ? 'Activate Passive Mode' : 'Activer le Mode Passif'}
          </button>
        </div>
      </div>

      {/* METRICS & SURVEILLANCE KPI BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Markets */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs text-gray-500">{isEn ? 'Markets Monitored' : 'Marchés Surveillés'}</span>
          <p className="mt-1 font-bold text-base text-gray-900 dark:text-white">
            {config?.markets?.length || 0} {isEn ? 'Categories' : 'Catégories'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {config?.markets?.map((m) => (
              <span key={m} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Signals Today vs Quota */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{isEn ? 'Alerts Today' : 'Alertes Aujourd\'hui'}</span>
            <span className="text-[11px] font-mono text-gray-400">Max: {config?.maxSignalsPerDay || 5}/j</span>
          </div>
          <p className="mt-1 font-mono font-bold text-lg text-gray-900 dark:text-white">
            {config?.metrics?.signalsCountToday || 0}
            <span className="text-xs font-normal text-gray-400"> / {config?.maxSignalsPerDay || 5}</span>
          </p>
          <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, (((config?.metrics?.signalsCountToday || 0) / (config?.maxSignalsPerDay || 5)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Minimum Confluence Threshold */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs text-gray-500">{isEn ? 'Min Confluence Required' : 'Confluence Minimale'}</span>
          <p className="mt-1 font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
            ≥ {config?.minConfidenceScore || 75}%
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {isEn ? 'Strict quality filter applied' : 'Rejette les setups faibles'}
          </p>
        </div>

        {/* Min Risk / Reward Target */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs text-gray-500">{isEn ? 'Target Risk/Reward' : 'Ratio Risque/Rendement'}</span>
          <p className="mt-1 font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
            ≥ 1:{config?.minRiskReward || 2.0}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {isEn ? 'Protection capital manager' : 'Garde-fous mathématiques'}
          </p>
        </div>
      </div>

      {/* TABS CONTAINER: FEED vs NOTIFICATIONS vs SETTINGS */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
                activeTab === 'feed'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isEn ? `Surveillance Feed (${opportunities.length})` : `Flux d'Opportunités (${opportunities.length})`}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'notifications'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{isEn ? 'Notifications' : 'Alertes'}</span>
              {unreadCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isEn ? 'Delegate Configuration' : 'Configuration de Surveillance'}</span>
            </button>
          </div>

          {activeTab === 'feed' && (
            <div className="flex items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2.5 py-1.5 font-semibold dark:text-white"
              >
                <option value="">{isEn ? 'All Statuses' : 'Tous les statuts'}</option>
                <option value="NEW_OPPORTUNITY">{isEn ? 'New Opportunities' : 'Nouvelles Opportunités'}</option>
                <option value="TRIGGERED">{isEn ? 'Triggered (In Zone)' : 'Zone Atteinte (Déclenché)'}</option>
                <option value="CONFIRMED">{isEn ? 'Confirmed' : 'Confirmées'}</option>
                <option value="CLOSED">{isEn ? 'Closed / Target Hit' : 'Objectif Atteint'}</option>
                <option value="INVALIDATED">{isEn ? 'Invalidated' : 'Invalidées'}</option>
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: OPPORTUNITIES FEED */}
        {activeTab === 'feed' && (
          <div className="p-5">
            {opportunities.length === 0 ? (
              <div className="text-center py-12">
                <Radar className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {isEn ? 'No opportunities matching current criteria' : 'Aucune opportunité ne correspond à vos filtres actuels'}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  {isEn
                    ? 'AI Delegate is continuously scanning in the background. High-confluence setups will appear here immediately.'
                    : 'Le Delegate surveille les marchés en arrière-plan. Dès qu\'une configuration SMC valide se forme, elle apparaîtra ici instantanément.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opportunities.map((opp) => (
                  <div
                    key={opp._id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Symbol & Badges */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-gray-900 dark:text-white">{opp.symbol}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {opp.timeframe}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            opp.direction === 'BUY'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {opp.direction}
                        </span>
                      </div>

                      {/* Status & Confluence */}
                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            opp.status === 'TRIGGERED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : opp.status === 'INVALIDATED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : opp.status === 'CLOSED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          ● {opp.status}
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {opp.confidenceScore}% Confluence
                        </span>
                      </div>

                      {/* Key Price Levels */}
                      <div className="mt-3 grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800/60 p-2 rounded-lg font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block">Entrée</span>
                          <span className="font-bold text-gray-900 dark:text-white truncate block">{opp.entry}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-500 block">Stop-Loss</span>
                          <span className="font-bold text-rose-600 truncate block">{opp.stopLoss}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-500 block">Take-Profit</span>
                          <span className="font-bold text-emerald-600 truncate block">{opp.takeProfit1 || '—'}</span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                        {opp.rationale}
                      </p>
                    </div>

                    {/* Bottom CTA to Detailed Sheet */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-mono">R:R {opp.riskRewardRatio}</span>
                      <button
                        onClick={() => setSelectedOpportunity(opp)}
                        className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        <span>{isEn ? 'Full Sheet' : 'Fiche Complète'}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IN-APP NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500">
                {isEn ? 'Real-time alert log from server surveillance sweeps.' : 'Journal d\'alertes généré par les balayages de surveillance du serveur.'}
              </p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
                >
                  {isEn ? 'Mark all as read' : 'Tout marquer comme lu'}
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">{isEn ? 'No notifications yet' : 'Aucune notification reçue pour l\'instant'}</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`p-3.5 rounded-xl border transition flex items-start gap-3 ${
                      !n.isRead
                        ? 'border-brand-300 bg-brand-50/40 dark:border-brand-900/60 dark:bg-brand-950/30'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850'
                    }`}
                  >
                    <span className="p-2 rounded-lg bg-white dark:bg-gray-800 text-brand-600 shadow-sm shrink-0">
                      <BellRing className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{n.title}</span>
                        <span className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DELEGATE SURVEILLANCE SETTINGS */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="p-5 space-y-5 text-xs">
            {/* Markets Selection */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                {isEn ? 'Markets to Monitor' : 'Marchés sous Surveillance'}
              </label>
              <div className="flex flex-wrap gap-2">
                {MARKET_OPTIONS.map((m) => {
                  const isChecked = selectedMarkets.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (isChecked) setSelectedMarkets(selectedMarkets.filter((x) => x !== m.id));
                        else setSelectedMarkets([...selectedMarkets, m.id]);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        isChecked
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '} {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeframes & Sessions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                  {isEn ? 'Timeframes' : 'Unités de Temps'}
                </label>
                <div className="flex gap-2">
                  {TIMEFRAME_OPTIONS.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        if (selectedTimeframes.includes(tf)) setSelectedTimeframes(selectedTimeframes.filter((x) => x !== tf));
                        else setSelectedTimeframes([...selectedTimeframes, tf]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        selectedTimeframes.includes(tf)
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                  {isEn ? 'Session Killzones' : 'Sessions de Trading'}
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                >
                  {SESSION_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quality Thresholds */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isEn ? 'Min Confluence Score (%)' : 'Score Confluence Minimal (%)'}
                </label>
                <input
                  type="number"
                  min="70"
                  max="95"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isEn ? 'Min Risk/Reward Ratio' : 'Ratio Risque/Rendement Min'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="10.0"
                  value={minRR}
                  onChange={(e) => setMinRR(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isEn ? 'Max Alerts Per Day' : 'Max Alertes par Jour'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxSignalsDay}
                  onChange={(e) => setMaxSignalsDay(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono font-bold dark:text-white"
                />
              </div>
            </div>

            {/* Notification Channels */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                {isEn ? 'Notification Dispatch' : 'Canaux de Notification'}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyInApp}
                    onChange={(e) => setNotifyInApp(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{isEn ? 'In-App Alerts' : 'Notifications dans l\'application'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{isEn ? 'Email Alerts (Real-time)' : 'Alertes E-mail en temps réel'}</span>
                </label>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
              >
                {savingSettings ? (isEn ? 'Saving...' : 'Enregistrement...') : isEn ? 'Save Configuration' : 'Enregistrer la Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* DETAILED OPPORTUNITY SHEET MODAL ("FICHE D'OPPORTUNITÉ COMPLÈTE") */}
      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{selectedOpportunity.symbol}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {selectedOpportunity.timeframe}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                        selectedOpportunity.direction === 'BUY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedOpportunity.direction}
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Détecté le {new Date(selectedOpportunity.detectedAt).toLocaleString()} • {selectedOpportunity.market?.toUpperCase()}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedOpportunity(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Strategic Price Levels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                <span className="text-[10px] text-gray-400 block font-sans">Prix d'Entrée</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedOpportunity.entry}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                <span className="text-[10px] text-rose-500 block font-sans">Stop-Loss</span>
                <span className="text-sm font-bold text-rose-600">{selectedOpportunity.stopLoss}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] text-emerald-500 block font-sans">Take-Profit 1</span>
                <span className="text-sm font-bold text-emerald-600">{selectedOpportunity.takeProfit1}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] text-emerald-500 block font-sans">Take-Profit 2</span>
                <span className="text-sm font-bold text-emerald-600">{selectedOpportunity.takeProfit2}</span>
              </div>
            </div>

            {/* Confluences & Strategic Rationale */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Facteurs de Confluence Institutionnels ({selectedOpportunity.confidenceScore}%)</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedOpportunity.confluences?.map((c, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]"
                  >
                    ✓ {c}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl">
                {selectedOpportunity.rationale}
              </p>
            </div>

            {/* Contributing Engines & Risks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-gray-900 dark:text-white block mb-1">Moteurs Contributifs :</span>
                <ul className="text-gray-500 space-y-0.5 text-[11px]">
                  {selectedOpportunity.contributingEngines?.map((eng, idx) => (
                    <li key={idx}>• {eng}</li>
                  )) || <li>• Smart Money Concepts (SMC Engine)</li>}
                </ul>
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-gray-900 dark:text-white block mb-1">Risques & Limites :</span>
                <ul className="text-rose-600 dark:text-rose-400 space-y-0.5 text-[11px]">
                  {selectedOpportunity.identifiedRisks?.map((r, idx) => (
                    <li key={idx}>⚠️ {r}</li>
                  )) || <li>• Volatilité standard en cours</li>}
                </ul>
              </div>
            </div>

            {/* Execution CTAs */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-3">
              {/* Direct Link to Position Calculator */}
              <Link
                to={`/dashboard/calculator?symbol=${encodeURIComponent(selectedOpportunity.symbol)}&entry=${selectedOpportunity.entry}&sl=${selectedOpportunity.stopLoss}&tp=${selectedOpportunity.takeProfit1 || ''}&direction=${selectedOpportunity.direction}&market=${selectedOpportunity.market || ''}`}
                className="flex-1 w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-700 dark:text-gray-200 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Calculator className="h-4 w-4" />
                {isEn ? 'Calculate Lot Size' : 'Calculer la taille de position'}
              </Link>

              {/* Direct Link to Managed Trading */}
              <Link
                to={`/dashboard/managed-trading`}
                className="flex-1 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
              >
                <Cpu className="h-4 w-4" />
                {isEn ? 'Execute in Managed Trading' : 'Exécuter dans Managed Trading'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
