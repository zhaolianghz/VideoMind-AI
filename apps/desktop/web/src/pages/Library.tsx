import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteVideo, extractAudio, fetchComments, getComments, listVideos, recollectVideo, transcribeVideo } from '../api/videos'
import type { VideoComment } from '../api/videos'
import { analyzeCreator, listCreators } from '../api/creators'
import { getTranscript, updateTranscript } from '../api/transcripts'
import { listProviders } from '../api/providers'
import { createAnalysis } from '../api/analyses'
import { ANALYSIS_TEMPLATES } from '../types'
import type { Creator, Provider, Transcript, Video } from '../types'
import { api } from '../api/client'

const coverSrc = (v: Video) =>
  v.cover_path ? `${api.defaults.baseURL}/videos/${v.id}/cover` : v.cover_url

const PROCESSING = new Set(['collecting', 'extracting', 'transcribing'])

const STAGE_LABELS: Record<string, string> = {
  collecting: '采集中',
  extracting: '提取音频',
  transcribing: '转录中',
}

/** 处理中状态的进度条（青色霓虹） */
export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] transition-all duration-500"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-cyan-300">
        {label ? `${label} ` : ''}{pct}%
      </span>
    </div>
  )
}

function statusStyle(s: string): string {
  if (s === 'transcribed') return 'bg-cyan-500/15 text-cyan-400'
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
  const [creators, setCreators] = useState<Creator[]>([])
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [analyzeId, setAnalyzeId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [commentsFetching, setCommentsFetching] = useState<string | null>(null)
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = () =>
    Promise.all([
      listVideos(creatorId ?? undefined, category ?? undefined),
      listCreators(),
    ])
      .then(([vs, cs]) => {
        setVideos(vs)
        setCreators(cs)
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [creatorId, category])

  const refresh = () => setTimeout(load, 500)

  const kw = q.trim().toLowerCase()
  const shown = kw
    ? videos.filter((v) =>
        [v.title, v.author, v.category, v.tags, v.url]
          .join(' ')
          .toLowerCase()
          .includes(kw),
      )
    : videos

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold">视频库</h1>
          <p className="text-sm text-neutral-500">已采集视频 · 每 3s 自动刷新状态</p>
        </div>
        <input
          className="vm-input h-9 max-w-64"
          placeholder="搜索标题 / 作者 / 标签"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(() => {
          // 已下载但未转录（不在处理中）的视频
          const untranscribed = videos.filter(
            (v) => v.media_path && v.status !== 'transcribed' && !PROCESSING.has(v.status),
          )
          return untranscribed.length > 0 ? (
            <button
              onClick={() => {
                untranscribed.forEach((v) => transcribeVideo(v.id))
                refresh()
              }}
              className="vm-btn-neon shrink-0 text-xs"
            >
              批量转录（{untranscribed.length} 条未转）
            </button>
          ) : null
        })()}
        <Link
          to="/tasks/new"
          className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          + 新建分析
        </Link>
      </div>

      {(creators.length > 1 || videos.some((v) => v.category) || category) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {creators.length > 1 && (
            <>
              <button
                onClick={() => setCreatorId(null)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  creatorId === null
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                全部
              </button>
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCreatorId(creatorId === c.id ? null : c.id)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    creatorId === c.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {c.name || '(未知博主)'}
                  <span className="ml-1 opacity-60">{c.video_count}</span>
                </button>
              ))}
            </>
          )}
          {(videos.some((v) => v.category) || category) && (
            <select
              value={category ?? ''}
              onChange={(e) => setCategory(e.target.value || null)}
              className="vm-select ml-auto h-8 py-1 text-xs"
            >
              <option value="">全部分类</option>
              {Array.from(
                new Set([
                  ...videos.map((v) => v.category).filter(Boolean),
                  ...(category ? [category] : []),
                ]),
              ).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {creatorId && (
        <CreatorProfilePanel
          creator={creators.find((c) => c.id === creatorId)}
          videos={videos}
        />
      )}
      {loading ? (
        <div className="text-neutral-500">加载中…</div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">
            {creatorId ? '该博主暂无视频' : '还没有视频'}
          </p>
          {!creatorId && (
            <Link to="/tasks/new" className="mt-2 inline-block text-sm text-cyan-400">
              去新建第一个分析任务 →
            </Link>
          )}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">没有匹配「{q}」的视频</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((v) => {
            const busy = PROCESSING.has(v.status)
            return (
              <div key={v.id} className="vm-card">
                <div className="flex items-center gap-4 p-4">
                <img
                  src={coverSrc(v)}
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
                    {v.category && (
                      <button
                        onClick={() => setCategory(category === v.category ? null : v.category)}
                        className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-400 hover:bg-sky-500/20"
                      >
                        {v.category}
                      </button>
                    )}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusStyle(v.status)}`}>
                      {busy ? `${STAGE_LABELS[v.status] ?? v.status}…` : v.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm text-neutral-500">
                    {v.creator_id ? (
                      <button
                        onClick={() => setCreatorId(v.creator_id)}
                        className="hover:text-cyan-400 hover:underline"
                      >
                        {v.author}
                      </button>
                    ) : (
                      v.author
                    )}
                    {' · '}{fmtDur(v.duration_sec)} · {v.view_count.toLocaleString()} 播放
                  </div>
                  {busy && <ProgressBar pct={v.progress ?? 0} />}
                  {v.status === 'failed' && v.error && (
                    <div className="mt-1 line-clamp-2 text-xs text-red-400" title={v.error}>
                      ⚠ {v.error}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {v.status === 'failed' && (
                    <button
                      onClick={() => recollectVideo(v.id).then(refresh)}
                      className="rounded-lg border border-amber-700 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-950"
                    >
                      重新采集
                    </button>
                  )}
                  {!busy && v.status !== 'failed' && (
                    <button
                      onClick={() => {
                        // 已抓过 → 展开查看评论内容；没抓过 → 抓取
                        if (v.comments_fetched > 0) {
                          setCommentsOpenId(commentsOpenId === v.id ? null : v.id)
                          return
                        }
                        setCommentsFetching(v.id)
                        fetchComments(v.id)
                          .then(() => {
                            refresh()
                            setCommentsOpenId(v.id)
                          })
                          .catch((e: unknown) => {
                            const anyE = e as { response?: { data?: { detail?: string } } }
                            alert(anyE?.response?.data?.detail ?? String(e))
                          })
                          .finally(() => setCommentsFetching(null))
                      }}
                      disabled={commentsFetching === v.id}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                        commentsOpenId === v.id
                          ? 'border-sky-500 bg-sky-950 text-sky-300'
                          : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                      }`}
                      title="抓取并查看热门评论；内容会用于「用户洞察」分析并注入深度拆解"
                    >
                      {commentsFetching === v.id
                        ? '抓取中…'
                        : commentsOpenId === v.id
                          ? '收起评论'
                          : v.comments_fetched > 0
                            ? `评论 ${v.comments_fetched}`
                            : '抓评论'}
                    </button>
                  )}
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
                      className="rounded-lg border border-cyan-800 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-950"
                    >
                      转录
                    </button>
                  )}
                  {v.status === 'transcribed' && (
                    <>
                      <button
                        onClick={() => setActiveId(activeId === v.id ? null : v.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          activeId === v.id
                            ? 'border-sky-500 bg-sky-950 text-sky-300'
                            : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {activeId === v.id ? '收起' : '字幕'}
                      </button>
                      <button
                        onClick={() => setAnalyzeId(analyzeId === v.id ? null : v.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          analyzeId === v.id
                            ? 'border-cyan-500 bg-cyan-950 text-cyan-300'
                            : 'border-cyan-800 text-cyan-300 hover:bg-cyan-950'
                        }`}
                      >
                        {analyzeId === v.id ? '收起' : '分析'}
                      </button>
                    </>
                  )}
                  <Link
                    to={`/videos/${v.id}`}
                    className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    查看
                  </Link>
                  <button
                    onClick={() =>
                      confirmDelId === v.id
                        ? deleteVideo(v.id).then(() => {
                            setConfirmDelId(null)
                            load()
                          })
                        : setConfirmDelId(v.id)
                    }
                    onMouseLeave={() => confirmDelId === v.id && setConfirmDelId(null)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                      confirmDelId === v.id
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'text-red-400 hover:text-red-300'
                    }`}
                  >
                    {confirmDelId === v.id ? '确认删除？' : '删除'}
                  </button>
                </div>
                </div>

                {activeId === v.id && <TranscriptPanel videoId={v.id} />}

                {commentsOpenId === v.id && (
                  <CommentsPanel
                    videoId={v.id}
                    onRefetch={() => {
                      setCommentsFetching(v.id)
                      fetchComments(v.id)
                        .then(refresh)
                        .catch((e: unknown) => {
                          const anyE = e as { response?: { data?: { detail?: string } } }
                          alert(anyE?.response?.data?.detail ?? String(e))
                        })
                        .finally(() => setCommentsFetching(null))
                    }}
                  />
                )}

                {analyzeId === v.id && (
                  <AnalyzePanel video={v} onClose={() => setAnalyzeId(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

function CreatorProfilePanel({
  creator,
  videos,
}: {
  creator: Creator | undefined
  videos: Video[]
}) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avgScore, setAvgScore] = useState<number | null>(null)

  useEffect(() => {
    listProviders().then((ps) => setProviders(ps.filter((p) => p.enabled)))
  }, [])

  // 该博主已评分视频的平均总分（五维评分模板）
  useEffect(() => {
    if (!creator) return
    import('../api/analyses').then(({ listAnalyses }) =>
      listAnalyses().then((as) => {
        const ids = new Set(videos.map((v) => v.id))
        const totals = as
          .filter((a) => a.template === 'score' && a.status === 'done' && ids.has(a.video_id))
          .map((a) => (a.parsed as { total?: number }).total ?? 0)
        setAvgScore(totals.length ? Math.round(totals.reduce((x, y) => x + y, 0) / totals.length) : null)
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator?.id, videos.length])

  if (!creator) return null
  const transcribed = videos.filter((v) => v.status === 'transcribed').length

  const submit = () => {
    if (!providers[0]) return
    setError(null)
    setSubmitting(true)
    analyzeCreator(creator.id, providers[0].id)
      .then(() => setDone(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
      <span className="font-medium">{creator.name}</span>
      <span className="text-xs text-neutral-500">
        {creator.video_count} 个视频 · {transcribed} 个已转录
      </span>
      {avgScore !== null && (
        <span
          className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-xs text-cyan-400"
          title="该博主已评分视频的平均五维总分（0-50）"
        >
          均分 {avgScore}/50
        </span>
      )}
      {done ? (
        <span className="text-cyan-400">
          ✓ 博主画像分析已提交
          <Link to="/reports" className="ml-2 underline">去报告中心 →</Link>
        </span>
      ) : (
        <button
          onClick={submit}
          disabled={submitting || transcribed === 0 || providers.length === 0}
          title={
            transcribed === 0
              ? '需要至少 1 个已转录视频'
              : providers.length === 0
                ? '请先配置模型服务商'
                : ''
          }
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {submitting ? '提交中…' : '分析该博主'}
        </button>
      )}
      {error && <span className="text-xs text-red-400">⚠ {error}</span>}
    </div>
  )
}

function TranscriptPanel({ videoId }: { videoId: string }) {
  const [t, setT] = useState<Transcript | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    getTranscript(videoId)
      .then(setT)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
  }, [videoId])

  const commitEdit = () => {
    if (editIdx === null || !t) return
    if (draft.trim() !== t.segments[editIdx].text) {
      const next = [...t.segments]
      next[editIdx] = { ...next[editIdx], text: draft.trim() }
      setT({ ...t, segments: next })
      setDirty(true)
    }
    setEditIdx(null)
  }

  const save = () => {
    if (!t) return
    updateTranscript(videoId, t.segments)
      .then(() => {
        setDirty(false)
        setSaveMsg('已保存，重新发起分析即可基于修正后的文本')
      })
      .catch((e: unknown) =>
        setSaveMsg(`保存失败：${e instanceof Error ? e.message : String(e)}`),
      )
  }

  return (
    <div className="border-t border-white/5 px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {t ? `${t.asr_model} · ${t.language} · ${t.segments.length} 段 · 点击文字可纠错` : ''}
        </p>
        {dirty && (
          <button onClick={save} className="vm-btn-primary text-xs">
            保存修改
          </button>
        )}
      </div>
      {saveMsg && (
        <div className="mb-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-300">
          {saveMsg}
        </div>
      )}
      <div className="max-h-80 space-y-1 overflow-auto text-sm">
        {err && <div className="text-red-400">{err}</div>}
        {!t && !err && <div className="text-neutral-500">加载中…</div>}
        {t?.segments.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-lg px-2 py-1 hover:bg-neutral-800">
            <span className="shrink-0 font-mono text-xs text-neutral-500">{fmtTs(s.start)}</span>
            {editIdx === i ? (
              <input
                className="vm-input flex-1 py-0.5 text-sm"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditIdx(null)
                }}
              />
            ) : (
              <span
                className="cursor-text text-neutral-200 hover:text-cyan-200"
                onClick={() => {
                  setEditIdx(i)
                  setDraft(s.text)
                }}
              >
                {s.text}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CommentsPanel({ videoId, onRefetch }: { videoId: string; onRefetch: () => void }) {
  const [comments, setComments] = useState<VideoComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getComments(videoId)
      .then((r) => setComments([...r.comments].sort((a, b) => b.like_count - a.like_count)))
      .finally(() => setLoading(false))
  }, [videoId])

  return (
    <div className="vm-row-detail border-t border-white/5 px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-300">
          热门评论（{comments.length} 条，按点赞排序）
        </span>
        <button onClick={onRefetch} className="text-xs text-neutral-500 hover:text-cyan-300">
          重新抓取
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-neutral-500">加载中…</div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {comments.map((c, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="truncate">{c.author || '匿名'}</span>
                {c.like_count > 0 && (
                  <span className="shrink-0 font-mono text-cyan-400/80">♥ {c.like_count}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function AnalyzePanel({ video, onClose }: { video: Video; onClose: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [template, setTemplate] = useState('business')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)

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
      .then((a) => setDoneId(a.id))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="border-t border-white/5 px-4 pb-4 pt-3">

      {doneId ? (
        <div className="flex items-center gap-3 py-2 text-sm">
          <span className="text-cyan-400">✓ 分析已提交，后台运行中</span>
          <Link to={`/reports/${doneId}`} className="text-cyan-400 underline" onClick={onClose}>
            打开报告页查看进度 →
          </Link>
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          还没有可用的模型服务商。
          <Link to="/providers" className="ml-1 underline">去配置 →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-neutral-500">模板</span>
            {ANALYSIS_TEMPLATES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTemplate(t.value)}
                className={`vm-chip ${template === t.value ? 'vm-chip-on' : 'vm-chip-off'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <select
              className="vm-select h-9 w-44 shrink-0"
              value={providerId}
              onChange={(e) => pickProvider(e.target.value)}
              title="服务商"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              className="vm-input h-9 flex-1 font-mono text-xs"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="模型 ID（留空用服务商默认）"
            />
            <button
              onClick={submit}
              disabled={submitting || !providerId}
              className="vm-btn-primary h-9 shrink-0 px-6"
            >
              {submitting ? '提交中…' : '开始分析'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
