import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getVideo } from '../api/videos'
import { getTranscript } from '../api/transcripts'
import { listAnalyses } from '../api/analyses'
import { api } from '../api/client'
import type { Analysis, Transcript, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const LABELS: Record<string, string> = {
  summary: '摘要', point: '观点', evidence: '论据',
  target_users: '目标用户', monetization: '盈利方式', growth_strategy: '增长策略',
  competitive_edge: '竞争优势', risks: '风险', opportunities: '机会',
  chapter: '章节', topics: '知识点', knowledge_points: '知识点列表',
  cases: '案例', target_audience: '适合人群',
  title_patterns: '标题规律', hook_analysis: '开头钩子分析', content_structure: '内容结构',
  spread_mechanism: '传播机制', replication_model: '复制模型',
}

export function VideoDetail() {
  const { id = '' } = useParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selAnalysis, setSelAnalysis] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    getVideo(id).then(setVideo)
    getTranscript(id).then(setTranscript).catch(() => {})
    listAnalyses(id).then((a) => {
      setAnalyses(a)
      if (a[0]) setSelAnalysis(a[0].id)
    })
  }, [id])

  const jumpTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t
  }

  const current = analyses.find((a) => a.id === selAnalysis)
  const mediaUrl = `${api.defaults.baseURL ?? '/api/v1'}/media/${id}`

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/library" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← 视频库
        </Link>
        <h1 className="truncate text-lg font-bold">{video?.title || '加载中…'}</h1>
        {video && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
            {video.platform}
          </span>
        )}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        {/* 左：播放器 + 字幕 */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <video
            ref={videoRef}
            src={mediaUrl}
            controls
            className="aspect-video w-full rounded-xl bg-black object-contain"
          />
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-neutral-900/80">
            <div className="border-b border-white/10 px-4 py-2 text-xs text-neutral-500">
              字幕 {transcript ? `· ${transcript.asr_model} · ${transcript.language}` : ''}
            </div>
            <div className="flex-1 overflow-auto p-2">
              {!transcript && <div className="p-4 text-sm text-neutral-500">无字幕</div>}
              {transcript?.segments.map((s, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(s.start)}
                  className="flex w-full gap-3 rounded px-2 py-1 text-left text-sm hover:bg-white/5"
                >
                  <span className="shrink-0 font-mono text-xs text-emerald-400">
                    {fmtTs(s.start)}
                  </span>
                  <span className="text-neutral-200">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右：报告 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/80">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <span className="text-xs text-neutral-500">分析报告</span>
            {analyses.length > 0 && (
              <select
                className="ml-auto rounded border border-white/10 bg-neutral-800 px-2 py-0.5 text-xs"
                value={selAnalysis}
                onChange={(e) => setSelAnalysis(e.target.value)}
              >
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {TEMPLATE_LABELS[a.template] || a.template}
                  </option>
                ))}
              </select>
            )}
            {current && (
              <a
                href={`${api.defaults.baseURL ?? '/api/v1'}/reports/${current.id}/export?fmt=pdf`}
                className="rounded border border-emerald-800 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-950"
              >
                导出
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {analyses.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-500">
                无分析报告
                <Link to="/library" className="mt-2 block text-emerald-400">
                  去发起分析 →
                </Link>
              </div>
            ) : current ? (
              <ParsedView data={current.parsed} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function ParsedView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(data)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 text-sm font-semibold text-emerald-400">
              {LABELS[k] || k}
            </div>
            <ValueView value={v} />
          </div>
        ))}
    </div>
  )
}

function ValueView({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <div className="text-sm text-neutral-600">—</div>
    if (typeof value[0] === 'object' && value[0] !== null) {
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="rounded-lg border border-white/10 p-3">
              <ParsedView data={item as Record<string, unknown>} />
            </div>
          ))}
        </div>
      )
    }
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-200">
        {value.map((it, i) => (
          <li key={i}>{String(it)}</li>
        ))}
      </ul>
    )
  }
  if (value && typeof value === 'object') {
    return (
      <div className="rounded-lg border border-white/10 p-3">
        <ParsedView data={value as Record<string, unknown>} />
      </div>
    )
  }
  return <p className="text-sm leading-relaxed text-neutral-200">{String(value)}</p>
}
