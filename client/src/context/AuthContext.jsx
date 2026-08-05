import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../services/endpoints.js';
import { tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

/**
 * Global auth state. Loads the current user from the stored token on mount,
 * and exposes login/register/logout plus a setUser for post-mutation updates.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Effective runtime flag from the backend: when false, verification gates
  // are hidden everywhere (admin can toggle it on from the dashboard).
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  const loadUser = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data.data.user);
      setRequireEmailVerification(Boolean(data.data.requireEmailVerification));
    } catch {
      tokenStore.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    tokenStore.set(data.data.accessToken, data.data.refreshToken);
    setUser(data.data.user);
    setRequireEmailVerification(Boolean(data.data.requireEmailVerification));
    return data.data.user;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    tokenStore.set(data.data.accessToken, data.data.refreshToken);
    setUser(data.data.user);
    setRequireEmailVerification(Boolean(data.data.requireEmailVerification));
    return data.data.user;
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const refreshUser = loadUser;

  const value = {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    refreshUser,
    requireEmailVerification,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
