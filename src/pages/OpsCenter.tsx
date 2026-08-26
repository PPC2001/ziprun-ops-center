import { useState, useCallback, useEffect } from 'react';
import type { Agent, Order, Suggestion, AgentStatus, DashboardStats, CreateOrderPayload } from '../types';
import { agentApi } from '../api/agents';
import { orderApi } from '../api/orders';
import { suggestionApi } from '../api/suggestions';
import { usePolling } from '../hooks/usePolling';
import { useSseStream } from '../hooks/useSseStream';
import { AgentRoster } from '../components/AgentRoster';
import { SuggestionCard } from '../components/SuggestionCard';
import { OrderBoard } from '../components/OrderBoard';
import { SsePanel } from '../components/SsePanel';
import { showToast } from '../components/Toast';

function computeStats(agents: Agent[], orders: Order[], suggestions: Suggestion[]): DashboardStats {
  return {
    totalAgents: agents.length,
    availableAgents: agents.filter((a) => a.status === 'AVAILABLE').length,
    busyAgents: agents.filter((a) => a.status === 'BUSY').length,
    offlineAgents: agents.filter((a) => a.status === 'OFFLINE').length,
    pendingSuggestions: suggestions.filter((s) => s.status === 'PENDING').length,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'REASSIGNMENT_PENDING').length,
  };
}

