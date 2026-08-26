import { apiClient } from './client';
import type { Suggestion, SuggestionStatus } from '../types';

export const suggestionApi = {
  getAll: (status?: SuggestionStatus) =>
    apiClient
      .get<Suggestion[]>('/suggestions', { params: status ? { status } : {} })
      .then((r) => r.data),
  getById: (id: number) =>
    apiClient.get<Suggestion>(`/suggestions/${id}`).then((r) => r.data),
  resolve: (id: number, status: SuggestionStatus) =>
    apiClient.patch<Suggestion>(`/suggestions/${id}`, { status }).then((r) => r.data),
};
