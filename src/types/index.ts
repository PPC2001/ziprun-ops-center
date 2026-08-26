export type AgentStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type OrderStatus = 'ASSIGNED' | 'REASSIGNMENT_PENDING' | 'REASSIGNED' | 'DELIVERED';
export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type TriggerReason = 'INITIAL' | 'AGENT_OFFLINE';
export type WeightClass = 'LIGHT' | 'HEAVY';

export interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: AgentStatus;
  currentOrderCount: number;
  currentZone: string | null;
  maxCapacity: number | null;
  createdAt: string;
}

export interface Order {
  id: number;
  description: string;
  customerName: string;
  deliveryAddress: string;
  assignedAgent: Agent | null;
  status: OrderStatus;
  pickupZone: string | null;
  dropoffZone: string | null;
  weightClass: WeightClass | null;
  slaDeadline: string | null;
  createdAt: string;
}

export interface Suggestion {
  id: number;
  order: Order;
  recommendedAgent: Agent;
  confidenceScore: number;
  aiReasoning: string;
  status: SuggestionStatus;
  triggerReason: TriggerReason;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateOrderPayload {
  description: string;
  customerName: string;
  deliveryAddress: string;
  agentId: number;
  pickupZone?: string;
  dropoffZone?: string;
  weightClass?: WeightClass;
  slaDeadline?: string;
}

export interface DashboardStats {
  totalAgents: number;
  availableAgents: number;
  busyAgents: number;
  offlineAgents: number;
  pendingSuggestions: number;
  totalOrders: number;
  pendingOrders: number;
}