function CreateOrderModal({
  agents,
  onClose,
  onCreated,
}: {
  agents: Agent[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateOrderPayload>({
    description: '',
    customerName: '',
    deliveryAddress: '',
    agentId: agents[0]?.id || 0,
    pickupZone: '',
    dropoffZone: '',
  });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.description || !form.customerName || !form.deliveryAddress || !form.agentId) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    setLoading(true);
    try {
      await orderApi.create(form);
      showToast('Order created successfully', 'success');
      onCreated();
      onClose();
    } catch (e: unknown) {
      showToast((e as Error).message || 'Failed to create order', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="form-modal">
        <div className="form-modal-title">📦 Create New Order</div>

        <div className="form-group">
          <label className="form-label">Description *</label>
          <input
            className="form-input"
            placeholder="e.g. Laptop delivery to customer"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Customer Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Ravi Nair"
              value={form.customerName}
              onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Assign Agent *</label>
            <select
              className="form-select"
              value={form.agentId}
              onChange={(e) => setForm((p) => ({ ...p, agentId: +e.target.value }))}
            >
              {agents
                .filter((a) => a.status !== 'OFFLINE')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.status}, {a.currentOrderCount} orders)
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Delivery Address *</label>
          <input
            className="form-input"
            placeholder="e.g. 12 MG Road, Pune - 411001"
            value={form.deliveryAddress}
            onChange={(e) => setForm((p) => ({ ...p, deliveryAddress: e.target.value }))}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pickup Zone</label>
            <input
              className="form-input"
              placeholder="e.g. Zone-A"
              value={form.pickupZone}
              onChange={(e) => setForm((p) => ({ ...p, pickupZone: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dropoff Zone</label>
            <input
              className="form-input"
              placeholder="e.g. Zone-B"
              value={form.dropoffZone}
              onChange={(e) => setForm((p) => ({ ...p, dropoffZone: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : '+ Create Order'}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function OpsCenter() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [streamOrderId, setStreamOrderId] = useState<number | null>(null);
  const [showAiStream, setShowAiStream] = useState(false);

  const sse = useSseStream(streamOrderId);

  const refresh = useCallback(async () => {
    try {
      const [a, o, s] = await Promise.all([
        agentApi.getAll(),
        orderApi.getAll(),
        suggestionApi.getAll(),
      ]);
      setAgents(a);
      setOrders(o);
      setSuggestions(s);
    } catch (e: unknown) {
      console.error('Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  usePolling(refresh, 5000);

  const handleAgentStatus = async (id: number, status: AgentStatus) => {
    try {
      await agentApi.updateStatus(id, status);
      showToast(
        status === 'OFFLINE'
          ? '🔴 Agent offline — agentic re-planning loop triggered!'
          : '✓ Agent status updated',
        status === 'OFFLINE' ? 'info' : 'success'
      );
      await refresh();
    } catch (e: unknown) {
      showToast((e as Error).message || 'Failed to update status', 'error');
    }
  };

  const handleSuggestionResolved = async () => {
    showToast('Suggestion resolved', 'success');
    await refresh();
  };

  const handleAcceptSuggestion = async (id: number) => {
    try {
      await suggestionApi.resolve(id, 'ACCEPTED');
      showToast('✓ Suggestion accepted — order reassigned!', 'success');
      await refresh();
    } catch (e: unknown) {
      showToast((e as Error).message || 'Failed to accept suggestion', 'error');
    }
  };

  const handleStreamClick = (orderId: number) => {
    setStreamOrderId(orderId);
    setShowAiStream(true);
    sse.startStream(orderId);
  };

  const handleCloseStream = () => {
    setShowAiStream(false);
    sse.stopStream();
    setStreamOrderId(null);
  };

  const stats = computeStats(agents, orders, suggestions);
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');
  const displayedSuggestions = activeTab === 'pending' ? pendingSuggestions : suggestions;

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🚀</div>
          <div>
            <div className="header-title">ZipRun Ops Center</div>
            <div className="header-subtitle">AI Reassignment Engine</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="live-indicator">
            <div className="live-dot" />
            <span className="live-text">Live · 5s poll</span>
          </div>
          <button className="btn btn-secondary btn-refresh" onClick={refresh}>↻ Refresh</button>
          <button className="btn btn-primary btn-new-order" onClick={() => setShowCreateOrder(true)}>
            + New Order
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* ── Stats Bar ── */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-value blue">{stats.totalOrders}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value amber">{stats.pendingOrders}</div>
            <div className="stat-label">Pending Replan</div>
          </div>
          <div className="stat-card">
            <div className={`stat-value ${stats.pendingSuggestions > 0 ? 'amber' : 'teal'}`}>
              {stats.pendingSuggestions}
            </div>
            <div className="stat-label">Pending Suggestions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{stats.availableAgents}</div>
            <div className="stat-label">Available Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value amber">{stats.busyAgents}</div>
            <div className="stat-label">Busy Agents</div>
          </div>
          <div className="stat-card">
            <div className={`stat-value ${stats.offlineAgents > 0 ? 'red' : 'teal'}`}>
              {stats.offlineAgents}
            </div>
            <div className="stat-label">Offline Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value teal">{stats.totalAgents}</div>
            <div className="stat-label">Total Agents</div>
          </div>
        </div>

        {/* ── Main ops grid ── */}
        <div className="ops-grid">
          {/* Left: Suggestions */}
          <div className="suggestions-section">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setActiveTab('pending')}
                >
                  Pending
                  {pendingSuggestions.length > 0 && (
                    <span style={{
                      background: 'rgba(255,169,41,0.2)', color: 'var(--amber)',
                      borderRadius: 20, padding: '1px 6px', fontSize: 10, marginLeft: 4
                    }}>
                      {pendingSuggestions.length}
                    </span>
                  )}
                </button>
                <button
                  className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setActiveTab('all')}
                >
                  All Suggestions
                </button>
              </div>
            </div>

            {loading ? (
              <>
                <div className="skeleton skeleton-card" />
                <div className="skeleton skeleton-card" />
              </>
            ) : displayedSuggestions.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">No pending suggestions</div>
                  <div className="empty-state-desc">
                    The system is monitoring agents. Suggestions appear automatically when an agent goes offline.
                  </div>
                </div>
              </div>
            ) : (
              displayedSuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onResolved={handleSuggestionResolved}
                  onStreamClick={handleStreamClick}
                />
              ))
            )}
          </div>

          {/* Right: Agent Roster */}
          <div className="fleet-section">
            <AgentRoster
              agents={agents}
              onStatusChange={handleAgentStatus}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Full Dispatch Board (UI ceiling) ── */}
        <OrderBoard orders={orders} loading={loading} onStreamClick={handleStreamClick} />
      </div>

      {/* ── Modals & Panels ── */}
      {showCreateOrder && (
        <CreateOrderModal
          agents={agents}
          onClose={() => setShowCreateOrder(false)}
          onCreated={refresh}
        />
      )}

      {showAiStream && (
        <SsePanel
          state={sse}
          onClose={handleCloseStream}
          onAccept={handleAcceptSuggestion}
        />
      )}
    </div>
  );
}
