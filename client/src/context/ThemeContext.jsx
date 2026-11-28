import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

/**
 * Unified Cyber-Trading Dark Theme (locked, no light/dark switcher).
 */
export const ThemeProvider = ({ children }) => {
  const theme = 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    localStorage.setItem('acs_theme', 'dark');
  }, []);

  const toggleTheme = () => {};

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
