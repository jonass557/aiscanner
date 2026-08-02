import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { adminApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

const CATEGORIES = ['auth', 'ai', 'admin', 'system', 'subscription', 'scan'];
const LEVELS = ['info', 'warn', 'error'];
const LEVEL_TONE = { info: 'blue', warn: 'yellow', error: 'red' };

/** System log viewer with category/level filters. */
export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', level: '' });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (filters.category) params.category = filters.category;
      if (filters.level) params.level = filters.level;
      const { data } = await adminApi.logs(params);
      setLogs(data.data.logs);
      setMeta(data.meta);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Logs</h1>
        <p className="mt-1 text-sm text-gray-500">Auth, AI, scan, and admin activity (auto-expires after 90 days).</p>
      </div>

      <div className="card flex flex-wrap gap-3 p-4">
        <select className="input w-auto" value={filters.category} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, category: e.target.value })); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={filters.level} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, level: e.target.value })); }}>
          <option value="">All levels</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading logs…" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Level</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3"><Badge tone={LEVEL_TONE[log.level]}>{log.level}</Badge></td>
                    <td className="px-5 py-3 text-gray-500">{log.category}</td>
                    <td className="px-5 py-3 font-medium">{log.action}</td>
                    <td className="px-5 py-3 max-w-xs truncate text-gray-500" title={log.message}>{log.message || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{log.userId?.email || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-500">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No logs found.</td></tr>
                )}
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
    </div>
  );
}
