import { useState, useMemo } from 'react';
import type { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
  loading?: boolean;
  onStreamClick?: (orderId: number) => void;
}

const COLUMNS: { status: OrderStatus; label: string; color: string; bg: string }[] = [
  { status: 'ASSIGNED', label: 'Assigned', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  { status: 'REASSIGNMENT_PENDING', label: 'Pending Replan', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  { status: 'REASSIGNED', label: 'Reassigned', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
  { status: 'DELIVERED', label: 'Delivered', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
];

function SlaCountdown({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="sla-countdown sla-safe">No SLA</span>;
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = ms / 3_600_000;
  const cls = hours < 0 ? 'sla-breach' : hours < 1 ? 'sla-warn' : 'sla-safe';
  const label =
    hours < 0
      ? 'BREACHED'
      : hours < 1
      ? `${Math.max(0, Math.round(hours * 60))}m`
      : `${hours.toFixed(1)}h`;
  return <span className={`sla-countdown ${cls}`}>⏱ {label}</span>;
}

export function OrderBoard({ orders, loading, onStreamClick }: Props) {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'sla' | 'id' | 'customer'>('id');

  // Extract unique zones
  const allZones = useMemo(() => {
    const zones = new Set<string>();
    orders.forEach((o) => {
      if (o.pickupZone) zones.add(o.pickupZone);
      if (o.dropoffZone) zones.add(o.dropoffZone);
    });
    return Array.from(zones).sort();
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search match
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        order.id.toString().includes(query) ||
        order.description.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.deliveryAddress.toLowerCase().includes(query) ||
        (order.assignedAgent?.name && order.assignedAgent.name.toLowerCase().includes(query)) ||
        (order.pickupZone && order.pickupZone.toLowerCase().includes(query)) ||
        (order.dropoffZone && order.dropoffZone.toLowerCase().includes(query));

      // Status match
      const matchesStatus = selectedStatus === 'ALL' || order.status === selectedStatus;

      // Zone match
      const matchesZone =
        selectedZone === 'ALL' ||
        order.pickupZone === selectedZone ||
        order.dropoffZone === selectedZone;

      return matchesSearch && matchesStatus && matchesZone;
    }).sort((a, b) => {
      if (sortBy === 'id') return b.id - a.id;
      if (sortBy === 'customer') return a.customerName.localeCompare(b.customerName);
      if (sortBy === 'sla') {
        const timeA = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
        const timeB = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
        return timeA - timeB;
      }
      return 0;
    });
  }, [orders, searchQuery, selectedStatus, selectedZone, sortBy]);

  // Group by status for Kanban (using filtered list)
  const byStatus = useMemo(() => {
    return COLUMNS.reduce(
      (acc, col) => {
        acc[col.status] = filteredOrders.filter((o) => o.status === col.status);
        return acc;
      },
      {} as Record<OrderStatus, Order[]>
    );
  }, [filteredOrders]);

  // Pagination for table view
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="dispatch-board-section">
        <div className="section-title">📦 Full Dispatch Board</div>
        <div className="order-board">
          {COLUMNS.map((col) => (
            <div key={col.status} className="skeleton" style={{ height: 320, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dispatch-board-section">
      {/* ── Section Header & View Toggles ── */}
      <div className="dispatch-header-bar">
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>
            📦 Full Dispatch Board
          </div>
          <div className="dispatch-header-sub">
            Monitoring {orders.length} active delivery dispatches across Pune metropolitan zones
          </div>
        </div>

        <div className="dispatch-view-switcher">
          <button
            type="button"
            className={`dispatch-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            🗂️ Kanban View
          </button>
          <button
            type="button"
            className={`dispatch-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('table');
              setCurrentPage(1);
            }}
          >
            📋 Modern Table View
          </button>
        </div>
      </div>

      {/* ── Filter & Search Control Panel ── */}
      <div className="dispatch-control-panel">
        <div className="dispatch-search-box">
          <span className="dispatch-search-icon">🔍</span>
          <input
            type="text"
            className="dispatch-search-input"
            placeholder="Search by order #, customer, address, zone, or assigned courier..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="dispatch-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="dispatch-filter-group">
          {/* Status Select */}
          <select
            className="form-select dispatch-select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Statuses ({orders.length})</option>
            <option value="ASSIGNED">Assigned ({orders.filter(o => o.status === 'ASSIGNED').length})</option>
            <option value="REASSIGNMENT_PENDING">Pending Replan ({orders.filter(o => o.status === 'REASSIGNMENT_PENDING').length})</option>
            <option value="REASSIGNED">Reassigned ({orders.filter(o => o.status === 'REASSIGNED').length})</option>
            <option value="DELIVERED">Delivered ({orders.filter(o => o.status === 'DELIVERED').length})</option>
          </select>

          {/* Zone Select */}
          <select
            className="form-select dispatch-select"
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Zones</option>
            {allZones.map((z) => (
              <option key={z} value={z}>
                Zone: {z}
              </option>
            ))}
          </select>

          {/* Sort Select */}
          <select
            className="form-select dispatch-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'sla' | 'id' | 'customer')}
          >
            <option value="id">Sort: Newest First</option>
            <option value="sla">Sort: SLA Urgency ⏱</option>
            <option value="customer">Sort: Customer A-Z</option>
          </select>
        </div>
      </div>

      {/* ── Active Filters Summary Pill Row ── */}
      {(searchQuery || selectedStatus !== 'ALL' || selectedZone !== 'ALL') && (
        <div className="active-filters-bar">
          <span className="active-filter-label">Active filters:</span>
          {searchQuery && (
            <span className="filter-tag">
              Query: "{searchQuery}"
              <button onClick={() => setSearchQuery('')}>✕</button>
            </span>
          )}
          {selectedStatus !== 'ALL' && (
            <span className="filter-tag">
              Status: {selectedStatus}
              <button onClick={() => setSelectedStatus('ALL')}>✕</button>
            </span>
          )}
          {selectedZone !== 'ALL' && (
            <span className="filter-tag">
              Zone: {selectedZone}
              <button onClick={() => setSelectedZone('ALL')}>✕</button>
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost filter-reset-btn"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('ALL');
              setSelectedZone('ALL');
            }}
          >
            Reset All
          </button>
          <span className="filter-results-count">
            Found {filteredOrders.length} matching order{filteredOrders.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'kanban' ? (
        <div className="order-board">
          {COLUMNS.map((col) => {
            const colOrders = byStatus[col.status] || [];
            return (
              <div key={col.status} className="order-column">
                <div className="order-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col.color,
                        boxShadow: `0 0 10px ${col.color}`,
                        display: 'inline-block',
                      }}
                    />
                    <span className="order-column-title" style={{ color: col.color }}>
                      {col.label}
                    </span>
                  </div>
                  <span className="card-count" style={{ background: col.bg, color: col.color }}>
                    {colOrders.length}
                  </span>
                </div>

                <div className="order-column-scrollable">
                  {colOrders.length === 0 ? (
                    <div className="empty-state" style={{ padding: '36px 12px' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                      <div className="empty-state-desc">No orders in this column</div>
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <div key={order.id} className="order-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="order-card-id">#{order.id}</div>
                          <SlaCountdown deadline={order.slaDeadline} />
                        </div>
                        <div className="order-card-desc">{order.description}</div>
                        <div className="order-card-meta">
                          <span>👤 {order.customerName}</span>
                          {order.assignedAgent && (
                            <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                              · 🚴 {order.assignedAgent.name}
                            </span>
                          )}
                        </div>
                        {order.deliveryAddress && (
                          <div className="order-card-address" title={order.deliveryAddress}>
                            📍 {order.deliveryAddress}
                          </div>
                        )}
                        {order.pickupZone && (
                          <div className="order-card-meta" style={{ marginTop: 6 }}>
                            <span className="zone-pill">
                              {order.pickupZone} ➔ {order.dropoffZone}
                            </span>
                            {order.weightClass && (
                              <span className={`weight-badge ${order.weightClass.toLowerCase()}`}>
                                {order.weightClass}
                              </span>
                            )}
                          </div>
                        )}
                        {onStreamClick && (
                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-stream"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => onStreamClick(order.id)}
                              title="Stream AI reassignment reasoning live via SSE"
                            >
                              ⚡ AI Stream
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── MODERN TABLE VIEW ── */
        <div className="modern-table-card">
          <div className="table-responsive">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Order ID</th>
                  <th>Description</th>
                  <th>Customer & Address</th>
                  <th>Route (Zones)</th>
                  <th>Weight</th>
                  <th>Assigned Agent</th>
                  <th>SLA Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        No orders match your search filter
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Try adjusting your keywords or clearing the active filters
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const statusCol = COLUMNS.find((c) => c.status === order.status);
                    return (
                      <tr key={order.id} className="table-row-hover">
                        <td>
                          <span className="table-order-badge">#{order.id}</span>
                        </td>
                        <td>
                          <div className="table-order-desc">{order.description}</div>
                        </td>
                        <td>
                          <div className="table-customer-name">👤 {order.customerName}</div>
                          <div className="table-customer-address" title={order.deliveryAddress}>
                            {order.deliveryAddress}
                          </div>
                        </td>
                        <td>
                          {order.pickupZone ? (
                            <span className="zone-pill">
                              {order.pickupZone} ➔ {order.dropoffZone}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {order.weightClass ? (
                            <span className={`weight-badge ${order.weightClass.toLowerCase()}`}>
                              {order.weightClass}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {order.assignedAgent ? (
                            <div className="table-agent-pill">
                              <span
                                className={`agent-status-dot ${
                                  order.assignedAgent.status === 'AVAILABLE'
                                    ? 'dot-green'
                                    : order.assignedAgent.status === 'BUSY'
                                    ? 'dot-amber'
                                    : 'dot-red'
                                }`}
                              />
                              <span className="table-agent-name">{order.assignedAgent.name}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          <SlaCountdown deadline={order.slaDeadline} />
                        </td>
                        <td>
                          <span
                            className="table-status-pill"
                            style={{
                              background: statusCol?.bg || 'rgba(255,255,255,0.06)',
                              color: statusCol?.color || 'var(--text-primary)',
                              borderColor: `${statusCol?.color}40`,
                            }}
                          >
                            {statusCol?.label || order.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {onStreamClick && (
                            <button
                              type="button"
                              className="btn btn-stream"
                              style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}
                              onClick={() => onStreamClick(order.id)}
                              title="Stream live AI reasoning"
                            >
                              ⚡ AI Stream
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Table Footer & Pagination ── */}
          <div className="table-pagination-bar">
            <div className="table-pagination-info">
              Showing{' '}
              <strong>
                {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                {Math.min(currentPage * pageSize, filteredOrders.length)}
              </strong>{' '}
              of <strong>{filteredOrders.length}</strong> orders
            </div>

            <div className="table-pagination-controls">
              <div className="table-page-size-selector">
                <span>Rows:</span>
                <select
                  className="form-select page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="pagination-btn-group">
                <button
                  type="button"
                  className="btn btn-ghost pagination-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Prev
                </button>
                <span className="pagination-current-page">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost pagination-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
