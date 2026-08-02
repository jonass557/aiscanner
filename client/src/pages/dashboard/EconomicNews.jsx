import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, SlidersHorizontal, Sparkles, TrendingUp, Clock } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import NewsBanner from '../../components/news/NewsBanner.jsx';
import { economicNewsApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

const IMPACT_TONE = { high: 'red', medium: 'yellow', low: 'gray', holiday: 'blue' };
const IMPACT_LABEL = { high: 'Fort', medium: 'Moyen', low: 'Faible', holiday: 'Férié' };

const CURRENCIES = ['', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY'];

const emptyFilters = { impact: '', currency: '' };

const dayKey = (dt) =>
  new Date(dt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const timeLabel = (dt) =>
  new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Economic calendar: filterable, grouped-by-day list of events with an
 * AI impact analysis modal. Reuses NewsBanner for imminent high-impact alerts.
 */
export default function EconomicNews() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await economicNewsApi.list(params);
      setEvents(data.data.events || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Open detail modal, fetching the AI-enriched version.
  const openDetail = async (event) => {
    setSelected(event);
    setDetail(event);
    setLoadingDetail(true);
    try {
      const { data } = await economicNewsApi.get(event._id);
      setDetail(data.data.event);
    } catch {
      /* keep the list version */
    } finally {
      setLoadingDetail(false);
    }
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  // Group events by calendar day for a readable timeline.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = dayKey(ev.dateTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarClock className="h-6 w-6 text-brand-500" />
          Economic News
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Calendrier économique avec analyse d'impact IA sur les marchés.
        </p>
      </div>

      <NewsBanner withinHours={24} />

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <SlidersHorizontal className="h-4 w-4" /> Filtres
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Impact</label>
          <select
            value={filters.impact}
            onChange={(e) => setFilter('impact', e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">Tous</option>
            <option value="high">Fort</option>
            <option value="medium">Moyen</option>
            <option value="low">Faible</option>
            <option value="holiday">Férié</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Devise</label>
          <select
            value={filters.currency}
            onChange={(e) => setFilter('currency', e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c || 'Toutes'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : grouped.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          Aucun événement pour cette période et ces filtres.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-gray-500">{day}</h2>
              <div className="card divide-y divide-gray-100 overflow-hidden p-0 dark:divide-gray-800">
                {dayEvents.map((ev) => (
                  <button
                    key={ev._id}
                    onClick={() => openDetail(ev)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex w-14 shrink-0 items-center gap-1 text-sm font-medium text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {timeLabel(ev.dateTime)}
                    </div>
                    {ev.currency && <Badge tone="blue">{ev.currency}</Badge>}
                    <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
                    <div className="hidden items-center gap-4 text-xs text-gray-500 sm:flex">
                      {ev.forecast && <span>Prév. {ev.forecast}</span>}
                      {ev.previous && <span>Préc. {ev.previous}</span>}
                    </div>
                    <Badge tone={IMPACT_TONE[ev.impact]}>{IMPACT_LABEL[ev.impact]}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={detail?.title || ''}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {detail.currency && <Badge tone="blue">{detail.currency}</Badge>}
              <Badge tone={IMPACT_TONE[detail.impact]}>Impact {IMPACT_LABEL[detail.impact]}</Badge>
              <span className="text-gray-500">
                {new Date(detail.dateTime).toLocaleString('fr-FR')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ['Précédent', detail.previous],
                ['Prévision', detail.forecast],
                ['Réel', detail.actual],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800/50">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="mt-1 font-semibold">{value || '—'}</div>
                </div>
              ))}
            </div>

            {detail.affectedMarkets?.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">Marchés affectés</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.affectedMarkets.map((m) => (
                    <Badge key={m} tone="gray">{m}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
              <div className="mb-2 flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-300">
                <Sparkles className="h-4 w-4" /> Analyse IA
              </div>
              {loadingDetail && !detail.aiAnalysis?.summary ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Spinner /> Analyse en cours…
                </div>
              ) : detail.aiAnalysis?.summary ? (
                <div className="space-y-2">
                  <p>{detail.aiAnalysis.summary}</p>
                  {detail.aiAnalysis.expectedImpact && (
                    <p className="flex items-start gap-2">
                      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span>{detail.aiAnalysis.expectedImpact}</span>
                    </p>
                  )}
                  {detail.aiAnalysis.volatilityRisk && (
                    <p>
                      Risque de volatilité :{' '}
                      <Badge tone={IMPACT_TONE[detail.aiAnalysis.volatilityRisk] || 'gray'}>
                        {IMPACT_LABEL[detail.aiAnalysis.volatilityRisk] || detail.aiAnalysis.volatilityRisk}
                      </Badge>
                    </p>
                  )}
                  {detail.aiAnalysis.tradingAdvice && (
                    <p className="text-gray-600 dark:text-gray-400">{detail.aiAnalysis.tradingAdvice}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Analyse indisponible pour cet événement.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
