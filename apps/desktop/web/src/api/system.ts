import { api } from './client'
import type { HealthStatus } from '../types'

export const getHealth = (): Promise<HealthStatus> =>
  api.get<HealthStatus>('/system/healthz').then((r) => r.data)
