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
  scansPerMonth: 5,
  features: [],
  isActive: true,
  trial: { enabled: false, days: 7 },
  order: 0,
};

/** Admin: full CRUD over subscription plans + enable/disable + free trial. */
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
    setFeaturesText('');
    setIsNew(true);
  };

  const openEdit = (plan) => {
    setEditing({ ...emptyPlan, ...plan, trial: { ...emptyPlan.trial, ...(plan.trial || {}) } });
    setFeaturesText((plan.features || []).join('\n'));
    setIsNew(false);
  };

  const setField = (key, value) => setEditing((p) => ({ ...p, [key]: value }));
  const setTrial = (key, value) => setEditing((p) => ({ ...p, trial: { ...p.trial, [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editing,
        features: featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
        price: Number(editing.price),
        scansPerMonth: Number(editing.scansPerMonth),
        order: Number(editing.order),
        trial: { enabled: editing.trial.enabled, days: Number(editing.trial.days) },
      };
      if (isNew) {
        await adminApi.createPlan(payload);
        toast.success('Plan créé.');
      } else {
        await adminApi.updatePlan(editing.id, payload);
        toast.success('Plan mis à jour.');
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
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Scans/mois</th>
                <th className="px-4 py-3">Free trial</th>
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
                  <td className="px-4 py-3">
                    {plan.price === 0 ? 'Gratuit' : `${plan.price} ${plan.currency}`}
                  </td>
                  <td className="px-4 py-3">{plan.scansPerMonth === -1 ? '∞' : plan.scansPerMonth}</td>
                  <td className="px-4 py-3">
                    {plan.trial?.enabled ? <Badge tone="blue">{plan.trial.days} j</Badge> : <span className="text-gray-400">—</span>}
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Nouveau plan' : `Modifier ${editing?.name || ''}`}>
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
                <label className={labelCls}>Nom</label>
                <input className={inputCls} value={editing.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prix</label>
                <input type="number" className={inputCls} value={editing.price} onChange={(e) => setField('price', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Devise</label>
                <select className={inputCls} value={editing.currency} onChange={(e) => setField('currency', e.target.value)}>
                  <option value="XOF">XOF (Mobile Money)</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Scans / mois (-1 = illimité)</label>
                <input type="number" className={inputCls} value={editing.scansPerMonth} onChange={(e) => setField('scansPerMonth', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ordre d'affichage</label>
                <input type="number" className={inputCls} value={editing.order} onChange={(e) => setField('order', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Fonctionnalités (une par ligne)</label>
              <textarea
                className={`${inputCls} min-h-[90px]`}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder={'100 scans par mois\nAnalyse SMC avancée\nSupport prioritaire'}
              />
            </div>

            <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.trial.enabled} onChange={(e) => setTrial('enabled', e.target.checked)} />
                Free trial activé
              </label>
              {editing.trial.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Durée :</span>
                  <input type="number" className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" value={editing.trial.days} onChange={(e) => setTrial('days', e.target.value)} />
                  <span className="text-sm text-gray-500">jours</span>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
              Plan actif (visible par les utilisateurs)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" /> Annuler
              </Button>
              <Button onClick={save} loading={saving} disabled={!editing.id || !editing.name}>
                <Check className="h-4 w-4" /> {isNew ? 'Créer' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
