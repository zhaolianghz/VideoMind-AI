import { api } from './client'
import type { Provider, ProviderDraft } from '../types'

export const listProviders = (): Promise<Provider[]> =>
  api.get<Provider[]>('/settings/providers').then((r) => r.data)

export const createProvider = (data: ProviderDraft): Promise<Provider> =>
  api.post<Provider>('/settings/providers', data).then((r) => r.data)

export const updateProvider = (id: string, data: Partial<ProviderDraft>): Promise<Provider> =>
  api.put<Provider>(`/settings/providers/${id}`, data).then((r) => r.data)

export const deleteProvider = (id: string): Promise<void> =>
  api.delete(`/settings/providers/${id}`).then(() => undefined)

export interface ProviderTestResult {
  success: boolean
  message: string
  latency_ms: number
}

export const testProvider = (data: {
  kind: string
  base_url: string
  api_key: string
  model: string
  provider_id?: string
}): Promise<ProviderTestResult> =>
  api.post<ProviderTestResult>('/settings/providers/test', data).then((r) => r.data)

export interface ClawboxImportResult {
  created: number
  updated: number
  skipped: number
}

/** 一键导入 ~/.clawbox/config.json 的服务商（后端直读本地文件，同名更新覆盖） */
export const importClawboxProviders = (): Promise<ClawboxImportResult> =>
  api.post<ClawboxImportResult>('/settings/providers/import/clawbox').then((r) => r.data)
