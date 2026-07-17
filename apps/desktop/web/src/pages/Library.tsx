import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteVideo, extractAudio, listVideos, transcribeVideo } from '../api/videos'
import { getTranscript } from '../api/transcripts'
import { listProviders } from '../api/providers'
import { createAnalysis } from '../api/analyses'
import { ANALYSIS_TEMPLATES } from '../types'
import type { Provider, Transcript, Video } from '../types'

const PROCESSING = new Set(['collecting', 'extracting', 'transcribing'])

function statusStyle(s: string): string {
  if (s === 'transcribed') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'failed') return 'bg-red-500/15 text-red-400'
  if (PROCESSING.has(s)) return 'bg-amber-500/15 text-amber-400'
  return 'bg-white/5 text-neutral-400'
}

function fmtDur(sec: number): string {
  if (!sec) return '--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function Library() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [analyzeTarget, setAnalyzeTarget] = useState<Video | null>(null)

  const load = () =>
    listVideos()
      .then(setVideos)
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [])

  const refresh = () => setTimeout(load, 500)

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">视频库</h1>
          <p className="text-sm text-neutral-500">已采集视频 · 每 3s 自动刷新状态</p>
        </div>
        <Link
          to="/tasks/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + 新建分析
        </Link>
      </div>

      {loading ? (
        <div className="text-neutral-500">加载中…</div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">还没有视频</p>
          <Link to="/tasks/new" className="mt-2 inline-block text-sm text-emerald-400">
            去新建第一个分析任务 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => {
            const busy = PROCESSING.has(v.status)
            return (
              <div
                key={v.id}
                className="flex items-center gap-4 vm-card p-4"
              >
                <img
                  src={v.cover_url}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded-lg bg-neutral-800 object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{v.title || '(无标题)'}</span>
                    <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">
                      {v.platform}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusStyle(v.status)}`}>
                      {busy ? `${v.status}…` : v.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm text-neutral-500">
                    {v.author} · {fmtDur(v.duration_sec)} · {v.view_count.toLocaleString()} 播放
                  </div>
                  {v.status === 'failed' && v.error && (
                    <div className="mt-1 truncate text-xs text-red-400">⚠ {v.error}</div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {v.media_path && !v.audio_path && !busy && (
                    <button
                      onClick={() => extractAudio(v.id).then(refresh)}
                      className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                    >
                      提取音频
                    </button>
                  )}
                  {v.audio_path && v.status !== 'transcribed' && !busy && (
                    <button
                      onClick={() => transcribeVideo(v.id).then(refresh)}
                      className="rounded-lg border border-emerald-800 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-950"
                    >
                      转录
                    </button>
                  )}
                  {v.status === 'transcribed' && (
                    <>
                      <button
                        onClick={() => setActiveId(v.id)}
                        className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                      >
                        字幕
                      </button>
                      <button
                        onClick={() => setAnalyzeTarget(v)}
                        className="rounded-lg border border-emerald-800 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-950"
                      >
                        分析
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteVideo(v.id).then(load)}
                    className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:text-red-300"
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeId && <TranscriptModal videoId={activeId} onClose={() => setActiveId(null)} />}
      {analyzeTarget && (
        <AnalyzeModal
          video={analyzeTarget}
          onClose={() => setAnalyzeTarget(null)}
        />
      )}
    </div>
  )
}

function TranscriptModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const [t, setT] = useState<Transcript | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getTranscript(videoId)
      .then(setT)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
  }, [videoId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col vm-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            字幕
            {t && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {t.asr_model} · {t.language} · {t.segments.length} 段
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
        <div className="space-y-1 overflow-auto text-sm">
          {err && <div className="text-red-400">{err}</div>}
          {!t && !err && <div className="text-neutral-500">加载中…</div>}
          {t?.segments.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-lg px-2 py-1 hover:bg-neutral-800">
              <span className="shrink-0 font-mono text-xs text-neutral-500">{fmtTs(s.start)}</span>
              <span className="text-neutral-200">{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AnalyzeModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [template, setTemplate] = useState('business')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    listProviders().then((ps) => {
      const enabled = ps.filter((p) => p.enabled)
      setProviders(enabled)
      if (enabled[0]) {
        setProviderId(enabled[0].id)
        setModel(enabled[0].default_model)
      }
    })
  }, [])

  const pickProvider = (id: string) => {
    setProviderId(id)
    setModel(providers.find((p) => p.id === id)?.default_model || '')
  }

  const submit = () => {
    setSubmitting(true)
    createAnalysis({ video_id: video.id, template, provider_id: providerId, model: model || undefined })
      .then(() => setDone(true))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-md vm-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">发起 AI 分析</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="mb-3 text-emerald-400">✓ 分析已提交，后台运行中</div>
            <Link to="/reports" className="text-sm text-emerald-400 underline" onClick={onClose}>
              去报告中心查看 →
            </Link>
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-300">
            还没有可用的模型服务商。
            <Link to="/providers" className="ml-1 underline">去配置 →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="truncate text-xs text-neutral-500">视频：{video.title || video.url}</div>
            <div>
              <label className="mb-1 block text-sm text-neutral-400">分析模板</label>
              <select className="vm-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {ANALYSIS_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-400">服务商</label>
              <select className="vm-input" value={providerId} onChange={(e) => pickProvider(e.target.value)}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-400">模型</label>
              <input className="vm-input" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <button
              onClick={submit}
              disabled={submitting || !providerId}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? '提交中…' : '开始分析'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
