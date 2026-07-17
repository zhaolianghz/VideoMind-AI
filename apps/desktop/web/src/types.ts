export interface Provider {
  id: string
  name: string
  kind: 'openai_compat' | 'anthropic'
  base_url: string
  api_key: string
  default_model: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface HealthStatus {
  status: string
  service: string
  version: string
}

export type ProviderDraft = Omit<Provider, 'id' | 'created_at' | 'updated_at'>

export interface Video {
  id: string
  url: string
  platform: string
  title: string
  author: string
  cover_url: string
  duration_sec: number
  published_at: string | null
  view_count: number
  media_path: string
  audio_path: string
  status: string
  error: string
  created_at: string
  updated_at: string
}

export interface CollectRequest {
  url: string
  download: boolean
}

export interface TranscribeRequest {
  model?: string
  language?: string
  vad_filter?: boolean
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  id: string
  video_id: string
  asr_model: string
  language: string
  duration_sec: number
  segments: TranscriptSegment[]
  srt_path: string
  vtt_path: string
  created_at: string
}

export interface Analysis {
  id: string
  video_id: string
  template: string
  provider_id: string
  model: string
  language: string
  status: string
  parsed: Record<string, unknown>
  chunks: number
  error: string
  created_at: string
  updated_at: string
}

export interface AnalyzeRequest {
  video_id: string
  template: string
  provider_id: string
  model?: string
  language?: string
}

export const ANALYSIS_TEMPLATES = [
  { value: 'summary', label: '视频摘要' },
  { value: 'keypoints', label: '核心观点' },
  { value: 'business', label: '商业模式分析' },
  { value: 'course', label: '课程拆解分析' },
  { value: 'viral', label: '爆款规律分析' },
] as const

export const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  ANALYSIS_TEMPLATES.map((t) => [t.value, t.label]),
)
