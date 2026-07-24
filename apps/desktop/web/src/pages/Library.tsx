import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteVideo, extractAudio, fetchComments, getComments, listVideos, recollectVideo, transcribeVideo } from '../api/videos'
import type { VideoComment } from '../api/videos'
import { analyzeCreator, listCreators } from '../api/creators'
import { getTranscript, updateTranscript } from '../api/transcripts'
import { listProviders } from '../api/providers'
import { createAnalysis } from '../api/analyses'
import { ANALYSIS_TEMPLATES } from '../types'
import type { Creator, Provider, Transcript, Video } from '../types'
import { api } from '../api/client'
import { useI18n } from '../i18n'

const coverSrc = (v: Video) =>
  v.cover_path ? `${api.defaults.baseURL}/videos/${v.id}/cover` : v.cover_url

const PROCESSING = new Set(['collecting', 'extracting', 'transcribing'])

/** 评论抓取走 yt-dlp，仅这些平台支持 */
const COMMENT_PLATFORMS = new Set(['youtube'])

/** 处理中状态的进度条（青色霓虹） */
export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-accent">
        {label ? `${label} ` : ''}{pct}%
      </span>
    </div>
  )
}

function statusStyle(s: string): string {
  if (s === 'transcribed') return 'bg-accent/10 text-accent'
  if (s === 'failed') return 'bg-danger/10 text-danger'
  if (PROCESSING.has(s)) return 'bg-warning/10 text-warning'
  return 'bg-fill text-secondary'
}

