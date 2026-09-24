import { api } from './client'
import type { CollectRequest, TranscribeRequest, Video } from '../types'

export const listVideos = (creatorId?: string, category?: string): Promise<Video[]> =>
  api
    .get<Video[]>('/videos', {
      params: {
        ...(creatorId ? { creator_id: creatorId } : {}),
        ...(category ? { category } : {}),
      },
    })
    .then((r) => r.data)

export const collectVideo = (data: CollectRequest): Promise<Video> =>
  api.post<Video>('/videos/collect', data).then((r) => r.data)

export const collectBatch = (
  urls: string[],
  download = true,
  autoTranscribe = true,
): Promise<{ created: number; skipped: number; ids: string[] }> =>
  api
    .post<{ created: number; skipped: number; ids: string[] }>('/videos/collect/batch', {
      urls,
      download,
      auto_transcribe: autoTranscribe,
    })
    .then((r) => r.data)

export interface ImportLocalResult {
  created: number
  skipped: number
  invalid: string[]
  ids: string[]
}

/** 导入本机视频/音频文件（paths 为绝对路径，桌面端由原生文件框给出） */
export const importLocalVideos = (
  paths: string[],
  autoTranscribe = true,
): Promise<ImportLocalResult> =>
  api
    .post<ImportLocalResult>('/videos/import/local', {
      paths,
      auto_transcribe: autoTranscribe,
    })
    .then((r) => r.data)

export const getVideo = (id: string): Promise<Video> =>
  api.get<Video>(`/videos/${id}`).then((r) => r.data)

export const extractAudio = (id: string): Promise<Video> =>
  api.post<Video>(`/videos/${id}/extract-audio`).then((r) => r.data)

export const recollectVideo = (id: string): Promise<Video> =>
  api.post<Video>(`/videos/${id}/recollect`).then((r) => r.data)

export const transcribeVideo = (
  id: string,
  data: TranscribeRequest = {},
): Promise<Video> =>
  api.post<Video>(`/videos/${id}/transcribe`, data).then((r) => r.data)

export const deleteVideo = (id: string): Promise<void> =>
  api.delete(`/videos/${id}`).then(() => undefined)

export const deleteVideos = (ids: string[]): Promise<{ deleted: number; not_found: string[] }> =>
  api
    .post<{ deleted: number; not_found: string[] }>('/videos/delete/batch', { ids })
    .then((r) => r.data)

export const exportVideosCsv = (): Promise<{ path: string; rows: number; scored: number }> =>
  api
    .post<{ path: string; rows: number; scored: number }>('/videos/export/csv')
    .then((r) => r.data)

export const fetchComments = (id: string, limit = 100): Promise<{ count: number }> =>
  api
    .post<{ count: number }>(`/videos/${id}/comments/fetch`, null, { params: { limit } })
    .then((r) => r.data)

export interface VideoComment {
  author: string
  text: string
  like_count: number
}

export const getComments = (id: string): Promise<{ count: number; comments: VideoComment[] }> =>
  api
    .get<{ count: number; comments: VideoComment[] }>(`/videos/${id}/comments`)
    .then((r) => r.data)
