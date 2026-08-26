import { apiClient } from './client';
import type { Order, OrderStatus, CreateOrderPayload, Suggestion } from '../types';

export const orderApi = {
  getAll: (status?: OrderStatus) =>
    apiClient.get<Order[]>('/orders', { params: status ? { status } : {} }).then((r) => r.data),
  getById: (id: number) => apiClient.get<Order>(`/orders/${id}`).then((r) => r.data),
  create: (payload: CreateOrderPayload) =>
    apiClient.post<Order>('/orders', payload).then((r) => r.data),
  suggest: (id: number) =>
    apiClient.post<Suggestion>(`/orders/${id}/suggest`).then((r) => r.data),
  getStreamUrl: (id: number) => `http://localhost:8080/api/orders/${id}/suggest/stream`,
};
