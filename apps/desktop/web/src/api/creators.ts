import { api } from './client'
import type { Analysis, Creator } from '../types'

export const listCreators = (): Promise<Creator[]> =>
  api.get<Creator[]>('/creators').then((r) => r.data)

export const getCreator = (id: string): Promise<Creator> =>
  api.get<Creator>(`/creators/${id}`).then((r) => r.data)

export interface ChannelCollectResult {
  found: number
  created: number
  skipped: number
  ids: string[]
}

export const collectChannel = (
  url: string,
  limit = 20,
  download = true,
  autoTranscribe = true,
): Promise<ChannelCollectResult> =>
  api
    .post<ChannelCollectResult>('/creators/collect', {
      url,
      limit,
      download,
      auto_transcribe: autoTranscribe,
    })
    .then((r) => r.data)

export const analyzeCreator = (
  creatorId: string,
  providerId: string,
  model?: string,
  language = 'zh',
): Promise<Analysis> =>
  api
    .post<Analysis>(`/creators/${creatorId}/analyze`, {
      provider_id: providerId,
      model,
      language,
    })
    .then((r) => r.data)
