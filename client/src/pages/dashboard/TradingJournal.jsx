import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { journalApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { formatPrice } from '../../utils/format.js';

export default function TradingJournal() {
  const { t, lang } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    symbol: 'EURUSD',
    market: 'forex',
    timeframe: 'H1',
    direction: 'BUY',
    status: 'open',
    entryPrice: '',
    exitPrice: '',
    stopLoss: '',
    takeProfit: '',
    lotSize: '0.1',
    pnl: '0',
    strategy: 'SMC',
    setupType: 'Order Block',
    confluences: '',
    notes: '',
    lessonsLearned: '',
    emotion: 'disciplined',
  });

  const loadJournal = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const { data } = await journalApi.list(params);
      setEntries(data.data.entries || []);
      setStats(data.data.stats || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol || !formData.entryPrice) {
      toast.error(lang === 'fr' ? 'Symbole et Prix d\'entrée obligatoires.' : 'Symbol and Entry Price are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        entryPrice: Number(formData.entryPrice),
        exitPrice: formData.exitPrice ? Number(formData.exitPrice) : null,
        stopLoss: formData.stopLoss ? Number(formData.stopLoss) : null,
        takeProfit: formData.takeProfit ? Number(formData.takeProfit) : null,
        lotSize: Number(formData.lotSize) || 0.1,
        pnl: Number(formData.pnl) || 0,
        confluences: formData.confluences
          ? formData.confluences.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };

      await journalApi.create(payload);
      toast.success(lang === 'fr' ? 'Trade consigné avec succès !' : 'Trade logged successfully!');
      setModalOpen(false);
      setFormData({
        symbol: 'EURUSD',
        market: 'forex',
        timeframe: 'H1',
        direction: 'BUY',
        status: 'open',
        entryPrice: '',
        exitPrice: '',
        stopLoss: '',
        takeProfit: '',
        lotSize: '0.1',
        pnl: '0',
        strategy: 'SMC',
        setupType: 'Order Block',
        confluences: '',
        notes: '',
        lessonsLearned: '',
        emotion: 'disciplined',
      });
      loadJournal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'fr' ? 'Supprimer cette entrée ?' : 'Delete this entry?')) return;
    try {
      await journalApi.remove(id);
      toast.success(lang === 'fr' ? 'Entrée supprimée.' : 'Entry deleted.');
      loadJournal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-gray-900 dark:text-white">
            <BookOpen className="h-7 w-7 text-brand-500" /> {t('journalTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('journalSubtitle')}
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="bg-brand-600 hover:bg-brand-500 shadow-sm">
          <Plus className="h-4 w-4" /> {t('newTrade')}
        </Button>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500">{t('totalTrades')}</p>
          <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{stats?.totalTrades || 0}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {stats?.wins || 0}W / {stats?.losses || 0}L
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500">{t('winrate')}</p>
          <p className="mt-1 text-2xl font-black text-emerald-500">{stats?.winrate || 0}%</p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${stats?.winrate || 0}%` }} />
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500">{t('netPnl')}</p>
          <p className={`mt-1 text-2xl font-black ${(stats?.totalPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {(stats?.totalPnl || 0) >= 0 ? `+${stats?.totalPnl || 0}$` : `${stats?.totalPnl || 0}$`}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">Espérance globale</p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500">{t('openTrades')}</p>
          <p className="mt-1 text-2xl font-black text-brand-500">{stats?.open || 0}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">Positions actives</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
        <Filter className="h-4 w-4 text-gray-400" />
        {['', 'open', 'win', 'loss', 'breakeven'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              filterStatus === st
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {st === '' ? t('all') : st.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      {loading ? (
        <Spinner label={t('loading')} />
      ) : entries.length ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase dark:bg-gray-800/50">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">{t('symbol')}</th>
                <th className="p-3.5">{t('direction')}</th>
                <th className="p-3.5">{t('strategy')}</th>
                <th className="p-3.5">{t('entry')}</th>
                <th className="p-3.5">SL / TP</th>
                <th className="p-3.5">{t('pnl')}</th>
                <th className="p-3.5">{t('status')}</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((trade) => {
                const isBuy = trade.direction === 'BUY';
                const isWin = trade.status === 'win';
                const isLoss = trade.status === 'loss';

                return (
                  <tr key={trade._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                    <td className="p-3.5 text-gray-500 font-mono">
                      {new Date(trade.entryDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                    </td>
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                      {trade.symbol} <span className="text-[10px] text-gray-400 font-normal">({trade.timeframe})</span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${
                          isBuy ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {trade.direction}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300 font-medium">
                      {trade.strategy} · {trade.setupType}
                    </td>
                    <td className="p-3.5 font-mono">{formatPrice(trade.entryPrice)}</td>
                    <td className="p-3.5 font-mono text-[11px] text-gray-500">
                      SL: {formatPrice(trade.stopLoss)} | TP: {formatPrice(trade.takeProfit)}
                    </td>
                    <td className="p-3.5 font-bold font-mono">
                      <span className={trade.pnl > 0 ? 'text-emerald-500' : trade.pnl < 0 ? 'text-red-500' : 'text-gray-500'}>
                        {trade.pnl > 0 ? `+${trade.pnl}$` : `${trade.pnl}$`}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isWin
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : isLoss
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : trade.status === 'open'
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDelete(trade._id)}
                        className="rounded p-1 text-gray-400 hover:text-red-500 transition"
                        title={t('delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex flex-col items-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-brand-400 animate-pulse" />
          <p className="mt-3 text-base font-bold text-gray-900 dark:text-white">
            {t('noTradesYet')}
          </p>
        </div>
      )}

      {/* New Trade Modal */}
      {modalOpen && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newTrade')}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('symbol')} *</label>
                <input
                  type="text"
                  required
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs uppercase font-mono font-bold dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Marché</label>
                <select
                  value={formData.market}
                  onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="forex">Forex</option>
                  <option value="crypto">Crypto</option>
                  <option value="indices">Indices</option>
                  <option value="commodities">Matières Premières</option>
                  <option value="synthetic">Synthétiques</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Timeframe</label>
                <select
                  value={formData.timeframe}
                  onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="H1">H1</option>
                  <option value="H4">H4</option>
                  <option value="D1">D1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('direction')}</label>
                <select
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="BUY">BUY (Achat)</option>
                  <option value="SELL">SELL (Vente)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('entry')} *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.entryPrice}
                  onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('stopLoss')}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.stopLoss}
                  onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('takeProfit')}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.takeProfit}
                  onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('lotSize')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.lotSize}
                  onChange={(e) => setFormData({ ...formData, lotSize: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="open">En cours (Open)</option>
                  <option value="win">Gagnant (Win)</option>
                  <option value="loss">Perdant (Loss)</option>
                  <option value="breakeven">Breakeven</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('pnl')}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.pnl}
                  onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('emotions')}</label>
                <select
                  value={formData.emotion}
                  onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="disciplined">Discipline de fer (Plan respecté)</option>
                  <option value="confident">Confiant</option>
                  <option value="anxious">Anxieux / Hésitant</option>
                  <option value="fomo">FOMO (Entrée précipitée)</option>
                  <option value="revenge">Revenge Trading</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t('confluences')} (séparées par des virgules)
              </label>
              <input
                type="text"
                placeholder="Ex : Sweep London High, FVG 15M, Order Block Discount, HTF Bullish"
                value={formData.confluences}
                onChange={(e) => setFormData({ ...formData, confluences: e.target.value })}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Pourquoi ce trade a-t-il été pris ? Quel était le contexte de marché ?"
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" loading={saving} className="bg-brand-600 hover:bg-brand-500 text-white">
                {t('save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
