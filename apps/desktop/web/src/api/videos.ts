import { api } from './client'
import type { CollectRequest, TranscribeRequest, Video } from '../types'

export const listVideos = (): Promise<Video[]> =>
  api.get<Video[]>('/videos').then((r) => r.data)

export const collectVideo = (data: CollectRequest): Promise<Video> =>
  api.post<Video>('/videos/collect', data).then((r) => r.data)

export const collectBatch = (
  urls: string[],
  download = true,
): Promise<{ created: number; ids: string[] }> =>
  api
    .post<{ created: number; ids: string[] }>('/videos/collect/batch', {
      urls,
      download,
    })
    .then((r) => r.data)

export const getVideo = (id: string): Promise<Video> =>
  api.get<Video>(`/videos/${id}`).then((r) => r.data)

export const extractAudio = (id: string): Promise<Video> =>
  api.post<Video>(`/videos/${id}/extract-audio`).then((r) => r.data)

export const transcribeVideo = (
  id: string,
  data: TranscribeRequest = {},
): Promise<Video> =>
  api.post<Video>(`/videos/${id}/transcribe`, data).then((r) => r.data)

export const deleteVideo = (id: string): Promise<void> =>
  api.delete(`/videos/${id}`).then(() => undefined)
