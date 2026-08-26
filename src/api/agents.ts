import { apiClient } from './client';
import type { Agent, AgentStatus } from '../types';

export const agentApi = {
  getAll: () => apiClient.get<Agent[]>('/agents').then((r) => r.data),
  getById: (id: number) => apiClient.get<Agent>(`/agents/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: AgentStatus) =>
    apiClient.patch<Agent>(`/agents/${id}/status`, { status }).then((r) => r.data),
};
