import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Download, Trash2, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { analysisApi, downloadBlob } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { decisionMeta, formatDateTime, marketLabel } from '../../utils/format.js';

const MARKETS = ['forex', 'crypto', 'indices', 'commodities', 'synthetic'];
const DECISIONS = ['BUY', 'SELL', 'WAIT'];

/** Paginated, filterable, searchable analysis history with exports. */
export default function History() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ symbol: '', market: '', decision: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12, ...filters };
      Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
      const { data } = await analysisApi.list(params);
      setItems(data.data.analyses);
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

  const applyFilter = (patch) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await analysisApi.remove(toDelete._id);
      toast.success('Analysis deleted.');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
      const { data } = await analysisApi.exportCsv(params);
      downloadBlob(data, 'chart-analyses.csv');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="mt-1 text-sm text-gray-500">{meta.total} total analyses.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search symbol (e.g. EURUSD)…"
              value={filters.symbol}
              onChange={(e) => applyFilter({ symbol: e.target.value })}
            />
          </div>
          <select className="input w-auto" value={filters.market} onChange={(e) => applyFilter({ market: e.target.value })}>
            <option value="">All markets</option>
            {MARKETS.map((m) => <option key={m} value={m}>{marketLabel(m)}</option>)}
          </select>
          <select className="input w-auto" value={filters.decision} onChange={(e) => applyFilter({ decision: e.target.value })}>
            <option value="">All decisions</option>
            {DECISIONS.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
          </select>
          <select
            className="input w-auto"
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(':');
              applyFilter({ sortBy, sortOrder });
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="confidenceScore:desc">Highest confidence</option>
            <option value="confidenceScore:asc">Lowest confidence</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Spinner label="Loading history…" />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <Filter className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-500">No analyses match your filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Symbol</th>
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-5 py-3 font-medium">Decision</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((a) => {
                  const dm = decisionMeta(a.decision);
                  return (
                    <tr key={a._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-5 py-3 font-medium">
                        {a.symbol}
                        <span className="ml-2 text-xs text-gray-400">{a.timeframe}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{marketLabel(a.market)}</td>
                      <td className="px-5 py-3"><Badge tone={dm.tone}>{dm.label}</Badge></td>
                      <td className="px-5 py-3">{a.confidenceScore}%</td>
                      <td className="px-5 py-3 text-gray-500">{formatDateTime(a.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to={`/dashboard/history/${a._id}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-700" title="View">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button onClick={() => setToDelete(a)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <span className="text-xs text-gray-500">Page {meta.page} of {meta.totalPages}</span>
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

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete analysis?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This will permanently delete the analysis for <strong>{toDelete?.symbol}</strong>. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
