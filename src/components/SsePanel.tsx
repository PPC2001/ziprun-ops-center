import { useEffect, useRef } from 'react';
import type { SseState } from '../hooks/useSseStream';
import type { Suggestion } from '../types';
import { ConfidenceBar } from './ConfidenceBar';

interface Props {
  state: SseState;
  onClose: () => void;
  onAccept?: (suggestionId: number) => void;
}

export function SsePanel({ state, onClose, onAccept }: Props) {
  const { isStreaming, tokens, suggestion, error } = state;
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom as tokens stream in
  useEffect(() => {
    if (isStreaming && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tokens, isStreaming]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isStreaming && !tokens && !suggestion && !error) return null;

  const typedSuggestion = suggestion as Suggestion | null;
  const tokenCount = tokens ? tokens.trim().split(/\s+/).length : 0;

  return (
    <div className="form-overlay sse-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sse-modal">
        {/* ── Modal Header ── */}
        <div className="sse-modal-header">
          <div className="sse-modal-title-wrap">
            <div className={`sse-badge-icon ${isStreaming ? 'pulse' : ''}`}>
              ⚡
            </div>
            <div>
              <div className="sse-modal-title">AI Live Reasoning Engine</div>
              <div className="sse-modal-subtitle">
                {isStreaming ? (
                  <span className="streaming-status">
                    <span className="thinking-dot" /> Streaming chain-of-thought tokens...
                  </span>
                ) : suggestion ? (
                  <span className="complete-status">✓ Reasoning complete & persisted</span>
                ) : error ? (
                  <span className="error-status">✕ Connection interrupted</span>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tokens && (
              <span className="sse-token-counter">
                {tokenCount} tokens
              </span>
            )}
            <button className="btn btn-ghost sse-close-btn" onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>

        {/* ── Terminal Reasoning Console ── */}
        <div className="sse-terminal-container">
          <div className="sse-terminal-topbar">
            <div className="sse-terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="sse-terminal-label">dispatch_reasoning_stream.log</span>
            <span className="sse-terminal-model">Gemini 1.5 Flash / Groq Llama 3.1</span>
          </div>

          <div className="sse-terminal-body">
            {tokens ? (
              <div className="sse-tokens">
                {tokens}
                {isStreaming && <span className="sse-cursor" />}
              </div>
            ) : isStreaming ? (
              <div className="sse-initial-loading">
                <span className="thinking-dot" /> Establishing real-time SSE stream with LLM Gateway...
              </div>
            ) : null}

            {error && (
              <div className="sse-error-box">
                <div className="sse-error-title">⚠️ AI Stream Error</div>
                <div className="sse-error-desc">{error}</div>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* ── Completion Recommendation Card ── */}
        {typedSuggestion && !isStreaming && (
          <div className="sse-result-card">
            <div className="sse-result-header">
              <div className="sse-result-agent">
                <div className="agent-avatar available">
                  {typedSuggestion.recommendedAgent?.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <div className="sse-result-tag">Recommended Replacement Courier</div>
                  <div className="sse-result-name">{typedSuggestion.recommendedAgent?.name}</div>
                  <div className="sse-result-sub">
                    📍 {typedSuggestion.recommendedAgent?.currentZone || 'Zone-A'} · Active Load: {typedSuggestion.recommendedAgent?.currentOrderCount ?? 0} orders
                  </div>
                </div>
              </div>

              {typedSuggestion.confidenceScore != null && (
                <div className="sse-result-confidence">
                  <ConfidenceBar score={typedSuggestion.confidenceScore} />
                </div>
              )}
            </div>

            <div className="sse-result-actions">
              {onAccept && (
                <button
                  className="btn btn-accept"
                  onClick={() => {
                    onAccept(typedSuggestion.id);
                    onClose();
                  }}
                >
                  ✓ Accept & Dispatch Reassignment
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
