import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteAnalysis, listAnalyses } from '../api/analyses'
import { listVideos } from '../api/videos'
import { listCreators } from '../api/creators'
import { ProgressBar } from './Library'
import type { Analysis, Creator, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'

const PROCESSING = new Set(['running', 'pending'])

function statusStyle(s: string): string {
  if (s === 'done') return 'bg-cyan-500/15 text-cyan-400'
  if (s === 'failed') return 'bg-red-500/15 text-red-400'
  if (PROCESSING.has(s)) return 'bg-amber-500/15 text-amber-400'
  return 'bg-white/5 text-neutral-400'
}

const STATUS_LABELS: Record<string, string> = {
  done: '完成',
  failed: '失败',
  running: '分析中',
  pending: '排队中',
}

export function Reports() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Analysis[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [tpl, setTpl] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = () =>
    Promise.all([listAnalyses(), listVideos(), listCreators()])
      .then(([as, vs, cs]) => {
        setItems(as)
        setVideos(vs)
        setCreators(cs)
      })
      .finally(() => setLoading(false))
  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [])

  const videoTitle = useMemo(() => {
    const m = new Map(videos.map((v) => [v.id, v.title || '(无标题)']))
    return (id: string) => m.get(id) ?? `video ${id.slice(0, 8)}…`
  }, [videos])
  const creatorName = useMemo(() => {
    const m = new Map(creators.map((c) => [c.id, c.name || '(未知博主)']))
    return (id: string) => m.get(id) ?? `博主 ${id.slice(0, 8)}…`
  }, [creators])

  // 模板筛选 chips：只显示实际出现过的模板
  const usedTpls = useMemo(
    () => Array.from(new Set(items.map((a) => a.template))),
    [items],
  )
  const kw = q.trim().toLowerCase()
  const shown = items.filter((a) => {
    if (tpl && a.template !== tpl) return false
    if (!kw) return true
    const name = a.creator_id ? creatorName(a.creator_id) : videoTitle(a.video_id)
    return `${name} ${TEMPLATE_LABELS[a.template] || a.template}`.toLowerCase().includes(kw)
  })

  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold">报告中心</h1>
          <p className="text-neutral-500">AI 分析结果 · 每 3s 自动刷新 · 点击打开报告</p>
        </div>
        <input
          className="vm-input h-9 max-w-64"
          placeholder="搜索视频标题 / 模板"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {usedTpls.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTpl(null)}
            className={`vm-chip ${tpl === null ? 'vm-chip-on' : 'vm-chip-off'}`}
          >
            全部 {items.length}
          </button>
          {usedTpls.map((t) => (
            <button
              key={t}
              onClick={() => setTpl(tpl === t ? null : t)}
              className={`vm-chip ${tpl === t ? 'vm-chip-on' : 'vm-chip-off'}`}
            >
              {TEMPLATE_LABELS[t] || t} {items.filter((a) => a.template === t).length}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="text-neutral-500">加载中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">还没有分析报告</p>
          <Link to="/library" className="mt-2 inline-block text-sm text-cyan-400">
            去视频库发起分析 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/reports/${a.id}`)}
              className="vm-card cursor-pointer transition-colors hover:border-cyan-400/30"
            >
              <div className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{TEMPLATE_LABELS[a.template] || a.template}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle(a.status)}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                    {a.status === 'done' && (
                      <span className="text-xs text-neutral-500">
                        {a.chunks} 片段 · {a.model}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-neutral-500">
                    {a.creator_id ? creatorName(a.creator_id) : videoTitle(a.video_id)}
                    {' · '}
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  {a.status === 'failed' && a.error && (
                    <div className="mt-1 text-xs text-red-400">⚠ {a.error.slice(0, 80)}</div>
                  )}
                  {PROCESSING.has(a.status) && <ProgressBar pct={a.progress ?? 0} />}
                </div>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {a.status === 'done' && (
                    <Link to={`/reports/${a.id}`} className="vm-btn-neon text-xs">
                      打开报告
                    </Link>
                  )}
                  <button
                    onClick={() =>
                      confirmDelId === a.id
                        ? deleteAnalysis(a.id).then(() => {
                            setConfirmDelId(null)
                            load()
                          })
                        : setConfirmDelId(a.id)
                    }
                    onMouseLeave={() => confirmDelId === a.id && setConfirmDelId(null)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                      confirmDelId === a.id
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'text-red-400 hover:text-red-300'
                    }`}
                  >
                    {confirmDelId === a.id ? '确认删除？' : '删除'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
