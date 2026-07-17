import { api } from './client'
import type { Analysis, AnalyzeRequest } from '../types'

export const listAnalyses = (videoId?: string): Promise<Analysis[]> =>
  api
    .get<Analysis[]>('/analyses', { params: videoId ? { video_id: videoId } : {} })
    .then((r) => r.data)

export const createAnalysis = (data: AnalyzeRequest): Promise<Analysis> =>
  api.post<Analysis>('/analyses', data).then((r) => r.data)

export const getAnalysis = (id: string): Promise<Analysis> =>
  api.get<Analysis>(`/analyses/${id}`).then((r) => r.data)

export const deleteAnalysis = (id: string): Promise<void> =>
  api.delete(`/analyses/${id}`).then(() => undefined)
