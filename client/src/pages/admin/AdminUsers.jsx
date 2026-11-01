import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Calendar,
  AlertTriangle,
  UserCheck,
  Smartphone,
  Globe,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import { adminApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { formatDate } from '../../utils/format.js';

/** Admin user management: list, search, custom trial days, subscription dates, anti-abuse audit. */
export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.users({ page, limit: 15, search: search || undefined });
      setUsers(data.data.users || []);
      setMeta(data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openEdit = (u) => {
    setEditing(u);
    const now = Date.now();
    const trialEndMs = u.trial?.endsAt ? new Date(u.trial.endsAt).getTime() : 0;
    const remainingDays = trialEndMs > now ? Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)) : (u.trial?.days || 0);

    setForm({
      plan: u.subscription?.plan || 'pro',
      status: u.subscription?.status || 'active',
      role: u.role || 'user',
      isVerified: Boolean(u.isVerified),
      trialDays: remainingDays,
      extendDays: 0,
    });
  };

  const handleAddTrialDays = (days) => {
    setForm((prev) => ({
      ...prev,
      trialDays: Math.max(0, Number(prev.trialDays || 0) + days),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateUser(editing._id, {
        plan: form.plan,
        status: form.status,
        role: form.role,
        isVerified: form.isVerified,
        trialDays: Number(form.trialDays),
      });
      toast.success('Utilisateur et jours d\'essai mis à jour avec succès.');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await adminApi.deleteUser(toDelete._id);
      toast.success('Utilisateur supprimé.');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // KPI calculations
  const now = Date.now();
  const activeCount = users.filter((u) => u.subscription?.status === 'active').length;
  const inTrialCount = users.filter(
    (u) => u.trial?.isActive && u.trial?.endsAt && new Date(u.trial.endsAt).getTime() > now
  ).length;
  const expiredCount = users.filter(
    (u) => u.subscription?.status === 'expired' || (u.trial?.endsAt && new Date(u.trial.endsAt).getTime() <= now && u.subscription?.status !== 'active')
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Gestion des Utilisateurs & Abonnements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {meta.total} utilisateurs inscrits. Supervisez les dates de fin d'abonnement et ajustez les jours d'essai gratuit individuellement.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Utilisateurs</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{meta.total}</p>
        </div>
        <div className="card p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Abonnés Actifs</span>
          <p className="mt-1 text-2xl font-black text-emerald-500">{activeCount}</p>
        </div>
        <div className="card p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">En Essai Gratuit</span>
          <p className="mt-1 text-2xl font-black text-brand-500">{inTrialCount}</p>
        </div>
        <div className="card p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Essai / Abonnement Expiré</span>
          <p className="mt-1 text-2xl font-black text-amber-500">{expiredCount}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-3 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            placeholder="Rechercher par email, prénom, nom..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner label="Chargement des utilisateurs..." /></div>
      ) : (
        <div className="card overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 text-left uppercase text-slate-400 dark:border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Utilisateur</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Début Abonnement</th>
                  <th className="px-4 py-3 font-semibold">Expiration Abonnement</th>
                  <th className="px-4 py-3 font-semibold">Essai Gratuit</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((u) => {
                  const trialEndMs = u.trial?.endsAt ? new Date(u.trial.endsAt).getTime() : 0;
                  const isTrialActive = Boolean(u.trial?.isActive && trialEndMs > now);
                  const remainingDays = trialEndMs > now ? Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)) : 0;

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {u.firstName ? `${u.firstName} ${u.lastName || ''}` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                        {u.registrationIp && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Globe className="h-3 w-3" /> {u.registrationIp}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                          {u.subscription?.plan || 'pro'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {u.subscription?.status === 'active' ? (
                          <Badge tone="green">Actif</Badge>
                        ) : u.subscription?.status === 'expired' ? (
                          <Badge tone="red">Expiré</Badge>
                        ) : (
                          <Badge tone="gray">{u.subscription?.status || 'Inactif'}</Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {u.subscription?.startDate ? formatDate(u.subscription.startDate) : formatDate(u.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {u.subscription?.endDate ? (
                          formatDate(u.subscription.endDate)
                        ) : u.trial?.endsAt ? (
                          formatDate(u.trial.endsAt)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isTrialActive ? (
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span className="font-bold text-cyan-600 dark:text-cyan-400">
                              {remainingDays} {remainingDays === 1 ? 'jour restant' : 'jours restants'}
                            </span>
                          </div>
                        ) : u.trial?.isUsed ? (
                          <span className="text-slate-400 text-[11px]">Terminé ({u.trial.days}j)</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Non démarré</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-500"
                            title="Modifier les jours d'essai et l'abonnement"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(u)}
                            className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            title="Supprimer l'utilisateur"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-400">Page {meta.page} sur {meta.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Gestion Utilisateur & Essai : ${editing?.email || ''}`}
        size="lg"
      >
        {editing && (
          <div className="space-y-4">
            {/* Free Trial Control (Individual Days modification) */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                    Jours d'Essai Gratuit Individuel
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-500">
                  {form.trialDays} jours configurés
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Vous pouvez ajuster ou prolonger le nombre exact de jours d'essai gratuit pour cet utilisateur. Cela repousse automatiquement la date d'expiration.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de jours d'essai actif :
                </label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 font-bold"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}
                />
              </div>

              {/* Quick Increase Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Prolongation rapide :
                </span>
                <div className="flex flex-wrap gap-2">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleAddTrialDays(days)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition flex items-center gap-1"
                    >
                      <PlusCircle className="h-3 w-3" /> +{days} jours
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, trialDays: 0 })}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition"
                  >
                    Mettre fin à l'essai (0j)
                  </button>
                </div>
              </div>
            </div>

            {/* Plan and Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Plan Assigné</label>
                <select
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500"
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Statut Abonnement</label>
                <select
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Actif</option>
                  <option value="expired">Expiré</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Rôle Système</label>
                <select
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="user">Utilisateur standard</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isVerified}
                    onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Email vérifié par OTP</span>
                </label>
              </div>
            </div>

            {/* Anti-Abuse Audit info */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
              <span className="font-semibold uppercase tracking-wider block text-slate-400">Empreinte & Sécurité Anti-Abus :</span>
              <p>IP Inscription : <strong className="font-mono text-slate-700 dark:text-slate-200">{editing.registrationIp || 'Non tracée'}</strong></p>
              <p>Empreinte Appareil : <strong className="font-mono text-slate-700 dark:text-slate-200 truncate inline-block max-w-[300px] align-bottom">{editing.deviceFingerprint || 'Standard'}</strong></p>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button onClick={save} loading={saving}>
                Enregistrer les Modifications
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer cet utilisateur ?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Annuler</Button>
            <Button variant="danger" onClick={confirmDelete}>Supprimer définitivement</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Êtes-vous sûr de vouloir supprimer le compte <strong>{toDelete?.email}</strong> ? Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}
