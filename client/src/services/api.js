import axios from 'axios';

/**
 * Central axios instance.
 * Uses relative `/api/v1` by default so requests go through:
 *  - Vite dev proxy in local development (`localhost:3000` -> `127.0.0.1:5000`)
 *  - Vercel Edge Rewrites in production (`vercel.json` -> `aiscanner-id5q.onrender.com`)
 * Routing through Vercel's same-origin proxy avoids ISP TLS resets
 * (`net::ERR_CONNECTION_RESET`) on direct `*.onrender.com` connections.
 */
const rawBase = (import.meta.env.VITE_API_URL || '').trim();
const cleanBaseUrl = rawBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 90000,
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
  async (res) => {
    // If a static host without Vercel rewrites returns index.html for /api/v1/*,
    // transparently retry against VITE_API_URL if configured.
    if (
      typeof res.data === 'string' &&
      res.data.toLowerCase().includes('<!doctype html>') &&
      cleanBaseUrl &&
      !res.config._directRetried
    ) {
      res.config._directRetried = true;
      res.config.baseURL = `${cleanBaseUrl}/api/v1`;
      return api(res.config);
    }
    return res;
  },
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    // Attempt a single token refresh on 401 (but never for the refresh call itself or login).
    if (
      status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
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
        isRefreshing = false;
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

    // Auto-retry once on transient network drop or cold start (502/503/504)
    if (!original._netRetried && (!error.response || [502, 503, 504].includes(status))) {
      original._netRetried = true;
      await new Promise((r) => setTimeout(r, 1500));
      return api(original);
    }

    return Promise.reject(error);
  }
);

/** Normalizes an axios error into a human-readable message. */
export const getErrorMessage = (error) => {
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return "Délai d'attente dépassé (timeout). Le serveur backend prend plus de temps que prévu à répondre ou le réseau est saturé. Veuillez réessayer.";
  }

  const isVercelOrRemote =
    typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (
    typeof error.response?.data === 'string' &&
    error.response.data.toLowerCase().includes('<!doctype html>')
  ) {
    return "Le serveur frontend a renvoyé une page HTML au lieu de l'API. Vérifiez que le redéploiement Vercel est terminé.";
  }

  if (!error.response && error.message === 'Network Error') {
    if (isVercelOrRemote) {
      return "Impossible de joindre le serveur backend (Render). Si le serveur était en veille (offre gratuite Render), patientez 30 à 40 secondes et réessayez.";
    }
    return 'Impossible de joindre le serveur backend. Vérifiez que le serveur est bien démarré sur le port 5000 (npm run dev dans le dossier server).';
  }
  return error.response?.data?.message || error.message || 'Une erreur est survenue. Veuillez réessayer.';
};

export default api;
