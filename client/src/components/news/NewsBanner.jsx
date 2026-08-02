import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { economicNewsApi } from '../../services/endpoints.js';

const timeUntil = (dt) => {
  const ms = new Date(dt) - new Date();
  if (ms <= 0) return 'maintenant';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 1 ? `dans ${h}h${m ? ` ${m}m` : ''}` : `dans ${m}m`;
};

/**
 * Dismissible banner warning of imminent high-impact economic events.
 * Reused on Scanner, Multi-Timeframe, and the news page. Silent when nothing
 * is upcoming or the request fails.
 */
export default function NewsBanner({ withinHours = 12 }) {
  const [events, setEvents] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    economicNewsApi
      .upcoming(withinHours)
      .then(({ data }) => setEvents(data.data.events || []))
      .catch(() => {});
  }, [withinHours]);

  if (dismissed || events.length === 0) return null;

  const next = events[0];

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            {events.length} annonce{events.length > 1 ? 's' : ''} à fort impact à venir
          </span>
          <span className="ml-1 text-amber-700/80 dark:text-amber-400/80">
            — {next.title} ({next.currency}) {timeUntil(next.dateTime)}. Prudence avant l'événement.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/dashboard/economic-news" className="hidden items-center gap-1 text-sm font-medium text-amber-700 hover:underline sm:flex dark:text-amber-300">
          Voir <ArrowRight className="h-4 w-4" />
        </Link>
        <button onClick={() => setDismissed(true)} className="rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40" aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
