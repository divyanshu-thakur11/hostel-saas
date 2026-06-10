import { useEffect, useRef, useCallback } from 'react';

const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

export default function useInactivityLogout(onLogout) {
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      alert('You have been logged out due to 2 hours of inactivity.');
      onLogout();
    }, TIMEOUT_MS);
  }, [onLogout]);

  useEffect(() => {
    const events = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer immediately
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);
}
