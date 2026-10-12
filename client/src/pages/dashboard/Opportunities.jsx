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
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import OpportunityCard from '../../components/analysis/OpportunityCard.jsx';
import { opportunityApi, userApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatPrice, marketLabel } from '../../utils/format.js';

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
 * - Scan temps réel haute probabilité
 * - Configuration libre de sa stratégie & de son plan de trading personnel
 * - Alertes emails automatiques tant que l'abonnement/plan est actif (désactivé si expiré)
 */
export default function Opportunities() {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
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
        const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
        const { data } = await opportunityApi.list(params);
        setOpportunities(data.data.opportunities);
      } catch (err) {
        if (!isBackground) toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters]
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

  // Reload when filters change & auto-poll
  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await opportunityApi.scan({ market: filters.market || undefined });
      toast.success(data.message || 'Scan en temps réel terminé !');
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
      toast.success('Stratégie et Plan de Trading enregistrés avec succès !');
      setStrategyModalOpen(false);
      // Run on-demand scan with the updated strategy
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
        <option value="">All</option>
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
      {/* Top Banner & Control */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            <Radar className="h-7 w-7 text-brand-500 animate-pulse" /> Opportunity Scanner
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Setups en direct avec flux de marché temps réel, filtrés selon votre stratégie & votre plan de trading.
            {meta?.activeTotal != null && ` ${meta.activeTotal} opportunités actives en ce moment.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Strategy & Trading Plan Button */}
          <Button
            variant="secondary"
            onClick={() => setStrategyModalOpen(true)}
            className="border-brand-500/30 text-brand-700 dark:text-brand-300 bg-brand-50/60 dark:bg-brand-950/40 hover:bg-brand-100"
          >
            <BookMarked className="h-4 w-4 text-brand-600" />
            <span>Ma Stratégie & Plan</span>
          </Button>

          <Button variant="secondary" onClick={() => load()} loading={refreshing}>
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </Button>

          <Button onClick={runScan} loading={scanning} className="bg-brand-600 hover:bg-brand-500 shadow-sm">
            <Radar className="h-4 w-4" /> Scanner Maintenant
          </Button>
        </div>
      </div>

      {/* Plan status alert banner */}
      <div className="flex flex-wrap items-center justify-between rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/80 via-white to-brand-50/40 p-4 text-xs dark:border-brand-900/60 dark:from-brand-950/30 dark:via-gray-900 dark:to-brand-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">
              Stratégie Active :{' '}
              <span className="text-brand-600 dark:text-brand-400 uppercase font-extrabold">
                {strategyType === 'custom' ? 'Personnalisée' : strategyType}
              </span>
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              {emailAlertsEnabled
                ? `Notifications email activées (probabilité ≥ ${minEmailConfidence}%). Les alertes s'arrêtent automatiquement si votre plan arrive à expiration.`
                : 'Alertes emails désactivées.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setStrategyModalOpen(true)}
          className="mt-2 sm:mt-0 font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Modifier ma stratégie & mes règles →
        </button>
      </div>

      {/* Filters */}
      <div className="card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4" /> Filtres Avancés
          </p>
          <button onClick={clearFilters} className="text-xs text-brand-600 hover:underline">
            Réinitialiser
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select label="Marché" value={filters.market} onChange={(v) => setFilter('market', v)} options={meta?.markets || []} formatOption={marketLabel} />
          <Select label="Timeframe" value={filters.timeframe} onChange={(v) => setFilter('timeframe', v)} options={meta?.timeframes || []} />
          <Select label="Direction" value={filters.direction} onChange={(v) => setFilter('direction', v)} options={['BUY', 'SELL']} />
          <Select label="Type de Setup" value={filters.setupType} onChange={(v) => setFilter('setupType', v)} options={meta?.setupTypes || []} />
          <Select label="Niveau de Risque" value={filters.riskLevel} onChange={(v) => setFilter('riskLevel', v)} options={meta?.riskLevels || []} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Probabilité Min.</label>
            <select
              value={filters.minConfidence}
              onChange={(e) => setFilter('minConfidence', e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">Toutes</option>
              <option value="75">≥ 75% (Haute Probabilité)</option>
              <option value="80">≥ 80% (Setup Institutionnel)</option>
              <option value="85">≥ 85% (Prime A+)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunity Grid Board */}
      {loading ? (
        <Spinner label="Recherche des opportunités haute probabilité…" />
      ) : opportunities.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o._id} opportunity={o} onClick={setSelected} />
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center py-16 text-center">
          <Sparkles className="h-12 w-12 text-brand-400 animate-bounce" />
          <p className="mt-4 text-base font-bold text-gray-900 dark:text-white">
            Aucun setup ne correspond à vos filtres en ce moment.
          </p>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            L'Opportunity Scanner analyse les marchés en continu. Vous pouvez cliquer sur "Scanner Maintenant" ou ajuster votre stratégie.
          </p>
        </div>
      )}

      {/* Strategy & Trading Plan Modal */}
      {strategyModalOpen && (
        <Modal
          open={strategyModalOpen}
          onClose={() => setStrategyModalOpen(false)}
          title="Mon Plan de Trading & Stratégie Personnalisée"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Définissez vos règles de trading. L'Opportunity Scanner scannera les marchés en temps réel selon vos critères précis et vous enverra les meilleurs setups par email.
            </p>

            {/* Methodology selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Méthodologie de Scan Préférée :
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: 'smc', label: 'SMC (Défaut)' },
                  { id: 'ict', label: 'ICT (Killzones)' },
                  { id: 'price-action', label: 'Price Action' },
                  { id: 'custom', label: '✨ Personnalisée' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setStrategyType(m.id)}
                    className={`rounded-xl border p-2.5 text-xs font-bold transition text-center ${
                      strategyType === m.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 ring-2 ring-brand-500/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Strategy Description if 'custom' */}
            {strategyType === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Description de votre Stratégie Personnalisée :
                </label>
                <textarea
                  value={customStrategyText}
                  onChange={(e) => setCustomStrategyText(e.target.value)}
                  rows={4}
                  placeholder="Ex : Je recherche un balayage du plus haut de la veille en session de Londres, suivi d'un MSS en M15 et d'un retour sur l'Order Block extrême en zone Discount..."
                  className="w-full rounded-xl border border-gray-300 p-3 text-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            )}

            {/* Trading Plan & Execution rules */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Plan de Trading & Règles d'Exécution :
              </label>
              <textarea
                value={customTradingPlanText}
                onChange={(e) => setCustomTradingPlanText(e.target.value)}
                rows={3}
                placeholder="Ex : Risque max 1% par trade, ratio Risk/Reward minimum 1:2.5, ne trader que Forex et Or, jamais pendant les annonces NFP/CPI..."
                className="w-full rounded-xl border border-gray-300 p-3 text-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Email Dispatch Settings */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Alertes Automatiques par Email
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
                Recevez directement les opportunités détectées dans votre boîte mail dès leur apparition en temps réel.
                <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                  ⚠️ Les alertes s'arrêtent automatiquement dès que votre abonnement arrive à expiration.
                </span>
              </p>

              {emailAlertsEnabled && (
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Seuil de Probabilité pour Email :</span>
                  <select
                    value={minEmailConfidence}
                    onChange={(e) => setMinEmailConfidence(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                  >
                    <option value="75">75% et plus</option>
                    <option value="80">80% et plus (Recommandé)</option>
                    <option value="85">85% et plus (Très haute sélectivité)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
              <Button variant="ghost" onClick={() => setStrategyModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveStrategyPlan} loading={savingPlan} className="bg-brand-600 hover:bg-brand-500 text-white">
                Enregistrer & Scanner
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Opportunity Detail Modal */}
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
                {selected.confidenceScore}% de probabilité
              </Badge>
              {selected.strategyMatched && (
                <Badge tone="blue">Stratégie : {selected.strategyMatched}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Prix Entrée', selected.entry],
                ['Stop Loss', selected.stopLoss],
                ['TP1', selected.takeProfit1],
                ['TP2', selected.takeProfit2],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="mt-1 font-mono text-sm font-bold">{formatPrice(val)}</p>
                </div>
              ))}
            </div>

            {selected.rationale && (
              <div>
                <p className="text-sm font-semibold">Analyse Institutionnelle & Rationale</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {selected.rationale}
                </p>
              </div>
            )}

            {selected.confluences?.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Confluences Confirmées</p>
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
              Généré en temps réel à des fins éducatives et d'aide à la décision. Respectez toujours votre gestion du risque.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
