import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listVideos } from '../api/videos'
import { listAnalyses } from '../api/analyses'
import { listCreators } from '../api/creators'
import type { Analysis, Creator, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'

/** 处理中的视频状态（采集/抽音频/转录中） */
const BUSY_VIDEO = new Set(['collecting', 'extracting', 'transcribing'])

export function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      Promise.all([listVideos(), listAnalyses(), listCreators()])
        .then(([vs, as, cs]) => {
          if (!alive) return
          setVideos(vs)
          setAnalyses(as)
          setCreators(cs)
          setErr(null)
        })
        .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : String(e)))
    load()
    const id = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const done = analyses.filter((a) => a.status === 'done')
  // 已分析视频 = 至少有一份完成报告的视频（去重）
  const analyzedVideos = new Set(done.filter((a) => a.video_id).map((a) => a.video_id)).size
  const busy =
    videos.filter((v) => BUSY_VIDEO.has(v.status)).length +
    analyses.filter((a) => a.status === 'running' || a.status === 'pending').length

  const cards = [
    { label: '视频库', value: videos.length, to: '/library' },
    { label: '已分析视频', value: analyzedVideos, to: '/library' },
    { label: '分析报告', value: done.length, to: '/reports' },
    { label: '博主', value: creators.length, to: '/library' },
  ]

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">工作台</h1>
      <p className="mb-8 text-neutral-500">AI 视频情报分析系统</p>

      {err && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          后端未连接：{err}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="vm-card block p-5 hover:border-cyan-400/30">
            <div className="text-sm text-neutral-500">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </Link>
        ))}
      </div>

      {busy > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-neutral-300">{busy} 个任务处理中</span>
          <Link to="/library" className="ml-auto text-cyan-400 hover:underline">
            查看进度 →
          </Link>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-300">最近报告</h2>
            <Link to="/reports" className="text-xs text-cyan-400 hover:underline">
              全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {[...done]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 5)
              .map((a) => {
                const v = videos.find((x) => x.id === a.video_id)
                return (
                  <Link
                    key={a.id}
                    to={`/reports/${a.id}`}
                    className="vm-card flex items-center gap-3 p-3 text-sm hover:border-cyan-400/30"
                  >
                    <span className="shrink-0 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400">
                      {TEMPLATE_LABELS[a.template] || a.template}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-300">
                      {v?.title || (a.creator_id ? '博主画像' : '(无标题)')}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                )
              })}
          </div>
        </div>
      )}

      {videos.length === 0 && !err && (
        <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-500">还没有视频，从新建分析开始</p>
          <Link
            to="/tasks/new"
            className="mt-3 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-cyan-400"
          >
            ＋ 新建分析
          </Link>
        </div>
      )}
    </div>
  )
}