function fmtDur(sec: number): string {  if (!sec) return '--'
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
  const { t } = useI18n()
  const STAGE_LABELS: Record<string, string> = {
    collecting: t('library.stageCollecting'),
    extracting: t('library.stageExtracting'),
    transcribing: t('library.stageTranscribing'),
  }
  /** 稳态状态的本地化文案（进行中状态走 STAGE_LABELS） */
  const STATUS_LABELS: Record<string, string> = {
    collected: t('library.stCollected'),
    ready: t('library.stReady'),
    transcribed: t('library.stTranscribed'),
    failed: t('library.stFailed'),
  }
  /** 平台展示名（douyin → 抖音）；无对应文案时回退原始值 */
  const platformLabel = (p: string): string => {
    const l = t('platformLabels.' + p)
    return l === 'platformLabels.' + p ? p : l
  }

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
  const [searchParams, setSearchParams] = useSearchParams()

  // 深链：/library?analyze=<videoId> —— 从视频详情「去发起分析」跳入，
  // 自动展开该视频的分析面板并滚动到行
  const analyzeParam = searchParams.get('analyze')
  useEffect(() => {
    if (!analyzeParam || videos.length === 0) return
    if (!videos.some((v) => v.id === analyzeParam)) return
    setAnalyzeId(analyzeParam)
    setSearchParams({}, { replace: true })
    setTimeout(() => {
      document.getElementById(`video-row-${analyzeParam}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeParam, videos.length])

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
        [v.title, v.author, v.category, v.tags, v.url].join(' ').toLowerCase().includes(kw),
      )
    : videos

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold">{t('library.title')}</h1>
          <p className="text-sm text-secondary">{t('library.subtitle')}</p>
        </div>
        <input
          className="vm-input h-9 max-w-64"
          placeholder={t('library.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(() => {
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
              {t('library.batchTranscribe')}（{untranscribed.length} {t('library.untranscribed')}）
            </button>
          ) : null
        })()}
        <Link
          to="/tasks/new"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          {t('library.newTask')}
        </Link>
      </div>

      {(creators.length > 1 || videos.some((v) => v.category) || category) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {creators.length > 1 && (
            <>
              <button
                onClick={() => setCreatorId(null)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  creatorId === null ? 'bg-accent text-on-accent' : 'bg-fill text-secondary hover:bg-fill'
                }`}
              >
                {t('library.all')}
              </button>
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCreatorId(creatorId === c.id ? null : c.id)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    creatorId === c.id ? 'bg-accent text-on-accent' : 'bg-fill text-secondary hover:bg-fill'
                  }`}
                >
                  {c.name || t('library.unknownCreator')}
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
              <option value="">{t('library.allCategories')}</option>
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
        <CreatorProfilePanel creator={creators.find((c) => c.id === creatorId)} videos={videos} />
      )}
      {loading ? (
        <div className="text-secondary">{t('library.loading')}</div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app py-16 text-center">
          <p className="text-secondary">{creatorId ? t('library.noCreatorVideo') : t('library.empty')}</p>
          {!creatorId && (
            <Link to="/tasks/new" className="mt-2 inline-block text-sm text-accent">
              {t('library.goNewTask')}
            </Link>
          )}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app py-16 text-center">
          <p className="text-secondary">{t('library.noMatch').replace('{q}', q)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((v) => {
            const busy = PROCESSING.has(v.status)
            return (
              <div key={v.id} id={`video-row-${v.id}`} className="vm-card">
                <div className="flex items-center gap-4 p-4">
                  <img
                    src={coverSrc(v)}
                    alt=""
                    className="h-14 w-24 shrink-0 rounded-lg bg-surface object-cover"
                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{v.title || t('library.noTitle')}</span>
                      <span className="shrink-0 rounded-full bg-fill px-1.5 py-0.5 text-xs text-secondary">
                        {platformLabel(v.platform)}
                      </span>
                      {v.category && (
                        <button
                          onClick={() => setCategory(category === v.category ? null : v.category)}
                          className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs text-accent hover:bg-accent/20"
                        >
                          {v.category}
                        </button>
                      )}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusStyle(v.status)}`}>
                        {busy
                          ? `${STAGE_LABELS[v.status] ?? v.status}…`
                          : STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-secondary">
                      {v.creator_id ? (
                        <button
                          onClick={() => setCreatorId(v.creator_id)}
                          className="hover:text-accent hover:underline"
                        >
                          {v.author}
                        </button>
                      ) : (
                        v.author
                      )}
                      {' · '}{fmtDur(v.duration_sec)} · {v.view_count.toLocaleString()} {t('library.views')}
                    </div>
                    {busy && <ProgressBar pct={v.progress ?? 0} />}
                    {v.status === 'failed' && v.error && (
                      <div className="mt-1 line-clamp-2 text-xs text-danger" title={v.error}>
                        ⚠ {v.error}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {v.status === 'failed' && (
                      <button
                        onClick={() => recollectVideo(v.id).then(refresh)}
                        className="rounded-lg border border-warning/30 px-2.5 py-1 text-xs text-warning hover:bg-warning/10"
                      >
                        {t('library.recollect')}
                      </button>
                    )}
                    {/* 评论抓取走 yt-dlp，仅 YouTube 支持；其它平台只有已抓过的才给「查看」入口 */}
                    {!busy && v.status !== 'failed' &&
                      (COMMENT_PLATFORMS.has(v.platform) || v.comments_fetched > 0) && (
                      <button
                        onClick={() => {
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
                            ? 'border-accent/40 bg-accent/10 text-accent'
                            : 'border-app text-secondary hover:bg-fill'
                        }`}
                      >
                        {commentsFetching === v.id
                          ? t('library.commentsFetching')
                          : commentsOpenId === v.id
                            ? t('library.commentsCollapse')
                            : v.comments_fetched > 0
                              ? `${t('library.commentsCount')} ${v.comments_fetched}`
                              : t('library.fetchComments')}
                      </button>
                    )}
                    {v.media_path && !v.audio_path && !busy && (
                      <button
                        onClick={() => extractAudio(v.id).then(refresh)}
                        className="rounded-lg border border-app px-2.5 py-1 text-xs text-secondary hover:bg-fill"
                      >
                        {t('library.extractAudio')}
                      </button>
                    )}
                    {v.audio_path && v.status !== 'transcribed' && !busy && (
                      <button
                        onClick={() => transcribeVideo(v.id).then(refresh)}
                        className="rounded-lg border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10"
                      >
                        {t('library.transcribe')}
                      </button>
                    )}
                    {v.status === 'transcribed' && (
                      <>
                        <button
                          onClick={() => setActiveId(activeId === v.id ? null : v.id)}
                          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                            activeId === v.id
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-app text-secondary hover:bg-fill'
                          }`}
                        >
                          {activeId === v.id ? t('library.collapse') : t('library.subtitleBtn')}
                        </button>
                        <button
                          onClick={() => setAnalyzeId(analyzeId === v.id ? null : v.id)}
                          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                            analyzeId === v.id
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-accent/40 text-accent hover:bg-accent/10'
                          }`}
                        >
                          {analyzeId === v.id ? t('library.collapse') : t('library.analyze')}
                        </button>
                      </>
                    )}
                    <Link
                      to={`/videos/${v.id}`}
                      className="rounded-lg border border-app px-2.5 py-1 text-xs text-secondary hover:bg-fill"
                    >
                      {t('library.view')}
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
                        confirmDelId === v.id ? 'bg-danger text-on-accent hover:bg-danger/90' : 'text-danger hover:text-danger'
                      }`}
                    >
                      {confirmDelId === v.id ? t('library.confirmDelete') : t('library.delete')}
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

                {analyzeId === v.id && <AnalyzePanel video={v} onClose={() => setAnalyzeId(null)} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreatorProfilePanel({ creator, videos }: { creator: Creator | undefined; videos: Video[] }) {
  const { t } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avgScore, setAvgScore] = useState<number | null>(null)

  useEffect(() => {
    listProviders().then((ps) => setProviders(ps.filter((p) => p.enabled)))
  }, [])

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
    const provider = providers.find((p) => p.is_default) ?? providers[0]
    if (!provider) return
    setError(null)
    setSubmitting(true)
    analyzeCreator(creator.id, provider.id)
      .then(() => setDone(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-app bg-fill px-4 py-3 text-sm">
      <span className="font-medium">{creator.name}</span>
      <span className="text-xs text-secondary">
        {t('library.creatorVideos').replace('{v}', String(creator.video_count)).replace('{t}', String(transcribed))}
      </span>
      {avgScore !== null && (
        <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
          {t('library.avgScore').replace('{s}', String(avgScore))}
        </span>
      )}
      {done ? (
        <span className="text-accent">
          {t('library.creatorSubmitted')}
          <Link to="/reports" className="ml-2 underline">{t('library.goReports')}</Link>
        </span>
      ) : (
        <button
          onClick={submit}
          disabled={submitting || transcribed === 0 || providers.length === 0}
          title={
            transcribed === 0 ? t('library.needTranscribed') : providers.length === 0 ? t('library.needProvider') : ''
          }
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? t('library.submitting') : t('library.analyzeCreator')}
        </button>
      )}
      {error && <span className="text-xs text-danger">⚠ {error}</span>}
    </div>
  )
}

function TranscriptPanel({ videoId }: { videoId: string }) {
  const { t } = useI18n()
  const [tc, setTc] = useState<Transcript | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    getTranscript(videoId)
      .then(setTc)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
  }, [videoId])

  const commitEdit = () => {
    if (editIdx === null || !tc) return
    if (draft.trim() !== tc.segments[editIdx].text) {
      const next = [...tc.segments]
      next[editIdx] = { ...next[editIdx], text: draft.trim() }
      setTc({ ...tc, segments: next })
      setDirty(true)
    }
    setEditIdx(null)
  }

  const save = () => {
    if (!tc) return
    updateTranscript(videoId, tc.segments)
      .then(() => {
        setDirty(false)
        setSaveMsg(t('library.transcriptSaved'))
      })
      .catch((e: unknown) => setSaveMsg(`${t('common.saveFail')}${e instanceof Error ? e.message : String(e)}`))
  }

  return (
    <div className="border-t border-app px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-secondary">
          {tc
            ? t('library.transcriptHint')
                .replace('{model}', tc.asr_model)
                .replace('{lang}', tc.language)
                .replace('{n}', String(tc.segments.length))
            : ''}
        </p>
        {dirty && (
          <button onClick={save} className="vm-btn-primary text-xs">
            {t('library.saveEdit')}
          </button>
        )}
      </div>
      {saveMsg && (
        <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1.5 text-xs text-accent">
          {saveMsg}
        </div>
      )}
      <div className="max-h-80 space-y-1 overflow-auto text-sm">
        {err && <div className="text-danger">{err}</div>}
        {!tc && !err && <div className="text-secondary">{t('library.loading')}</div>}
        {tc?.segments.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-lg px-2 py-1 hover:bg-fill">
            <span className="shrink-0 font-mono text-xs text-secondary">{fmtTs(s.start)}</span>
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
                className="cursor-text text-primary hover:text-accent"
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
  const { t } = useI18n()
  const [comments, setComments] = useState<VideoComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getComments(videoId)
      .then((r) => setComments([...r.comments].sort((a, b) => b.like_count - a.like_count)))
      .finally(() => setLoading(false))
  }, [videoId])

  return (
    <div className="vm-row-detail border-t border-app px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-primary">
          {t('library.commentsTitle').replace('{n}', String(comments.length))}
        </span>
        <button onClick={onRefetch} className="text-xs text-secondary hover:text-accent">
          {t('library.refetch')}
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-secondary">{t('library.loading')}</div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {comments.map((c, i) => (
            <div key={i} className="rounded-lg bg-fill px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-secondary">
                <span className="truncate">{c.author || t('library.anonymous')}</span>
                {c.like_count > 0 && (
                  <span className="shrink-0 font-mono text-accent/80">♥ {c.like_count}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-secondary">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AnalyzePanel({ video, onClose }: { video: Video; onClose: () => void }) {
  const { t } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [template, setTemplate] = useState('business')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  /** 服务商无模型列表、或用户选了「手动输入」时，模型退回自由输入 */
  const [customModel, setCustomModel] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)

  // 没字幕就自动发起「提取音频 → 转录」；分析仍手动（需要用户选模板）。
  // 父级 3s 轮询会刷新 video.status，转录完成后「开始分析」自动解锁。
  const transcribeFired = useRef(false)
  useEffect(() => {
    if (transcribeFired.current) return
    if (video.status === 'collected' || video.status === 'ready') {
      transcribeFired.current = true
      transcribeVideo(video.id).catch(() => {
        transcribeFired.current = false
      })
    }
  }, [video.id, video.status])

  /** 评论模板吃的是评论数据，不依赖字幕 */
  const needTranscript = template !== 'comments' && video.status !== 'transcribed'

  useEffect(() => {
    listProviders().then((ps) => {
      // 默认服务商排最前，分析时预选
      const enabled = ps
        .filter((p) => p.enabled)
        .sort((a, b) => Number(b.is_default ?? false) - Number(a.is_default ?? false))
      setProviders(enabled)
      if (enabled[0]) {
        setProviderId(enabled[0].id)
        setModel(enabled[0].default_model)
      }
    })
  }, [])

  const current = providers.find((p) => p.id === providerId)
  const modelOptions = Array.from(
    new Set([current?.default_model, ...(current?.models ?? [])].filter(Boolean)),
  ) as string[]

  const pickProvider = (id: string) => {
    setProviderId(id)
    setCustomModel(false)
    setModel(providers.find((p) => p.id === id)?.default_model || '')
  }

  const submit = () => {
    setSubmitting(true)
    createAnalysis({ video_id: video.id, template, provider_id: providerId, model: model || undefined })
      .then((a) => setDoneId(a.id))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="border-t border-app px-4 pb-4 pt-3">
      {doneId ? (
        <div className="flex items-center gap-3 py-2 text-sm">
          <span className="text-accent">{t('library.analysisSubmitted')}</span>
          <Link to={`/reports/${doneId}`} className="text-accent underline" onClick={onClose}>
            {t('library.openReport')}
          </Link>
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t('library.noProvider')}
          <Link to="/providers" className="ml-1 underline">{t('library.goConfig')}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {needTranscript && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {PROCESSING.has(video.status) ? (
                <>
                  {t('library.transcribingHint')}
                  <ProgressBar
                    pct={video.progress ?? 0}
                    label={
                      video.status === 'extracting'
                        ? t('library.stageExtracting')
                        : video.status === 'transcribing'
                          ? t('library.stageTranscribing')
                          : undefined
                    }
                  />
                </>
              ) : (
                <>
                  {t('library.autoTranscribeHint')}
                  <ProgressBar pct={0} />
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-secondary">{t('library.template')}</span>
            {ANALYSIS_TEMPLATES.map((tp) => (
              <button
                key={tp.value}
                onClick={() => setTemplate(tp.value)}
                className={`vm-chip ${template === tp.value ? 'vm-chip-on' : 'vm-chip-off'}`}
              >
                {tp.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <select
              className="vm-select h-9 w-44 shrink-0"
              value={providerId}
              onChange={(e) => pickProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_default ? '★ ' : ''}{p.name}
                </option>
              ))}
            </select>
            {!customModel && modelOptions.length > 0 ? (
              <select
                className="vm-select h-9 flex-1 font-mono text-xs"
                value={model}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomModel(true)
                    setModel('')
                  } else {
                    setModel(e.target.value)
                  }
                }}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">✎ {t('library.customModel')}</option>
              </select>
            ) : (
              <input
                className="vm-input h-9 flex-1 font-mono text-xs"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('library.modelPlaceholder')}
                autoFocus={customModel}
              />
            )}
            <button
              onClick={submit}
              disabled={submitting || !providerId || needTranscript}
              className="vm-btn-primary h-9 shrink-0 px-6"
            >
              {submitting ? t('library.submitting') : t('library.startAnalyze')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
