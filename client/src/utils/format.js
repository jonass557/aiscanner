/**
 * Formatting + display helpers shared across the app.
 */

export const formatDate = (date, opts = {}) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatPrice = (v) => {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 5 });
};

export const formatNumber = (v) => (v ?? 0).toLocaleString('en-US');

/** Visual mapping for a decision value. */
export const decisionMeta = (decision) => {
  switch (decision) {
    case 'BUY':
      return { label: 'BUY', tone: 'green', color: 'text-green-500', bg: 'bg-green-500' };
    case 'SELL':
      return { label: 'SELL', tone: 'red', color: 'text-red-500', bg: 'bg-red-500' };
    case 'WAIT':
      return { label: 'ATTENDRE', tone: 'yellow', color: 'text-yellow-600', bg: 'bg-yellow-500' };
    default:
      // Legacy NO_TRADE records.
      return { label: 'NO TRADE', tone: 'gray', color: 'text-gray-500', bg: 'bg-gray-500' };
  }
};

/** Confidence -> tone. */
export const confidenceTone = (score) => {
  if (score >= 80) return 'green';
  if (score >= 70) return 'blue';
  if (score >= 50) return 'yellow';
  return 'red';
};

export const marketLabel = (market) =>
  ({
    forex: 'Forex',
    crypto: 'Crypto',
    indices: 'Indices',
    commodities: 'Commodities',
    synthetic: 'Synthetic',
    unknown: 'Unknown',
  }[market] || market);

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
