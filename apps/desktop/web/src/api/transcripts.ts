import { api } from './client'
import type { Transcript } from '../types'

export const getTranscript = (videoId: string): Promise<Transcript> =>
  api.get<Transcript>(`/transcripts/${videoId}`).then((r) => r.data)

export const getSrt = (videoId: string): Promise<string> =>
  api
    .get<string>(`/transcripts/${videoId}?fmt=srt`, {
      responseType: 'text',
      transformResponse: (x) => x,
    })
    .then((r) => r.data)

export interface SegmentEdit {
  start: number
  end: number
  text: string
}

export const updateTranscript = (
  videoId: string,
  segments: SegmentEdit[],
): Promise<{ segments: number; saved: boolean }> =>
  api
    .put<{ segments: number; saved: boolean }>(`/transcripts/${videoId}`, { segments })
    .then((r) => r.data)
