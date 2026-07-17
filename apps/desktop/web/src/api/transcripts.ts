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
