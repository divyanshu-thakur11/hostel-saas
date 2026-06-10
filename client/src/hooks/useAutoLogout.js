import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_MS   = 5 * 60 * 1000;        // warn 5 min before
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function useAutoLogout(onLogout) {
  const timerRef   = useRef(null);
  const warnRef    = useRef(null);
  const warnShown  = useRef(false);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    warnShown.current = false;

    // warning at (INACTIVITY_MS - WARNING_MS)
    warnRef.current = setTimeout(() => {
      if (!warnShown.current) {
        warnShown.current = true;
        const stay = window.confirm(
          '⚠️ You have been inactive for 1 hour 55 minutes.\n\nClick OK to stay logged in, or Cancel to log out now.'
        );
        if (!stay) { onLogout('inactivity'); return; }
        reset(); // user chose to stay — restart timer
      }
    }, INACTIVITY_MS - WARNING_MS);

    // hard logout
    timerRef.current = setTimeout(() => {
      onLogout('inactivity');
    }, INACTIVITY_MS);
  }, [onLogout]);

  useEffect(() => {
    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);
}
