import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsApi } from '../../services/endpoints.js';

/**
 * Lightweight silent analytics tracker + affiliate referral query capture (?ref=CODE).
 */
export default function PageTracker() {
  const location = useLocation();
  const lastTracked = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref') || params.get('referralCode');
    if (refCode && refCode.trim().length >= 3) {
      try {
        localStorage.setItem('ai_scanner_ref', refCode.trim().toUpperCase());
      } catch {
        // ignore storage errors
      }
    }
  }, [location.search]);

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
