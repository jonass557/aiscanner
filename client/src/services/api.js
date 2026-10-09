import axios from 'axios';

/**
 * Central axios instance. Attaches the access token to every request and
 * transparently refreshes it once on a 401 before retrying.
 */
const api = axios.create({
  // In dev the Vite proxy forwards /api/v1 to the Express server. In
  // production, VITE_API_URL points at the Render backend (e.g.
  // https://api.your-app.com) and we append the /api/v1 prefix.
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  timeout: 15000,
});

const TOKEN_KEY = 'acs_access_token';
const REFRESH_KEY = 'acs_refresh_token';

export const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  pendingQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Attempt a single token refresh on 401 (but never for the refresh call itself).
    if (status === 401 && !original._retry && !original.url.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;
      const refreshToken = tokenStore.getRefresh();

      if (!refreshToken) {
        tokenStore.clear();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const newToken = data.data.accessToken;
        tokenStore.set(newToken);
        flushQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        flushQueue(err, null);
        tokenStore.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/** Normalizes an axios error into a human-readable message. */
export const getErrorMessage = (error) => {
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return 'Délai d\'attente dépassé (timeout). Le serveur ou la base de données ne répond pas. Vérifiez la connexion.';
  }
  if (!error.response && error.message === 'Network Error') {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion et assurez-vous que le serveur backend est démarré.';
  }
  return error.response?.data?.message || error.message || 'Une erreur est survenue. Veuillez réessayer.';
};

export default api;
