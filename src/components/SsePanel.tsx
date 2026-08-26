import type { SseState } from '../hooks/useSseStream';
import type { Suggestion } from '../types';

interface Props {
  state: SseState;
  onClose: () => void;
}

export function SsePanel({ state, onClose }: Props) {
  const { isStreaming, tokens, suggestion, error } = state;

  if (!isStreaming && !tokens && !suggestion && !error) return null;

  return (
    <div className="sse-panel">
      <div className="sse-panel-header">
        <div className="sse-panel-title">
          {isStreaming && <div className="thinking-dot" />}
          {isStreaming ? '⚡ AI Reasoning Live' : suggestion ? '✓ Stream Complete' : '✕ Stream Error'}
        </div>
        <button className="btn btn-ghost" onClick={onClose}>✕</button>
      </div>
      <div className="sse-panel-body">
        {tokens && (
          <div className="sse-tokens">
            {tokens}
            {isStreaming && <span className="sse-cursor" />}
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            Error: {error}
          </div>
        )}
        {suggestion && !isStreaming && (
          <div style={{
            marginTop: 16, padding: 12,
            background: 'var(--green-dim)',
            border: '1px solid rgba(46,213,115,0.2)',
            borderRadius: 8, fontSize: 12,
            color: 'var(--green)', fontFamily: 'JetBrains Mono'
          }}>
            ✓ Suggestion saved — recommended: {(suggestion as Suggestion).recommendedAgent?.name}
          </div>
        )}
      </div>
    </div>
  );
}
