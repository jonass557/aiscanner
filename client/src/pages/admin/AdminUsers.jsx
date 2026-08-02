import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import { adminApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { formatDate } from '../../utils/format.js';

/** Admin user management: list, search, edit (plan/role/credits), delete. */
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
      setUsers(data.data.users);
      setMeta(data.meta);
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
    setForm({ plan: u.subscription?.plan, role: u.role, isVerified: u.isVerified, addCredits: 0 });
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateUser(editing._id, {
        plan: form.plan,
        role: form.role,
        isVerified: form.isVerified,
        addCredits: Number(form.addCredits) || 0,
      });
      toast.success('User updated.');
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
      toast.success('User deleted.');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-gray-500">{meta.total} registered users.</p>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading users…" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Scans</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.firstName ? `${u.firstName} ${u.lastName || ''}` : '—'}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-5 py-3"><Badge tone="purple">{u.subscription?.plan}</Badge></td>
                    <td className="px-5 py-3">
                      {u.role === 'admin' ? <Badge tone="red">admin</Badge> : <span className="text-gray-500">user</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{u.subscription?.scansUsed || 0}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-700" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setToDelete(u)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <span className="text-xs text-gray-500">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.email || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Plan</label>
            <select className="input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Input
            label="Add scan credits"
            type="number"
            min="0"
            value={form.addCredits}
            onChange={(e) => setForm({ ...form, addCredits: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} />
            Email verified
          </label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete user?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This permanently deletes <strong>{toDelete?.email}</strong> and all their analyses. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
