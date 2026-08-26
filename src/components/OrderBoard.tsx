import type { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
  loading?: boolean;
}

const COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'ASSIGNED', label: 'Assigned', color: 'var(--blue)' },
  { status: 'REASSIGNMENT_PENDING', label: 'Pending Reassignment', color: 'var(--amber)' },
  { status: 'REASSIGNED', label: 'Reassigned', color: 'var(--teal)' },
  { status: 'DELIVERED', label: 'Delivered', color: 'var(--green)' },
];

function SlaCountdown({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = ms / 3_600_000;
  const cls = hours < 0 ? 'sla-breach' : hours < 1 ? 'sla-warn' : 'sla-safe';
  const label =
    hours < 0
      ? 'BREACHED'
      : hours < 1
      ? `${Math.round(hours * 60)}m`
      : `${hours.toFixed(1)}h`;
  return <span className={`sla-countdown ${cls}`}>⏱ {label}</span>;
}

export function OrderBoard({ orders, loading }: Props) {
  const byStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = orders.filter((o) => o.status === col.status);
      return acc;
    },
    {} as Record<OrderStatus, Order[]>
  );

  if (loading) {
    return (
      <div>
        <div className="section-title">📦 Full Dispatch Board</div>
        <div className="order-board">
          {COLUMNS.map((col) => (
            <div key={col.status} className="skeleton" style={{ height: 200, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="section-title">📦 Full Dispatch Board</div>
      <div className="order-board">
        {COLUMNS.map((col) => {
          const colOrders = byStatus[col.status] || [];
          return (
            <div key={col.status} className="order-column">
              <div className="order-column-header">
                <span className="order-column-title" style={{ color: col.color }}>
                  {col.label}
                </span>
                <span className="card-count">{colOrders.length}</span>
              </div>

              {colOrders.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  <div style={{ fontSize: 20 }}>📭</div>
                  <div className="empty-state-desc">No orders</div>
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
                    {order.pickupZone && (
                      <div className="order-card-meta" style={{ marginTop: 3 }}>
                        📍 {order.pickupZone} → {order.dropoffZone}
                        {order.weightClass && (
                          <span style={{
                            marginLeft: 6, fontSize: 10, padding: '1px 5px',
                            borderRadius: 4, background: 'var(--blue-dim)', color: 'var(--blue)'
                          }}>
                            {order.weightClass}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
