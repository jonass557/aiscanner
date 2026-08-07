import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { analysisApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

/**
 * 👍/👎 quality feedback on an analysis (Engine 5 — continuous improvement).
 *
 * Ratings feed the admin per-provider quality metrics (A/B base). Clicking the
 * active rating again clears it. Only rendered for persisted analyses (those
 * with an id); a just-run scan not yet in history has nothing to rate.
 */
export default function FeedbackButtons({ analysisId, initialRating = null }) {
  const [rating, setRating] = useState(initialRating);
  const [saving, setSaving] = useState(false);

  if (!analysisId) return null;

  const submit = async (value) => {
    const next = rating === value ? null : value; // toggle off if same
    setSaving(true);
    setRating(next);
    try {
      await analysisApi.feedback(analysisId, { rating: next });
    } catch (err) {
      setRating(rating); // revert on failure
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500">Cette analyse était-elle utile ?</span>
      <button
        type="button"
        disabled={saving}
        onClick={() => submit('up')}
        aria-pressed={rating === 'up'}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 transition disabled:opacity-50 ${
          rating === 'up'
            ? 'border-green-500 bg-green-50 text-green-600 dark:bg-green-900/30'
            : 'border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 dark:border-gray-700'
        }`}
      >
        <ThumbsUp className="h-4 w-4" /> Oui
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => submit('down')}
        aria-pressed={rating === 'down'}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 transition disabled:opacity-50 ${
          rating === 'down'
            ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/30'
            : 'border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600 dark:border-gray-700'
        }`}
      >
        <ThumbsDown className="h-4 w-4" /> Non
      </button>
    </div>
  );
}
