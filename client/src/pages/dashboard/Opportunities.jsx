import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Radar, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import OpportunityCard from '../../components/analysis/OpportunityCard.jsx';
import { opportunityApi } from '../../services/endpoints.js';
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
 * AI Opportunity Scanner board: ranked, filterable, auto-refreshing list of
 * setups detected across the market universe.
 */
export default function Opportunities() {
  const { isAdmin } = useAuth();
  const [meta, setMeta] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);

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

  // Load filter metadata once.
  useEffect(() => {
    opportunityApi
      .meta()
      .then(({ data }) => setMeta(data.data))
      .catch(() => {});
  }, []);

  // Reload when filters change, and poll on an interval.
  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await opportunityApi.scan({ market: filters.market || undefined });
      toast.success(data.message || 'Scan complete.');
      await load(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setScanning(false);
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Radar className="h-6 w-6 text-brand-500" /> Opportunity Scanner
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Auto-detected SMC setups across {meta?.universeSize ?? 'many'} markets, ranked by confidence.
            {meta?.activeTotal != null && ` ${meta.activeTotal} active now.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => load()} loading={refreshing}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {isAdmin && (
            <Button onClick={runScan} loading={scanning}>
              <Radar className="h-4 w-4" /> Scan now
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </p>
          <button onClick={clearFilters} className="text-xs text-brand-600 hover:underline">
            Clear all
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select label="Market" value={filters.market} onChange={(v) => setFilter('market', v)} options={meta?.markets || []} formatOption={marketLabel} />
          <Select label="Timeframe" value={filters.timeframe} onChange={(v) => setFilter('timeframe', v)} options={meta?.timeframes || []} />
          <Select label="Direction" value={filters.direction} onChange={(v) => setFilter('direction', v)} options={['BUY', 'SELL']} />
          <Select label="Setup" value={filters.setupType} onChange={(v) => setFilter('setupType', v)} options={meta?.setupTypes || []} />
          <Select label="Risk" value={filters.riskLevel} onChange={(v) => setFilter('riskLevel', v)} options={meta?.riskLevels || []} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Min confidence</label>
            <select
              value={filters.minConfidence}
              onChange={(e) => setFilter('minConfidence', e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">Any</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <Spinner label="Scanning markets…" />
      ) : opportunities.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o._id} opportunity={o} onClick={setSelected} />
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center py-12 text-center">
          <Sparkles className="h-10 w-10 text-brand-400" />
          <p className="mt-3 text-sm text-gray-500">
            No opportunities match your filters right now. The scanner refreshes every minute.
          </p>
        </div>
      )}

      {/* Detail modal */}
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.symbol} · ${selected.direction}` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{marketLabel(selected.market)}</Badge>
              <Badge tone="gray">{selected.timeframe}</Badge>
              <Badge tone={selected.confidenceScore >= 80 ? 'green' : 'blue'}>{selected.confidenceScore}% confidence</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Entry', selected.entry],
                ['Stop Loss', selected.stopLoss],
                ['TP1', selected.takeProfit1],
                ['TP2', selected.takeProfit2],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="mt-1 font-mono text-sm">{formatPrice(val)}</p>
                </div>
              ))}
            </div>

            {selected.rationale && (
              <div>
                <p className="text-sm font-semibold">Rationale</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{selected.rationale}</p>
              </div>
            )}

            {selected.confluences?.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Confluences</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.confluences.map((c, i) => (
                    <Badge key={i} tone="blue">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400">
              AI-generated for educational purposes only. Not financial advice.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
