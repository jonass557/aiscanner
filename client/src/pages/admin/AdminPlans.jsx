import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Plus, Pencil, Trash2, Power, Check, X } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { adminApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

const emptyPlan = {
  id: '',
  name: '',
  price: 0,
  currency: 'XOF',
  scansPerMonth: -1, // Illimité pour tous les plans
  features: [],
  isActive: true,
  trial: { enabled: true, days: 7 },
  promo: {
    enabled: false,
    price: 3000,
    durationMonths: 1,
    description: 'Offre promotionnelle post-essai',
  },
  order: 0,
};

/** Admin: full CRUD over subscription plans + unlimited scans + post-trial promotions. */
export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // plan object or null
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featuresText, setFeaturesText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.plans();
      setPlans(data.data.plans || []);
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
    setEditing({ ...emptyPlan });
    setFeaturesText('Scans illimités\nAnalyses graphiques haute précision\nSupport prioritaire');
    setIsNew(true);
  };

  const openEdit = (plan) => {
    setEditing({
      ...emptyPlan,
      ...plan,
      trial: { ...emptyPlan.trial, ...(plan.trial || {}) },
      promo: { ...emptyPlan.promo, ...(plan.promo || {}) },
    });
    setFeaturesText((plan.features || []).join('\n'));
    setIsNew(false);
  };

  const setField = (key, value) => setEditing((p) => ({ ...p, [key]: value }));
  const setTrial = (key, value) => setEditing((p) => ({ ...p, trial: { ...p.trial, [key]: value } }));
  const setPromo = (key, value) => setEditing((p) => ({ ...p, promo: { ...p.promo, [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editing,
        features: featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
        price: Number(editing.price),
        scansPerMonth: -1, // Tous les plans sont désormais illimités
        order: Number(editing.order),
        trial: { enabled: Boolean(editing.trial.enabled), days: Number(editing.trial.days) },
        promo: {
          enabled: Boolean(editing.promo?.enabled),
          price: Number(editing.promo?.price) || 0,
          durationMonths: Math.max(1, Number(editing.promo?.durationMonths) || 1),
          description: (editing.promo?.description || '').trim(),
        },
      };
      if (isNew) {
        await adminApi.createPlan(payload);
        toast.success('Plan créé avec succès.');
      } else {
        await adminApi.updatePlan(editing.id, payload);
        toast.success('Plan et promotions mis à jour.');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (plan) => {
    try {
      await adminApi.togglePlan(plan.id);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (plan) => {
    if (!window.confirm(`Supprimer définitivement le plan "${plan.name}" ?`)) return;
    try {
      await adminApi.deletePlan(plan.id);
      toast.success('Plan supprimé.');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const inputCls =
    'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800';
  const labelCls = 'mb-1 block text-xs font-medium text-gray-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-6 w-6 text-brand-500" /> Plans
          </h1>
          <p className="mt-1 text-sm text-gray-500">Créez, modifiez, activez/désactivez les plans et le free trial.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nouveau plan
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Prix Standard</th>
                <th className="px-4 py-3">Scans</th>
                <th className="px-4 py-3">Free trial</th>
                <th className="px-4 py-3">Promotion Post-Essai</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs text-gray-500">{plan.id}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {plan.price === 0 ? 'Gratuit' : `${plan.price} ${plan.currency}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Illimité (∞)
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {plan.trial?.enabled ? <Badge tone="blue">{plan.trial.days} jours</Badge> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {plan.promo?.enabled ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          {plan.promo.durationMonths} mois @ {plan.promo.price} {plan.currency}
                        </span>
                        {plan.promo.description && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{plan.promo.description}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Désactivée</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {plan.isActive ? <Badge tone="green">Actif</Badge> : <Badge tone="gray">Inactif</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggle(plan)} className="btn-ghost !px-2" title={plan.isActive ? 'Désactiver' : 'Activer'}>
                        <Power className={`h-4 w-4 ${plan.isActive ? 'text-green-500' : 'text-gray-400'}`} />
                      </button>
                      <button onClick={() => openEdit(plan)} className="btn-ghost !px-2" title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(plan)} className="btn-ghost !px-2" title="Supprimer">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Nouveau plan' : `Modifier ${editing?.name || ''}`} size="lg">
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Identifiant (slug)</label>
                <input
                  className={inputCls}
                  value={editing.id}
                  disabled={!isNew}
                  placeholder="pro"
                  onChange={(e) => setField('id', e.target.value.toLowerCase())}
                />
              </div>
              <div>
                <label className={labelCls}>Nom du Plan</label>
                <input className={inputCls} value={editing.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prix Standard (après promotion)</label>
                <input type="number" className={inputCls} value={editing.price} onChange={(e) => setField('price', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Devise</label>
                <select className={inputCls} value={editing.currency} onChange={(e) => setField('currency', e.target.value)}>
                  <option value="XOF">XOF (Mobile Money: Orange, MTN, Moov, Wave)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ordre d'affichage</label>
                <input type="number" className={inputCls} value={editing.order} onChange={(e) => setField('order', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Scans mensuels</label>
                <div className="flex items-center h-10 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Illimités pour tous les utilisateurs (∞)
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Fonctionnalités incluses (une par ligne)</label>
              <textarea
                className={`${inputCls} min-h-[90px]`}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder={'Scans illimités\nAnalyse SMC & Order Blocks\nAlertes temps réel'}
              />
            </div>

            {/* Free Trial configuration */}
            <div className="flex items-center gap-4 rounded-xl bg-blue-50/50 p-3.5 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input type="checkbox" checked={editing.trial.enabled} onChange={(e) => setTrial('enabled', e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500" />
                Free trial (Essai gratuit) activé
              </label>
              {editing.trial.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Durée :</span>
                  <input type="number" min="1" className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 text-center font-bold" value={editing.trial.days} onChange={(e) => setTrial('days', e.target.value)} />
                  <span className="text-xs text-gray-500">jours</span>
                </div>
              )}
            </div>

            {/* Post-Trial Promotion configuration */}
            <div className="rounded-xl bg-amber-50/50 p-4 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.promo?.enabled)}
                    onChange={(e) => setPromo('enabled', e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Activer une Promotion Post-Essai Gratuit
                </label>
                {editing.promo?.enabled && (
                  <Badge tone="yellow">Promo Active</Badge>
                )}
              </div>

              {editing.promo?.enabled && (
                <div className="space-y-3 pt-2 border-t border-amber-200/40 dark:border-amber-800/40">
                  <p className="text-xs text-amber-800 dark:text-amber-400">
                    Proposez un tarif réduit exclusif aux utilisateurs à la fin de leur essai gratuit. Une fois la durée promotionnelle écoulée, le plan reprend son prix normal.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-amber-900 dark:text-amber-300">
                        Prix en Promotion ({editing.currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={editing.promo.price}
                        placeholder="3000"
                        onChange={(e) => setPromo('price', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-amber-900 dark:text-amber-300">
                        Durée de la Promotion (mois)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className={inputCls}
                        value={editing.promo.durationMonths}
                        placeholder="1 ou 2 mois"
                        onChange={(e) => setPromo('durationMonths', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-amber-900 dark:text-amber-300">
                      Description affichée à l'utilisateur
                    </label>
                    <input
                      className={inputCls}
                      value={editing.promo.description || ''}
                      placeholder="Offre exclusive : 3 000 FCFA pour votre premier mois !"
                      onChange={(e) => setPromo('description', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setField('isActive', e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500" />
              <span className="font-medium text-slate-800 dark:text-slate-200">Plan actif et visible par les utilisateurs</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" /> Annuler
              </Button>
              <Button onClick={save} loading={saving} disabled={!editing.id || !editing.name}>
                <Check className="h-4 w-4" /> {isNew ? 'Créer le Plan' : 'Enregistrer les Modifications'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
