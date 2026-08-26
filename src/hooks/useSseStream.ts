import { useState, useEffect, useRef } from 'react';
import type { Suggestion } from '../types';

export interface SseState {
  isStreaming: boolean;
  tokens: string;
  suggestion: Suggestion | null;
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export function useSseStream(initialOrderId: number | null) {
  const [state, setState] = useState<SseState>({
    isStreaming: false,
    tokens: '',
    suggestion: null,
    error: null,
  });
  const esRef = useRef<EventSource | null>(null);

  const startStream = (orderIdParam?: number) => {
    const targetId = orderIdParam || initialOrderId;
    if (!targetId || esRef.current) return;

    setState({ isStreaming: true, tokens: '', suggestion: null, error: null });

    const cleanBase = API_BASE.replace(/\/$/, '');
    const es = new EventSource(`${cleanBase}/orders/${targetId}/suggest/stream`);
    esRef.current = es;

    es.addEventListener('token', (e) => {
      setState((prev) => ({ ...prev, tokens: prev.tokens + (e as MessageEvent).data }));
    });

    es.addEventListener('suggestion_complete', (e) => {
      try {
        const suggestion = JSON.parse((e as MessageEvent).data) as Suggestion;
        setState((prev) => ({ ...prev, isStreaming: false, suggestion }));
      } catch {
        setState((prev) => ({ ...prev, isStreaming: false }));
      }
      es.close();
      esRef.current = null;
    });

    es.addEventListener('stream_error', (e) => {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: (e as MessageEvent).data,
      }));
      es.close();
      esRef.current = null;
    });

    es.onerror = () => {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: 'Stream connection lost',
      }));
      es.close();
      esRef.current = null;
    };
  };

  const stopStream = () => {
    esRef.current?.close();
    esRef.current = null;
    setState({ isStreaming: false, tokens: '', suggestion: null, error: null });
  };

  useEffect(() => () => { esRef.current?.close(); }, []);

  return { ...state, startStream, stopStream };
}
