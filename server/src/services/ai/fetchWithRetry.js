/**
 * Shared HTTP retry utility for AI providers.
 *
 * Retries transient errors (503, 429, 500, 502, 504) with exponential backoff.
 * 3 attempts total (initial + 2 retries), delays 1s → 2s → 4s.
 */

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Wraps a fetch call with retry logic.
 * @param {Function} fetchFn - async function that returns a Response
 * @param {string} providerName - for logging
 * @returns {Promise<Response>}
 */
export const fetchWithRetry = async (fetchFn, providerName = 'AI provider') => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchFn();
      if (res.ok || !RETRYABLE_STATUS.includes(res.status)) {
        return res; // success or non-retryable error → return immediately
      }
      // Retryable status → save error and retry
      lastError = new Error(`${providerName} returned ${res.status}: ${await res.text()}`);
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      // Network error or fetch rejection → save and retry
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  // All retries exhausted → throw the last error
  throw lastError;
};
