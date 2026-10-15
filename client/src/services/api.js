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

    // Auto-retry once on transient network drop (weak mobile connection)
    if (!original._netRetried && (!error.response || [502, 503, 504].includes(status))) {
      original._netRetried = true;
      await new Promise((r) => setTimeout(r, 1200));
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

  // Detect missing VITE_API_URL on Vercel or cloud deployment
  const isVercelOrRemote = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isVercelOrRemote && !import.meta.env.VITE_API_URL) {
    return "L'URL du serveur backend (Render) n'est pas renseignée dans Vercel (variable VITE_API_URL manquante). Veuillez ajouter VITE_API_URL=<URL_BACKEND_RENDER> dans Vercel -> Settings -> Environment Variables puis redéployer.";
  }

  // Detect HTML returned by Vercel rewrites when API endpoint doesn't exist on static host
  if (typeof error.response?.data === 'string' && error.response.data.includes('<!doctype html>')) {
    return "Le serveur frontend (Vercel) a renvoyé une page HTML au lieu de l'API. Assurez-vous que la variable VITE_API_URL est bien configurée avec l'URL de votre backend Render.";
  }

  if (!error.response && error.message === 'Network Error') {
    if (isVercelOrRemote) {
      return "Impossible de joindre le serveur backend (Render). Si vous utilisez l'offre gratuite de Render, le serveur s'endort après 15 min d'inactivité et prend 40 à 50 secondes pour démarrer (démarrage à froid). Patientez une minute et réessayez, ou vérifiez l'état de votre service sur le tableau de bord Render.";
    }
    return 'Impossible de joindre le serveur backend. Vérifiez que le serveur est bien démarré sur le port 5000 (npm run dev dans le dossier server).';
  }
  return error.response?.data?.message || error.message || 'Une erreur est survenue. Veuillez réessayer.';
};

export default api;
