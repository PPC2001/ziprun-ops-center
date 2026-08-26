import { useState } from 'react';
import type { Suggestion } from '../types';
import { ConfidenceBar } from './ConfidenceBar';
import { ReplanBadge } from './ReplanBadge';
import { suggestionApi } from '../api/suggestions';

interface Props {
  suggestion: Suggestion;
  onResolved: () => void;
  onStreamClick: (orderId: number) => void;
}

export function SuggestionCard({ suggestion, onResolved, onStreamClick }: Props) {
  const [loading, setLoading] = useState(false);
  const isReplan = suggestion.triggerReason === 'AGENT_OFFLINE';
  const isFallback = suggestion.aiReasoning?.startsWith('[AI unavailable');

  const resolve = async (status: 'ACCEPTED' | 'REJECTED') => {
    setLoading(true);
    try {
      await suggestionApi.resolve(suggestion.id, status);
      onResolved();
    } catch (e) {
      console.error('Failed to resolve suggestion', e);
    } finally {
      setLoading(false);
    }
  };

  const slaDeadline = suggestion.order.slaDeadline;
  const slaMs = slaDeadline ? new Date(slaDeadline).getTime() - Date.now() : null;
  const slaHours = slaMs ? slaMs / 3_600_000 : null;
  const slaClass =
    slaHours === null ? '' : slaHours < 0 ? 'sla-breach' : slaHours < 1 ? 'sla-warn' : 'sla-safe';
  const slaLabel =
    slaHours === null
      ? null
      : slaHours < 0
      ? 'BREACHED'
      : slaHours < 1
      ? `${Math.round(slaHours * 60)}m left`
      : `${slaHours.toFixed(1)}h left`;

  return (
    <div className={`suggestion-card ${isReplan ? 'auto-replan' : ''}`}>
      {/* Header */}
      <div className="suggestion-card-header">
        <div className="suggestion-order-info">
          <div className="suggestion-order-id">ORDER #{suggestion.order.id}</div>
          <div className="suggestion-order-desc">{suggestion.order.description}</div>
          <div className="suggestion-order-meta">
            <span>👤 {suggestion.order.customerName}</span>
            <span>📍 {suggestion.order.deliveryAddress.split(',').slice(0, 2).join(',')}</span>
            {slaLabel && (
              <span className={`sla-countdown ${slaClass}`}>{slaLabel}</span>
            )}
          </div>
        </div>
        <div className="suggestion-badges">
          <ReplanBadge triggerReason={suggestion.triggerReason} />
          {suggestion.order.weightClass && (
            <span className="badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(92,157,255,0.2)' }}>
              {suggestion.order.weightClass}
            </span>
          )}
        </div>
      </div>

      {/* Recommended agent */}
      <div className="recommended-agent">
        <div>
          <div className="recommended-label">Recommended Agent</div>
          <div className="recommended-name">{suggestion.recommendedAgent.name}</div>
          <div className="recommended-meta">
            {suggestion.recommendedAgent.currentZone && `${suggestion.recommendedAgent.currentZone} · `}
            {suggestion.recommendedAgent.currentOrderCount} active orders
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={`badge badge-${suggestion.recommendedAgent.status.toLowerCase()}`}>
            {suggestion.recommendedAgent.status}
          </span>
          <span className="agent-orders-chip">{suggestion.recommendedAgent.currentOrderCount} orders</span>
        </div>
      </div>

      {/* Confidence */}
      <ConfidenceBar score={suggestion.confidenceScore} />

      {/* AI Reasoning */}
      <div className="ai-reasoning-section">
        <div className="ai-reasoning-label">
          {isFallback ? '⚠️ Fallback Reasoning' : '🤖 AI Reasoning'}
        </div>
        <div className="ai-reasoning-text">{suggestion.aiReasoning}</div>
      </div>

      {/* Actions */}
      {suggestion.status === 'PENDING' && (
        <div className="suggestion-actions">
          <button
            className="btn btn-accept"
            onClick={() => resolve('ACCEPTED')}
            disabled={loading}
          >
            ✓ Accept
          </button>
          <button
            className="btn btn-reject"
            onClick={() => resolve('REJECTED')}
            disabled={loading}
          >
            ✕ Reject
          </button>
          <button
            className="btn btn-stream"
            onClick={() => onStreamClick(suggestion.order.id)}
            title="Stream AI reasoning live"
          >
            ⚡ AI Stream
          </button>
        </div>
      )}

      {suggestion.status !== 'PENDING' && (
        <div style={{ marginTop: 10 }}>
          <span className={`badge badge-${suggestion.status.toLowerCase()}`}>
            {suggestion.status === 'ACCEPTED' ? '✓ ' : '✕ '}{suggestion.status}
          </span>
          {suggestion.resolvedAt && (
            <span className="text-muted text-xs" style={{ marginLeft: 8 }}>
              {new Date(suggestion.resolvedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
