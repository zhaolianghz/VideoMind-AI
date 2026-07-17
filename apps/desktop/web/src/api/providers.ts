import { api } from './client'
import type { Provider, ProviderDraft } from '../types'

export const listProviders = (): Promise<Provider[]> =>
  api.get<Provider[]>('/settings/providers').then((r) => r.data)

export const createProvider = (data: ProviderDraft): Promise<Provider> =>
  api.post<Provider>('/settings/providers', data).then((r) => r.data)

export const updateProvider = (id: string, data: ProviderDraft): Promise<Provider> =>
  api.put<Provider>(`/settings/providers/${id}`, data).then((r) => r.data)

export const deleteProvider = (id: string): Promise<void> =>
  api.delete(`/settings/providers/${id}`).then(() => undefined)
