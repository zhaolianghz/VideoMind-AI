import { api } from './client'
import type { HealthStatus } from '../types'

export const getHealth = (): Promise<HealthStatus> =>
  api.get<HealthStatus>('/system/healthz').then((r) => r.data)

export type PathsInfo = Record<string, string>

export const getPaths = (): Promise<PathsInfo> =>
  api.get<PathsInfo>('/system/paths').then((r) => r.data)
