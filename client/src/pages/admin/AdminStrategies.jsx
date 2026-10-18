import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Target,
  Sliders,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Search,
  Activity,
  Layers,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { strategyApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

const emptyStrategy = {
  name: '',
  key: '',
  category: 'smc',
  description: '',
  rules: [],
  supplyDemandType: 'order_block_fvg',
  liquidityRules: 'bsl_ssl',
  targetRiskReward: 3.0,
  winRateEstimate: 85,
  isActive: true,
};

const CATEGORIES = [
  { value: 'smc', label: 'Smart Money Concepts (SMC)' },
  { value: 'support_resistance', label: 'Support & Résistance Institutionnel' },
  { value: 'ict', label: 'ICT Precision (Killzones & MSS)' },
  { value: 'trend', label: 'Trend Momentum & Suivi de Tendance' },
  { value: 'custom', label: 'Stratégie Personnalisée / Mixte' },
];

const SD_TYPES = [
  { value: 'order_block_fvg', label: 'Order Blocks (OB) & Fair Value Gaps (FVG)' },
  { value: 'support_resistance', label: 'Barrières Horizontales & Zones de Rejet' },
  { value: 'fvg_only', label: 'Fair Value Gaps purs' },
  { value: 'dynamic_ema', label: 'Moyennes Mobiles & Bandes Dynamiques' },
];

const LIQ_RULES = [
  { value: 'bsl_ssl', label: 'BSL / SSL Sweeps (Prises de liquidités)' },
  { value: 'swing_high_low', label: 'Sommets et Creux majeurs (Swing High/Low)' },
  { value: 'equal_highs_lows', label: 'Equal Highs & Equal Lows (Liquidité d\'ingénierie)' },
  { value: 'session_liquidity', label: 'Pivots de session (High/Low Londres & NY)' },
];

export default function AdminStrategies() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rulesText, setRulesText] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await strategyApi.adminList();
      setStrategies(data.data.strategies || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing({ ...emptyStrategy });
    setRulesText(
      'Validation de la tendance institutionnelle\nZone d\'intérêt Supply/Demand non mitigée\nPrise de liquidité préalable\nSignal de confirmation bougie de rejet\nRatio Risque/Rendement minimum 1:2.5'
    );
    setIsNew(true);
  };

  const openEdit = (strat) => {
    setEditing({ ...emptyStrategy, ...strat });
    setRulesText((strat.rules || []).join('\n'));
    setIsNew(false);
  };

  const setField = (key, value) => {
    setEditing((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && isNew && (!prev.key || prev.key === prev.name?.toLowerCase().replace(/[^a-z0-9]/g, '_'))) {
        next.key = value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      }
      return next;
    });
  };

  const save = async () => {
    if (!editing.name?.trim()) {
      toast.error('Le nom de la stratégie est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      const parsedRules = rulesText.split('\n').map((r) => r.trim()).filter(Boolean);
      const payload = {
        ...editing,
        rules: parsedRules,
        targetRiskReward: Number(editing.targetRiskReward) || 3.0,
        winRateEstimate: Number(editing.winRateEstimate) || 85,
      };

      if (isNew) {
        await strategyApi.create(payload);
        toast.success('Nouvelle stratégie créée et intégrée au moteur !');
      } else {
        await strategyApi.update(editing._id, payload);
        toast.success('Stratégie mise à jour avec succès.');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (strat) => {
    try {
      await strategyApi.update(strat._id, { isActive: !strat.isActive });
      toast.success(`Stratégie ${strat.isActive ? 'désactivée' : 'activée'}.`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (strat) => {
    const promptMsg = strat.isSystem
      ? `La stratégie "${strat.name}" est une stratégie système. Elle sera désactivée. Continuer ?`
      : `Voulez-vous supprimer définitivement la stratégie "${strat.name}" ?`;

    if (!window.confirm(promptMsg)) return;

    try {
      await strategyApi.remove(strat._id);
      toast.success(strat.isSystem ? 'Stratégie désactivée.' : 'Stratégie supprimée.');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filteredStrategies = strategies.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.key?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Stratégies de Trading & Perception Graphique
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gérez les stratégies appliquées dans Chart Vision, le Robot et le Backtesting.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle Stratégie
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Stratégies</span>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{strategies.length}</p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Actives dans l'App</span>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {strategies.filter((s) => s.isActive).length}
          </p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Système (Core)</span>
          <p className="mt-1 text-2xl font-bold text-brand-500">
            {strategies.filter((s) => s.isSystem).length}
          </p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Admin Custom</span>
          <p className="mt-1 text-2xl font-bold text-amber-500">
            {strategies.filter((s) => !s.isSystem).length}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, clé (smc, support_resistance...), règles..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Strategy Grid */}
      {loading ? (
        <div className="card flex items-center justify-center p-12">
          <Spinner />
        </div>
      ) : filteredStrategies.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          Aucune stratégie trouvée. Cliquez sur "Nouvelle Stratégie" pour en créer une.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredStrategies.map((strat) => (
            <div
              key={strat._id || strat.key}
              className={`card flex flex-col justify-between p-5 border transition ${
                strat.isActive
                  ? 'border-gray-200 dark:border-gray-800'
                  : 'border-dashed border-gray-300 dark:border-gray-800/60 opacity-65'
              }`}
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {strat.name}
                      </h2>
                      {strat.isSystem ? (
                        <Badge variant="brand" size="xs">Système</Badge>
                      ) : (
                        <Badge variant="accent" size="xs">Custom Admin</Badge>
                      )}
                      {!strat.isActive && (
                        <Badge variant="error" size="xs">Inactif</Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">key: {strat.key}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleActive(strat)}
                      className={`p-1.5 rounded-lg border text-xs font-medium transition ${
                        strat.isActive
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-gray-600 bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                      title={strat.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {strat.isActive ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(strat)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-brand-500"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(strat)}
                      className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                  {strat.description || 'Aucune description spécifiée.'}
                </p>

                {/* Logic Pills */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-gray-100 dark:bg-gray-800/80 px-2 py-1 text-gray-600 dark:text-gray-300 font-mono">
                    Zones: {strat.supplyDemandType}
                  </span>
                  <span className="rounded-lg bg-gray-100 dark:bg-gray-800/80 px-2 py-1 text-gray-600 dark:text-gray-300 font-mono">
                    Liq: {strat.liquidityRules}
                  </span>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-400">
                    R:R Cible 1:{strat.targetRiskReward || '3.0'}
                  </span>
                  <span className="rounded-lg bg-brand-500/10 px-2 py-1 font-semibold text-brand-400">
                    Taux {strat.winRateEstimate || '85'}%
                  </span>
                </div>

                {/* Rules preview */}
                {strat.rules && strat.rules.length > 0 && (
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 border border-gray-200 dark:border-gray-800">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Règles de détection ({strat.rules.length}) :
                    </span>
                    <ul className="mt-1 space-y-1">
                      {strat.rules.slice(0, 3).map((r, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">{r}</span>
                        </li>
                      ))}
                      {strat.rules.length > 3 && (
                        <li className="text-[11px] text-gray-400 font-medium pl-5">
                          + {strat.rules.length - 3} règle(s) supplémentaire(s)...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Bottom footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span>Catégorie : <strong className="text-gray-700 dark:text-gray-200">{strat.category}</strong></span>
                <span>{strat.isSystem ? 'Moteur standard' : 'Moteur personnalisé'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {editing && (
        <Modal
          isOpen={true}
          onClose={() => setEditing(null)}
          title={isNew ? 'Créer une nouvelle Stratégie' : `Modifier "${editing.name}"`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1 pr-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Nom de la Stratégie *
              </label>
              <input
                type="text"
                value={editing.name || ''}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="ex: Wyckoff Institutional Accumulation"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Clé Technique (slug unique) *
                </label>
                <input
                  type="text"
                  value={editing.key || ''}
                  onChange={(e) => setField('key', e.target.value)}
                  placeholder="ex: wyckoff_acc"
                  disabled={!isNew && editing.isSystem}
                  className="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Catégorie d'Analyse
                </label>
                <select
                  value={editing.category || 'smc'}
                  onChange={(e) => setField('category', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Modèle Supply / Demand & Zones
                </label>
                <select
                  value={editing.supplyDemandType || 'order_block_fvg'}
                  onChange={(e) => setField('supplyDemandType', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                >
                  {SD_TYPES.map((sd) => (
                    <option key={sd.value} value={sd.value}>{sd.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Détection des Liquidités
                </label>
                <select
                  value={editing.liquidityRules || 'bsl_ssl'}
                  onChange={(e) => setField('liquidityRules', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                >
                  {LIQ_RULES.map((liq) => (
                    <option key={liq.value} value={liq.value}>{liq.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Ratio Risque / Rendement Cible (1:X)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={editing.targetRiskReward || 3.0}
                  onChange={(e) => setField('targetRiskReward', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Taux de Réussite Estimé (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="99"
                  value={editing.winRateEstimate || 85}
                  onChange={(e) => setField('winRateEstimate', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Description générale
              </label>
              <textarea
                rows={2}
                value={editing.description || ''}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Explication concise du modèle pour les traders..."
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Règles de Trading & Confluences (une règle par ligne)
              </label>
              <textarea
                rows={4}
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                placeholder="Règle 1 : Cassure de structure institutionnelle (BOS)&#10;Règle 2 : Zone de liquidité balayée..."
                className="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stratégie active et visible immédiatement par les utilisateurs
                </span>
              </label>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Enregistrement...' : 'Enregistrer la Stratégie'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
