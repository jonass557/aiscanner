import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, Plus, Edit2, Trash2, Star, CheckCircle,
  XCircle, Globe, RefreshCw, AlertCircle
} from 'lucide-react';
import { reviewApi } from '../../services/endpoints.js';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    role: 'Trader Indépendant',
    rating: 5,
    country: 'FR',
    comment: '',
    active: true,
    order: 0,
  });

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await reviewApi.getAdmin();
      setReviews(data?.data?.reviews || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur chargement des avis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const openCreateModal = () => {
    setEditingReview(null);
    setForm({
      name: '',
      role: 'Trader Indépendant',
      rating: 5,
      country: 'FR',
      comment: '',
      active: true,
      order: reviews.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (rev) => {
    setEditingReview(rev);
    setForm({
      name: rev.name || '',
      role: rev.role || 'Trader Indépendant',
      rating: rev.rating || 5,
      country: rev.country || 'FR',
      comment: rev.comment || '',
      active: rev.active !== undefined ? rev.active : true,
      order: rev.order || 0,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.comment) {
      alert('Veuillez renseigner le nom et le commentaire.');
      return;
    }
    try {
      setSaving(true);
      if (editingReview) {
        await reviewApi.update(editingReview._id, form);
      } else {
        await reviewApi.create(form);
      }
      setModalOpen(false);
      fetchReviews();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Confirmez-vous la suppression de cet avis ?')) return;
    try {
      await reviewApi.delete(id);
      fetchReviews();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleToggleActive = async (rev) => {
    try {
      await reviewApi.update(rev._id, { active: !rev.active });
      fetchReviews();
    } catch (err) {
      alert('Erreur modification statut');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-cyan-400" />
            Gestion des Avis Clients (Carrousel)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gérez les avis affichés dans le carrousel de la page d’accueil. Vous pouvez ajouter, modifier ou désactiver un avis en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchReviews} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
          <Button variant="primary" onClick={openCreateModal} className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white">
            <Plus className="h-4 w-4" />
            Nouvel Avis
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Reviews Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Auteur / Profil</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Commentaire</th>
                <th className="px-4 py-3">Pays</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reviews.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Aucun avis enregistré pour le moment.
                  </td>
                </tr>
              )}
              {reviews.map((rev) => (
                <tr key={rev._id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-white text-sm">{rev.name}</div>
                    <div className="text-[11px] text-cyan-400">{rev.role}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 max-w-md">
                    <p className="line-clamp-2 text-slate-300 italic">“{rev.comment}”</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                      <Globe className="h-3 w-3 text-slate-400" /> {rev.country || 'FR'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleActive(rev)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                        rev.active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {rev.active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {rev.active ? 'Visible' : 'Masqué'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(rev)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rev._id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Review Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingReview ? 'Modifier l’Avis Client' : 'Ajouter un Nouvel Avis Client'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nom du client *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Alexandre M."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rôle / Spécialité</label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Ex: Trader Prop Firm FTMO"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Note (1 à 5)</label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                <option value={3}>⭐⭐⭐ (3/5)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Code Pays (Drapeau)</label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                placeholder="Ex: FR, CI, SN, CM, BE, CA"
                maxLength={4}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ordre d’affichage</label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Témoignage du client *</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              rows={4}
              placeholder="Texte de l'avis client..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white focus:border-cyan-500"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="revActive"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500"
            />
            <label htmlFor="revActive" className="text-xs text-slate-300 cursor-pointer">
              Afficher cet avis sur la page d’accueil (Actif)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={saving} className="bg-cyan-600 hover:bg-cyan-500">
              {saving ? 'Enregistrement…' : editingReview ? 'Mettre à jour' : 'Ajouter l’avis'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
