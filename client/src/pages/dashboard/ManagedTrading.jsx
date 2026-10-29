import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle,
  Play, Pause, Power, Sliders, DollarSign, RefreshCw, Plus,
  Trash2, X, ExternalLink, Activity, ArrowUpRight, ArrowDownRight,
  Clock, Lock, Check, Info, FileText, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { managedTradingApi, opportunityApi } from '../../services/endpoints.js';
import toast from 'react-hot-toast';

export default function ManagedTrading() {
  const { isEn } = useLanguage();
  const { user } = useAuth();

  // Core Configuration & Broker State
  const [config, setConfig] = useState(null);
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [pendingOpportunities, setPendingOpportunities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('positions'); // 'positions' | 'orders' | 'audit' | 'manual_queue'

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Add Broker Account Form
  const [newBroker, setNewBroker] = useState('deriv');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newAccountType, setNewAccountType] = useState('demo');
  const [connectingAccount, setConnectingAccount] = useState(false);

  // Settings State Form
  const [maxRiskPercent, setMaxRiskPercent] = useState(1.0);
  const [maxRiskAmount, setMaxRiskAmount] = useState(100);
  const [maxDailyLoss, setMaxDailyLoss] = useState(300);
  const [maxOpenPos, setMaxOpenPos] = useState(2);
  const [maxOrdersDay, setMaxOrdersDay] = useState(5);
  const [maxSlippage, setMaxSlippage] = useState(0.20);
  const [savingSettings, setSavingSettings] = useState(false);

  // Load configuration, accounts, positions, and history
  const loadData = useCallback(async (isBg = false) => {
    if (!isBg) setRefreshing(true);
    try {
      const [cfgRes, accRes, posRes, ordRes, oppRes] = await Promise.all([
        managedTradingApi.getConfig(),
        managedTradingApi.getBrokerAccounts(),
        managedTradingApi.getPositions(),
        managedTradingApi.getOrders({ limit: 40 }),
        opportunityApi.list({ tab: 'active' }).catch(() => ({ data: { data: { opportunities: [] } } })),
      ]);

      if (cfgRes?.data?.data?.config) {
        const c = cfgRes.data.data.config;
        setConfig(c);
        setMaxRiskPercent(c.maxRiskPerTradePercent || 1.0);
        setMaxRiskAmount(c.maxRiskPerTradeAmount || 100);
        setMaxDailyLoss(c.maxDailyLossAmount || 300);
        setMaxOpenPos(c.maxOpenPositions || 2);
        setMaxOrdersDay(c.maxOrdersPerDay || 5);
        setMaxSlippage(c.maxAllowedSlippagePercent || 0.20);
      }
      if (accRes?.data?.data?.accounts) setBrokerAccounts(accRes.data.data.accounts);
      if (posRes?.data?.data?.positions) setOpenPositions(posRes.data.data.positions);
      if (ordRes?.data?.data?.orders) setOrdersHistory(ordRes.data.data.orders);
      if (oppRes?.data?.data?.opportunities) setPendingOpportunities(oppRes.data.data.opportunities);
    } catch (err) {
      if (!isBg) toast.error(err?.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll every 10 seconds for real-time monitoring
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeAccount = brokerAccounts.find(
    (a) => a._id === (config?.activeBrokerAccountId?._id || config?.activeBrokerAccountId)
  );

  // Mode Switch Handlers
  const handleSelectMode = async (mode) => {
    if (config?.isEmergencyStopped) {
      toast.error(
        isEn
          ? 'Emergency stop is active. Reset emergency stop before switching modes.'
          : 'Arrêt d\'urgence actif. Réinitialisez l\'arrêt d\'urgence avant de changer de mode.'
      );
      return;
    }

    if (mode === 'automated') {
      // Must trigger Explicit Authorization Pre-Flight Modal
      if (!activeAccount) {
        toast.error(
          isEn
            ? 'Please connect and select a broker account first.'
            : 'Veuillez d\'abord connecter et sélectionner un compte de courtage.'
        );
        return;
      }
      if (activeAccount.accountType !== 'paper' && !activeAccount.isTradeAuthorized) {
        toast.error(
          isEn
            ? 'This broker account is READ-ONLY. Trading permission ("trade" scope) is required.'
            : 'Ce compte est en LECTURE SEULE. Le jeton doit posséder la permission "trade".'
        );
        return;
      }
      setAcknowledgedRisks(false);
      setAuthModalOpen(true);
      return;
    }

    // Modes 1 & 2 can be activated directly
    try {
      const { data } = await managedTradingApi.updateConfig({ operatingMode: mode });
      setConfig(data.data.config);
      toast.success(
        mode === 'analysis_only'
          ? isEn
            ? 'Mode 1: Analysis Only active'
            : 'Mode 1 : Analyse Uniquement activé (aucun ordre envoyé)'
          : isEn
          ? 'Mode 2: Manual Confirmation active'
          : 'Mode 2 : Confirmation Manuelle activé'
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur de changement de mode');
    }
  };

  // Explicit Authorization for Mode 3
  const handleConfirmAutomatedTrading = async () => {
    if (!acknowledgedRisks) {
      toast.error(isEn ? 'Please acknowledge the risks checkbox.' : 'Veuillez cocher la case d\'acceptation des risques.');
      return;
    }

    try {
      const { data } = await managedTradingApi.activateAutomation({
        acknowledgedRisks: true,
        brokerAccountId: activeAccount?._id,
      });
      setConfig(data.data.config);
      setAuthModalOpen(false);
      toast.success(
        isEn
          ? 'Mode 3: Automated Trading activated with strict risk protections!'
          : 'Mode 3 : Automatisation autorisée active sous contrôle strict du risque !'
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur d\'activation');
    }
  };

  // Instant Emergency Kill Switch
  const handleEmergencyStop = async () => {
    try {
      const { data } = await managedTradingApi.emergencyStop('Arrêt d\'urgence manuel déclenché par l\'utilisateur');
      setConfig(data.data.config);
      toast.error(
        isEn
          ? 'EMERGENCY STOP ACTIVATED: All automated execution halted!'
          : 'ARRÊT D\'URGENCE ACTIVÉ : Tout passage d\'ordre automatique est suspendu immédiatement !'
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'arrêt d\'urgence');
    }
  };

  // Reset Emergency Stop
  const handleResetEmergency = async () => {
    try {
      const { data } = await managedTradingApi.resetEmergency();
      setConfig(data.data.config);
      toast.success(isEn ? 'Emergency stop reset to Analysis Only mode.' : 'Arrêt d\'urgence réinitialisé (Mode Analyse Uniquement).');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la réinitialisation');
    }
  };

  // Connect Broker Account Form
  const handleConnectAccount = async (e) => {
    e.preventDefault();
    if (!newAccountName) {
      toast.error('Libellé obligatoire');
      return;
    }
    setConnectingAccount(true);
    try {
      const { data } = await managedTradingApi.connectBrokerAccount({
        broker: newBroker,
        accountName: newAccountName,
        accountId: newAccountId || (newBroker === 'paper' ? 'PAPER-01' : 'ACCOUNT-1'),
        token: newToken,
        secret: newSecret,
        accountType: newAccountType,
      });
      toast.success(data.message || 'Compte connecté avec succès !');
      setAddAccountModalOpen(false);
      setNewAccountName('');
      setNewAccountId('');
      setNewToken('');
      setNewSecret('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Échec de connexion');
    } finally {
      setConnectingAccount(false);
    }
  };

  // Delete Broker Account
  const handleDeleteAccount = async (id) => {
    if (!window.confirm(isEn ? 'Disconnect this broker account?' : 'Déconnecter ce compte broker ?')) return;
    try {
      await managedTradingApi.deleteBrokerAccount(id);
      toast.success(isEn ? 'Account disconnected' : 'Compte déconnecté');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur');
    }
  };

  // Execute Mode 2 Manual Trade from Queue
  const handleExecuteManual = async (opportunity) => {
    if (!activeAccount) {
      toast.error(isEn ? 'Select an active broker account first.' : 'Sélectionnez d\'abord un compte broker actif.');
      return;
    }
    try {
      const { data } = await managedTradingApi.executeManualOrder({
        opportunityId: opportunity._id,
        brokerAccountId: activeAccount._id,
      });
      toast.success(data.message || 'Ordre exécuté avec succès !');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Ordre rejeté par le moteur de risque');
    }
  };

  // Close Open Position
  const handleClosePosition = async (posId) => {
    if (!window.confirm(isEn ? 'Close this position at market price?' : 'Fermer cette position au prix du marché ?')) return;
    try {
      await managedTradingApi.closePosition(posId);
      toast.success(isEn ? 'Position closed' : 'Position clôturée');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la clôture');
    }
  };

  // Save Risk Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { data } = await managedTradingApi.updateConfig({
        maxRiskPerTradePercent: Number(maxRiskPercent),
        maxRiskPerTradeAmount: Number(maxRiskAmount),
        maxDailyLossAmount: Number(maxDailyLoss),
        maxOpenPositions: Number(maxOpenPos),
        maxOrdersPerDay: Number(maxOrdersDay),
        maxAllowedSlippagePercent: Number(maxSlippage),
      });
      setConfig(data.data.config);
      setSettingsModalOpen(false);
      toast.success(isEn ? 'Risk policy updated!' : 'Politique de risque mise à jour !');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
              <Cpu className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {isEn ? 'AI Managed Trading' : 'AI Managed Trading — Gestion des Ordres'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300">
                  Risk Engine
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {isEn
                  ? 'Automated & manual execution engine under institutional risk controls (Deriv, Binance, Simulation).'
                  : 'Exécution automatisée et contrôlée de vos stratégies avec garde-fous stricts (Deriv, Binance, Simulation).'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Emergency Stop */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Emergency Kill Switch */}
          {config?.isEmergencyStopped ? (
            <button
              onClick={handleResetEmergency}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition"
            >
              <Power className="h-4 w-4" />
              {isEn ? 'Reset Emergency Stop' : "Réinitialiser l'Arrêt d'Urgence"}
            </button>
          ) : (
            <button
              onClick={handleEmergencyStop}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition uppercase tracking-wider animate-pulse hover:animate-none"
              title="Arrête immédiatement toute automatisation"
            >
              <ShieldAlert className="h-4 w-4" />
              {isEn ? 'EMERGENCY STOP' : "ARRÊT D'URGENCE"}
            </button>
          )}

          {/* Risk Settings Button */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 transition"
          >
            <Sliders className="h-4 w-4" />
            {isEn ? 'Risk Policy' : 'Limites de Risque'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadData()}
            disabled={refreshing}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Stop Active Banner */}
      {config?.isEmergencyStopped && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                {isEn ? 'EMERGENCY STOP IS ACTIVE' : "ARRÊT D'URGENCE ACTIF — SYSTÈME SUSPENDU"}
              </h3>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                {config.emergencyStopReason || 'Tous les ordres automatisés ont été bloqués immédiatement.'}
              </p>
            </div>
            <button
              onClick={handleResetEmergency}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              {isEn ? 'Unlock System' : 'Déverrouiller'}
            </button>
          </div>
        </div>
      )}

      {/* 3 OPERATING MODES SWITCHER */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-500" />
              {isEn ? 'Operating Mode Selection' : 'Mode de Fonctionnement'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isEn
                ? 'Choose how orders are confirmed and executed.'
                : 'Déterminez le degré de contrôle entre analyse, confirmation manuelle et automatisation.'}
            </p>
          </div>

          <span
            className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              config?.operatingMode === 'automated'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 ring-1 ring-purple-500'
                : config?.operatingMode === 'manual_confirmation'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 ring-1 ring-blue-500'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            ● {config?.operatingMode === 'automated'
              ? isEn ? 'Mode 3: Automated' : 'Mode 3 : Automatisé'
              : config?.operatingMode === 'manual_confirmation'
              ? isEn ? 'Mode 2: Manual Confirm' : 'Mode 2 : Confirmation Manuelle'
              : isEn ? 'Mode 1: Analysis Only' : 'Mode 1 : Analyse Uniquement'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode 1 */}
          <button
            type="button"
            onClick={() => handleSelectMode('analysis_only')}
            className={`p-4 rounded-xl text-left border-2 transition ${
              config?.operatingMode === 'analysis_only'
                ? 'border-brand-500 bg-brand-50/40 dark:border-brand-600 dark:bg-brand-950/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-gray-900 dark:text-white">
                {isEn ? 'Mode 1: Analysis Only' : 'Mode 1 : Analyse Uniquement'}
              </span>
              {config?.operatingMode === 'analysis_only' && <CheckCircle className="h-4 w-4 text-brand-600" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {isEn
                ? 'Surfaces opportunities and calculates position sizing. ZERO orders are dispatched to the broker.'
                : 'Détecte les opportunités et calcule les tailles de position. Aucun ordre n\'est envoyé au courtier.'}
            </p>
          </button>

          {/* Mode 2 */}
          <button
            type="button"
            onClick={() => handleSelectMode('manual_confirmation')}
            className={`p-4 rounded-xl text-left border-2 transition ${
              config?.operatingMode === 'manual_confirmation'
                ? 'border-blue-500 bg-blue-50/40 dark:border-blue-600 dark:bg-blue-950/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-gray-900 dark:text-white">
                {isEn ? 'Mode 2: Manual Confirm' : 'Mode 2 : Confirmation Manuelle'}
              </span>
              {config?.operatingMode === 'manual_confirmation' && <CheckCircle className="h-4 w-4 text-blue-600" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {isEn
                ? 'Prepares exact order size, SL and TP. Requires your explicit single click to dispatch to the broker.'
                : 'Prépare l\'ordre avec volume et protections calculés. Requiert votre clic explicite avant tout envoi.'}
            </p>
          </button>

          {/* Mode 3 */}
          <button
            type="button"
            onClick={() => handleSelectMode('automated')}
            className={`p-4 rounded-xl text-left border-2 transition ${
              config?.operatingMode === 'automated'
                ? 'border-purple-500 bg-purple-50/40 dark:border-purple-600 dark:bg-purple-950/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-gray-900 dark:text-white flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-purple-600" />
                {isEn ? 'Mode 3: Automated Trading' : 'Mode 3 : Automatisation'}
              </span>
              {config?.operatingMode === 'automated' && <CheckCircle className="h-4 w-4 text-purple-600" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {isEn
                ? 'Autonomous execution strictly bounded by risk rules. Disabled by default, requires pre-flight authorization.'
                : 'Envoi automatique des ordres conformes à vos limites de risque. Désactivé par défaut.'}
            </p>
          </button>
        </div>
      </div>

      {/* METRICS & BROKER HEALTH STATUS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Broker Account */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{isEn ? 'Connected Broker' : 'Compte Broker Actif'}</span>
            <button
              onClick={() => setAddAccountModalOpen(true)}
              className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              {isEn ? '+ Connect' : '+ Connecter'}
            </button>
          </div>
          <p className="mt-1 font-bold text-sm text-gray-900 dark:text-white truncate">
            {activeAccount ? activeAccount.accountName : isEn ? 'No Account Active' : 'Aucun compte actif'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                activeAccount?.isTradeAuthorized || activeAccount?.accountType === 'paper'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              ● {activeAccount?.accountType === 'paper'
                ? 'Simulation'
                : activeAccount?.isTradeAuthorized
                ? 'Trading Autorisé'
                : 'Lecture Seule'}
            </span>
            <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-400">
              {activeAccount?.balance?.toFixed(2) || '0.00'} {activeAccount?.currency || 'USD'}
            </span>
          </div>
        </div>

        {/* Daily Loss Limit Tracking */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{isEn ? 'Daily Loss Used' : 'Perte Quotidienne Utilisée'}</span>
            <span className="text-[11px] font-mono text-gray-400">Max: ${config?.maxDailyLossAmount || 300}</span>
          </div>
          <p className="mt-1 font-mono font-bold text-lg text-gray-900 dark:text-white">
            ${config?.dailyMetrics?.realizedLossToday?.toFixed(2) || '0.00'}
          </p>
          <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                ((config?.dailyMetrics?.realizedLossToday || 0) / (config?.maxDailyLossAmount || 300)) > 0.8
                  ? 'bg-rose-500'
                  : 'bg-brand-500'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (((config?.dailyMetrics?.realizedLossToday || 0) / (config?.maxDailyLossAmount || 300)) * 100) || 0
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Open Positions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{isEn ? 'Open Positions' : 'Positions Ouvertes'}</span>
            <span className="text-[11px] font-mono text-gray-400">Max: {config?.maxOpenPositions || 2}</span>
          </div>
          <p className="mt-1 font-mono font-bold text-lg text-gray-900 dark:text-white">
            {openPositions.length} <span className="text-xs font-normal text-gray-400">/ {config?.maxOpenPositions || 2}</span>
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {openPositions.length === 0
              ? isEn ? 'No exposure in the market' : 'Aucune exposition au marché'
              : `${openPositions.length} ${isEn ? 'trade(s) monitored' : 'trade(s) sous surveillance'}`}
          </p>
        </div>

        {/* Orders Executed Today */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{isEn ? 'Orders Today' : 'Ordres Envoyés Aujourd\'hui'}</span>
            <span className="text-[11px] font-mono text-gray-400">Max: {config?.maxOrdersPerDay || 5}</span>
          </div>
          <p className="mt-1 font-mono font-bold text-lg text-gray-900 dark:text-white">
            {config?.dailyMetrics?.ordersExecutedToday || 0}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {isEn ? 'Cap reset at 00:00 UTC' : 'Plafond réinitialisé à 00:00 UTC'}
          </p>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 p-3 overflow-x-auto">
          {[
            { id: 'positions', labelFr: `Positions Ouvertes (${openPositions.length})`, labelEn: `Open Positions (${openPositions.length})` },
            { id: 'manual_queue', labelFr: `File Confirmation Manuelle (${pendingOpportunities.length})`, labelEn: `Manual Queue (${pendingOpportunities.length})` },
            { id: 'orders', labelFr: `Historique des Ordres (${ordersHistory.length})`, labelEn: `Orders History (${ordersHistory.length})` },
            { id: 'accounts', labelFr: `Comptes Courtier (${brokerAccounts.length})`, labelEn: `Broker Accounts (${brokerAccounts.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
                activeTab === tab.id
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isEn ? tab.labelEn : tab.labelFr}
            </button>
          ))}
        </div>

        {/* TAB 1: OPEN POSITIONS */}
        {activeTab === 'positions' && (
          <div className="p-5">
            {openPositions.length === 0 ? (
              <div className="text-center py-10">
                <Activity className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {isEn ? 'No positions currently open' : 'Aucune position actuellement ouverte'}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  {isEn
                    ? 'Orders will appear here once executed and confirmed by the broker with their real fill price.'
                    : 'Les ordres exécutés et confirmés par le courtier apparaîtront ici avec leur prix réel d\'exécution.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] font-bold uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">Ticket ID</th>
                      <th className="py-2.5 px-3">Actif</th>
                      <th className="py-2.5 px-3">Sens</th>
                      <th className="py-2.5 px-3">Volume</th>
                      <th className="py-2.5 px-3">Prix Exécution</th>
                      <th className="py-2.5 px-3">Stop Loss</th>
                      <th className="py-2.5 px-3">Take Profit</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {openPositions.map((pos) => (
                      <tr key={pos._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50">
                        <td className="py-3 px-3 font-mono text-gray-500 font-semibold">{pos.brokerOrderId || pos._id.slice(-6)}</td>
                        <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">{pos.symbol}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              pos.direction === 'BUY' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60'
                            }`}
                          >
                            {pos.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold">{pos.volume} lots</td>
                        <td className="py-3 px-3 font-mono font-bold text-gray-900 dark:text-white">{pos.executionPrice || pos.requestedPrice}</td>
                        <td className="py-3 px-3 font-mono text-rose-600">{pos.stopLoss}</td>
                        <td className="py-3 px-3 font-mono text-emerald-600">{pos.takeProfit || '—'}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleClosePosition(pos._id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs"
                          >
                            {isEn ? 'Close' : 'Fermer'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL QUEUE (MODE 2) */}
        {activeTab === 'manual_queue' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500">
                {isEn
                  ? 'High-probability setups ready for your single-click execution authorization.'
                  : 'Opportunités SMC validées prêtes pour votre confirmation manuelle en un clic.'}
              </p>
              <span className="text-xs font-bold text-brand-600">Mode 2</span>
            </div>

            {pendingOpportunities.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">
                {isEn ? 'No pending setups in queue' : 'Aucune opportunité en attente de validation'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingOpportunities.slice(0, 6).map((opp) => (
                  <div
                    key={opp._id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{opp.symbol}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            opp.direction === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {opp.direction} • {opp.timeframe}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block">Entrée</span>
                          <span className="font-bold">{opp.entry}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-500 block">SL</span>
                          <span className="font-bold text-rose-600">{opp.stopLoss}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-500 block">TP</span>
                          <span className="font-bold text-emerald-600">{opp.takeProfit1 || '—'}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2 truncate">{opp.rationale || 'Setup institutionnel'}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Probabilité: {opp.confidenceScore}%</span>
                      <button
                        onClick={() => handleExecuteManual(opp)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <Play className="h-3 w-3" />
                        {isEn ? 'Confirm & Execute' : 'Confirmer & Exécuter'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORDERS HISTORY */}
        {activeTab === 'orders' && (
          <div className="p-5">
            {ordersHistory.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">{isEn ? 'No order history yet' : 'Aucun historique d\'ordre enregistré'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] font-bold uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Actif</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Sens</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3">Prix Demandé</th>
                      <th className="py-2.5 px-3">Prix Exécuté</th>
                      <th className="py-2.5 px-3">Slippage</th>
                      <th className="py-2.5 px-3">Détail / Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ordersHistory.map((ord) => (
                      <tr key={ord._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50">
                        <td className="py-2.5 px-3 text-gray-400">{new Date(ord.createdAt).toLocaleTimeString()}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">{ord.symbol}</td>
                        <td className="py-2.5 px-3 text-[10px] font-mono capitalize">{ord.executionMode}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ord.direction === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {ord.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ord.status === 'FILLED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 text-emerald-300'
                                : ord.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 text-rose-300'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{ord.requestedPrice}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                          {ord.executionPrice != null ? ord.executionPrice : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-500">
                          {ord.slippage != null ? `${ord.slippage} (${ord.slippagePercent}%)` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={ord.rejectionReason || 'Exécuté'}>
                          {ord.rejectionReason || 'Ordre exécuté et confirmé'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BROKER ACCOUNTS */}
        {activeTab === 'accounts' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {isEn ? 'Connected Broker Accounts' : 'Comptes de Courtage Connectés'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isEn
                    ? 'Only accounts with verified "trade" permissions can execute orders.'
                    : 'Seuls les comptes avec la permission "trade" vérifiée peuvent exécuter des ordres.'}
                </p>
              </div>
              <button
                onClick={() => setAddAccountModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                {isEn ? 'Add Account' : 'Ajouter un compte'}
              </button>
            </div>

            {brokerAccounts.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-400">
                {isEn ? 'No accounts connected. Click "+ Add Account" to begin.' : 'Aucun compte connecté. Cliquez sur "+ Ajouter un compte".'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {brokerAccounts.map((acc) => (
                  <div
                    key={acc._id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{acc.accountName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {acc.broker}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono">ID: {acc.accountId}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            acc.isTradeAuthorized || acc.accountType === 'paper'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {acc.accountType === 'paper'
                            ? 'Mode Simulation'
                            : acc.isTradeAuthorized
                            ? 'Trading Autorisé'
                            : 'Lecture Seule (Trading non permis)'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAccount(acc._id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title={isEn ? 'Disconnect' : 'Déconnecter'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXPLICIT AUTHORIZATION MODAL FOR MODE 3 (AUTOMATED TRADING) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xl w-full border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {isEn ? 'Pre-Flight Explicit Authorization' : 'Autorisation Préalable d\'Exécution Automatisée'}
                </h2>
              </div>
              <button onClick={() => setAuthModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {isEn
                ? 'Before enabling automated trade execution, please review and verify all risk limits, broker parameters, and fail-safes below.'
                : 'Avant d\'activer l\'exécution automatique des ordres, veuillez vérifier attentivement le récapitulatif de vos limites de risque et de votre courtier.'}
            </p>

            {/* Checklist Recap */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Courtier & Compte :</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {activeAccount?.accountName} ({activeAccount?.broker?.toUpperCase()})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Risque Max par Ordre :</span>
                <span className="font-mono font-bold text-purple-600">
                  {config?.maxRiskPerTradePercent}% (${config?.maxRiskPerTradeAmount} max)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Perte Quotidienne Maximale :</span>
                <span className="font-mono font-bold text-rose-600">${config?.maxDailyLossAmount || 300}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Positions Simultanées Max :</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{config?.maxOpenPositions || 2}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Ordres Max par Jour :</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{config?.maxOrdersPerDay || 5}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Tolérance de Slippage Max :</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{config?.maxAllowedSlippagePercent || 0.20}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Comportement en cas de coupure :</span>
                <span className="font-semibold text-emerald-600">Stop-Loss placé côté courtier</span>
              </div>
            </div>

            {/* Legal & Financial Risk Acknowledgement */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgedRisks}
                  onChange={(e) => setAcknowledgedRisks(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-rose-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                  <strong>{isEn ? 'Legal & Risk Acknowledgement:' : 'Reconnaissance des Risques Financiers :'}</strong>{' '}
                  {isEn
                    ? 'I understand and accept that trading involves substantial risk of loss. AI Scanner does not guarantee profits or execution prices. Orders will be placed at market conditions. I can stop automation at any time via the Emergency Stop button.'
                    : 'Je reconnais et j\'accepte que le trading comporte des risques substantiels de perte de capital. AI Scanner ne promet aucun profit ni ne garantit les prix d\'exécution. Les ordres seront exécutés selon les conditions du marché. Je peux désactiver l\'automatisation à tout instant via l\'Arrêt d\'Urgence.'}
                </span>
              </label>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
              >
                {isEn ? 'Cancel' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAutomatedTrading}
                disabled={!acknowledgedRisks}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                {isEn ? 'Authorize & Activate Mode 3' : 'Autoriser & Activer le Mode 3'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD BROKER ACCOUNT MODAL */}
      {addAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {isEn ? 'Connect Broker Account' : 'Connecter un Compte Courtier'}
              </h3>
              <button onClick={() => setAddAccountModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnectAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">{isEn ? 'Broker Platform' : 'Plateforme / Courtier'}</label>
                <select
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                >
                  <option value="deriv">Deriv (Indices Synthétiques & Forex)</option>
                  <option value="binance">Binance (Crypto Spot & Futures)</option>
                  <option value="paper">Simulation / Paper Trading (10 000$ Virtuels)</option>
                  <option value="metaapi_mt5" disabled>MetaTrader MT4 / MT5 (Requiert bridge dédié)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">{isEn ? 'Account Label' : 'Nom / Libellé du compte'}</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mon Compte Démo Deriv"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-medium dark:text-white"
                />
              </div>

              {newBroker !== 'paper' && (
                <>
                  <div>
                    <label className="block text-gray-500 mb-1">{isEn ? 'Account ID / Login' : 'Identifiant / Login Compte'}</label>
                    <input
                      type="text"
                      placeholder="ex: CR123456 ou UID"
                      value={newAccountId}
                      onChange={(e) => setNewAccountId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1">
                      {newBroker === 'deriv' ? 'Jeton API Deriv (API Token)' : 'Clé API Binance'}
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Collez votre jeton sécurisé ici"
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono dark:text-white"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      ℹ️ Pour autoriser le trading, veillez à cocher la permission <strong>trade</strong> lors de la création du jeton.
                    </p>
                  </div>

                  {newBroker === 'binance' && (
                    <div>
                      <label className="block text-gray-500 mb-1">API Secret Binance</label>
                      <input
                        type="password"
                        required
                        placeholder="Clé secrète Binance"
                        value={newSecret}
                        onChange={(e) => setNewSecret(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono dark:text-white"
                      />
                    </div>
                  )}
                </>
              )}

              {newBroker === 'paper' && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                    ✨ Le mode simulation vous permet de tester l'automatisation sans risque avec 10 000$ de capital virtuel et slippage réaliste.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddAccountModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500"
                >
                  {isEn ? 'Cancel' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={connectingAccount}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                >
                  {connectingAccount ? 'Validation...' : isEn ? 'Connect & Verify' : 'Connecter & Vérifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RISK POLICY SETTINGS MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {isEn ? 'AI Capital Manager Risk Boundaries' : 'Garde-fous & Limites de Risque'}
              </h3>
              <button onClick={() => setSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">Risque Max par Ordre (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={maxRiskPercent}
                  onChange={(e) => setMaxRiskPercent(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Perte Quotidienne Maximale ($)</label>
                <input
                  type="number"
                  step="10"
                  min="10"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Positions Ouvertes Simultanées Max</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxOpenPos}
                  onChange={(e) => setMaxOpenPos(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Ordres Maximums par Jour</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxOrdersDay}
                  onChange={(e) => setMaxOrdersDay(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Dérive de Prix / Slippage Max Autorisé (%)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1.0"
                  value={maxSlippage}
                  onChange={(e) => setMaxSlippage(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-bold dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500"
                >
                  {isEn ? 'Cancel' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                >
                  {savingSettings ? 'Enregistrement...' : isEn ? 'Save Limits' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
