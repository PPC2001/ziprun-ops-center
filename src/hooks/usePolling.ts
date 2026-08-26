import { useEffect, useRef, useCallback } from 'react';

export function usePolling(callback: () => void, intervalMs = 5000, enabled = true) {
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (timerRef.current) return;
    savedCallback.current();
    timerRef.current = setInterval(() => savedCallback.current(), intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [enabled, start, stop]);

  return { stop, start };
}
