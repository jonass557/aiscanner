import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsApi } from '../../services/endpoints.js';

/**
 * Lightweight silent analytics tracker: sends page views on route transitions.
 */
export default function PageTracker() {
  const location = useLocation();
  const lastTracked = useRef(null);

  useEffect(() => {
    const currentPath = location.pathname;
    if (lastTracked.current === currentPath) return;
    lastTracked.current = currentPath;

    // Small delay to let title or state settle, non-blocking
    const timer = setTimeout(() => {
      analyticsApi.track({ path: currentPath }).catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
}
