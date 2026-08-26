import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  onStatusChange: (id: number, status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => void;
  loading?: boolean;
}

function AgentAvatar({ name, status }: { name: string; status: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`agent-avatar ${status.toLowerCase()}`}>{initials}</div>
  );
}

function LoadBar({ count, max = 5 }: { count: number; max?: number }) {
  const pct = Math.min((count / max) * 100, 100);
  const cls = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--amber)' : 'var(--green)';
  return (
    <div className="agent-load-bar" title={`${count}/${max} orders`}>
      <div className="agent-load-fill" style={{ width: `${pct}%`, background: cls }} />
    </div>
  );
}

export function AgentRoster({ agents, onStatusChange, loading }: Props) {
  const statusOrder = { AVAILABLE: 0, BUSY: 1, OFFLINE: 2 };
  const sorted = [...agents].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const counts = agents.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🚴</span> Agent Roster
          <span className="card-count">{agents.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono' }}>
          <span style={{ color: 'var(--green)' }}>✓ {counts.AVAILABLE || 0}</span>
          <span style={{ color: 'var(--amber)' }}>● {counts.BUSY || 0}</span>
          <span style={{ color: 'var(--red)' }}>✕ {counts.OFFLINE || 0}</span>
        </div>
      </div>

      {loading ? (
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8, borderRadius: 8 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">No agents found</div>
        </div>
      ) : (
        <div className="agent-list">
          {sorted.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${agent.status === 'OFFLINE' ? 'offline' : ''}`}
              title={`Click to change status`}
            >
              <AgentAvatar name={agent.name} status={agent.status} />
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-meta">
                  {agent.currentZone && <span>{agent.currentZone} · </span>}
                  {agent.phone}
                </div>
              </div>
              <LoadBar count={agent.currentOrderCount} max={agent.maxCapacity || 5} />
              <div className="agent-orders-chip">{agent.currentOrderCount} orders</div>
              <span
                className={`badge badge-${agent.status.toLowerCase()}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const next: Record<string, 'AVAILABLE' | 'BUSY' | 'OFFLINE'> = {
                    AVAILABLE: 'OFFLINE',
                    BUSY: 'OFFLINE',
                    OFFLINE: 'AVAILABLE',
                  };
                  onStatusChange(agent.id, next[agent.status]);
                }}
                title="Click to toggle status"
              >
                {agent.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
