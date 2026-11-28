import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { paymentApi } from '../services/endpoints.js';

const ThemeContext = createContext(null);

/**
 * Unified Cyber-Trading Dark Theme (locked, no light/dark switcher)
 * + Dynamic Branding (custom Navbar Logo & Browser Favicon from Admin Settings).
 */
export const ThemeProvider = ({ children }) => {
  const theme = 'dark';
  const [branding, setBranding] = useState({ logoUrl: '', faviconUrl: '' });

  const applyFavicon = (url) => {
    if (!url || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  };

  const refreshBranding = useCallback(async () => {
    try {
      const { data } = await paymentApi.getConfig();
      const b = data?.data?.branding || {};
      setBranding({ logoUrl: b.logoUrl || '', faviconUrl: b.faviconUrl || '' });
      if (b.faviconUrl) applyFavicon(b.faviconUrl);
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    localStorage.setItem('acs_theme', 'dark');
    refreshBranding();
  }, [refreshBranding]);

  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, branding, refreshBranding }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
