export interface Provider {
  id: string
  name: string
  kind: 'openai_compat' | 'anthropic'
  base_url: string
  api_key: string
  default_model: string
  /** 可选模型列表（clawbox 导入/手动维护），分析时下拉可选 */
  models?: string[]
  /** 默认服务商：分析时预选，全表至多一个 */
  is_default?: boolean
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
  creator_id: string | null
  cover_url: string
  cover_path: string
  duration_sec: number
  like_count: number
  comment_count: number
  share_count: number
  favorite_count: number
  source_id: string
  music: string
  comments_fetched: number
  published_at: string | null
  view_count: number
  media_path: string
  audio_path: string
  category: string
  tags: string
  status: string
  progress: number
  error: string
  created_at: string
  updated_at: string
}

export interface Creator {
  id: string
  platform: string
  author_id: string
  name: string
  avatar_url: string
  channel_url: string
  video_count: number
}

export interface CollectRequest {
  url: string
  download: boolean
  auto_transcribe?: boolean
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
  creator_id: string | null
  template: string
  provider_id: string
  model: string
  language: string
  status: string
  progress: number
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
  { value: 'classify', label: '内容分类' },
  { value: 'score', label: '爆款五维评分' },
  { value: 'deep', label: '深度拆解(15维)' },
  { value: 'comments', label: '用户洞察(评论)' },
  { value: 'recreate', label: '二创生成' },
] as const

export const TEMPLATE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ANALYSIS_TEMPLATES.map((t) => [t.value, t.label])),
  // 博主级模板：不进 ANALYSIS_TEMPLATES（单视频分析面板的下拉），只做展示映射
  creator_profile: '博主画像分析',
}
