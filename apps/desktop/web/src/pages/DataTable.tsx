import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { createAnalysis, listAnalyses } from '../api/analyses'
import { exportVideosCsv, listVideos, recollectVideo } from '../api/videos'
import { listProviders } from '../api/providers'
import { listCreators } from '../api/creators'
import type { Analysis, Creator, Provider, Video } from '../types'
import { useI18n } from '../i18n'

interface Score {
  emotion?: number
  conflict?: number
  tension?: number
  info_gap?: number
  resonance?: number
  total?: number
  summary?: string
  rationale?: string
}

type SortKey =
  | 'total' | 'like_count' | 'comment_count' | 'share_count'
  | 'favorite_count' | 'view_count' | 'duration_sec'

// label = i18n key under dataTable.* (resolved at render via t())
const COLS: { key: SortKey; label: string }[] = [
  { key: 'view_count', label: 'colViews' },
  { key: 'like_count', label: 'colLikes' },
  { key: 'comment_count', label: 'colComments' },
  { key: 'share_count', label: 'colShares' },
  { key: 'favorite_count', label: 'colFavorites' },
  { key: 'duration_sec', label: 'colDuration' },
  { key: 'total', label: 'colTotal' },
]

const DIMS: { key: keyof Score; label: string }[] = [
  { key: 'emotion', label: 'dimEmotion' },
  { key: 'conflict', label: 'dimConflict' },
  { key: 'tension', label: 'dimTension' },
  { key: 'info_gap', label: 'dimInfoGap' },
  { key: 'resonance', label: 'dimResonance' },
]

const fmtNum = (n: number): string =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}w` : String(n)

const scoreColor = (n: number | undefined): string => {
  if (n == null) return 'text-tertiary'
  if (n >= 8) return 'text-accent'
  if (n >= 5) return 'text-primary'
  return 'text-secondary'
}

/** 五维单项：标签 + 数值 + 条形（8+ 青色发光，5-7 中性，<5 暗） */
function DimBar({ label, value }: { label: string; value: number | undefined }) {
  const v = value ?? 0
  const bar =
    v >= 8
      ? 'bg-accent'
      : v >= 5
        ? 'bg-fill'
        : 'bg-fill'
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-secondary">{label}</span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-fill">
        <div
          className={`h-full rounded-full transition-all duration-300 ${bar}`}
          style={{ width: `${v * 10}%` }}
        />
      </div>
      <span className={`w-6 text-right font-mono text-xs font-bold ${scoreColor(value)}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export function DataTable() {
  const { t } = useI18n()
  const [videos, setVideos] = useState<Video[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [desc, setDesc] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creators, setCreators] = useState<Creator[]>([])
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)

  const load = () =>
    Promise.all([listVideos(), listAnalyses()]).then(([vs, as]) => {
      setVideos(vs)
      setAnalyses(as)
    })

  useEffect(() => {
    load()
    listProviders().then((ps) => setProviders(ps.filter((p) => p.enabled)))
    listCreators().then(setCreators).catch(() => undefined)
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  // 每个视频取最新一次深度拆解的爆款指数
  const deepIndex = useMemo(() => {
    const m = new Map<string, { id: string; index: number; grade: string }>()
    analyses
      .filter((a) => a.template === 'deep' && a.status === 'done' && a.video_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((a) => {
        const p = a.parsed as { viral_index?: number; grade?: string }
        if (p.viral_index != null)
          m.set(a.video_id, { id: a.id, index: p.viral_index, grade: p.grade ?? '' })
      })
    return m
  }, [analyses])

  // 每个视频取最新一次完成的爆款评分（含 analysis id，详情面板跳完整报告用）
  const scores = useMemo(() => {
    const m = new Map<string, { id: string; sc: Score }>()
    analyses
      .filter((a) => a.template === 'score' && a.status === 'done' && a.video_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((a) => m.set(a.video_id, { id: a.id, sc: a.parsed as Score }))
    return m
  }, [analyses])

  const runningScores = useMemo(
    () =>
      new Set(
        analyses
          .filter((a) => a.template === 'score' && (a.status === 'running' || a.status === 'pending'))
          .map((a) => a.video_id),
      ),
    [analyses],
  )

  const rows = useMemo(() => {
    const val = (v: Video): number =>
      sortKey === 'total' ? (scores.get(v.id)?.sc.total ?? -1) : v[sortKey]
    return videos
      .filter((v) => !creatorId || v.creator_id === creatorId)
      .filter((v) => !category || v.category === category)
      .sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)))
  }, [videos, scores, sortKey, desc, creatorId, category])

  const clickSort = (k: SortKey) => {
    if (sortKey === k) setDesc(!desc)
    else {
      setSortKey(k)
      setDesc(true)
    }
  }

  const doExport = () => {
    setMsg(t('dataTable.exporting'))
    exportVideosCsv()
      .then((r) => setMsg(t('dataTable.exportOk').replace('{rows}', String(r.rows)).replace('{scored}', String(r.scored))))
      .catch((e: unknown) => setMsg(`${t('dataTable.exportFail')}${e instanceof Error ? e.message : String(e)}`))
  }

  // 缺互动数据的视频（早期采集的没存点赞/标题等）：重采只刷元数据，不重复下载
  const stale = videos.filter(
    (v) =>
      v.status !== 'collecting' &&
      (!v.title || (v.like_count === 0 && v.view_count === 0)),
  )
  const doRefreshData = async () => {
    setBusy(true)
    setMsg(t('dataTable.refetching').replace('{n}', String(stale.length)))
    try {
      for (const v of stale) await recollectVideo(v.id)
      setMsg(t('dataTable.refetchOk').replace('{n}', String(stale.length)))
    } catch (e) {
      setMsg(`${t('dataTable.refetchFail')}${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  // 批量评分：给所有已转录但还没有评分（也不在评分中）的视频发起 score 分析
  const pending = videos.filter(
    (v) => v.status === 'transcribed' && !scores.has(v.id) && !runningScores.has(v.id),
  )
  const doBatchScore = async () => {
    const prov = providers[0]
    if (!prov) {
      setMsg(t('dataTable.noProvider'))
      return
    }
    setBusy(true)
    setMsg(t('dataTable.scoring').replace('{n}', String(pending.length)).replace('{provider}', prov.name))
    try {
      for (const v of pending) {
        await createAnalysis({ video_id: v.id, template: 'score', provider_id: prov.id })
      }
      setMsg(t('dataTable.scoreOk').replace('{n}', String(pending.length)))
      load()
    } catch (e) {
      setMsg(`${t('dataTable.scoreFail')}${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('dataTable.title')}</h1>
          <p className="text-sm text-secondary">
            {t('dataTable.subtitle')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {stale.length > 0 && (
            <button onClick={doRefreshData} disabled={busy} className="vm-btn-neon text-xs">
              {busy ? t('dataTable.submitting') : t('dataTable.refetchBtn').replace('{n}', String(stale.length))}
            </button>
          )}
          {pending.length > 0 && (
            <button onClick={doBatchScore} disabled={busy} className="vm-btn-neon text-xs">
              {busy ? t('dataTable.submitting') : t('dataTable.batchScoreBtn').replace('{n}', String(pending.length))}
            </button>
          )}
          <button onClick={doExport} className="vm-btn-primary text-xs">
            {t('dataTable.exportCsv')}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          {msg}
        </div>
      )}

      {(creators.length > 1 || videos.some((v) => v.category)) && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {creators.length > 1 && (
            <>
              <button
                onClick={() => setCreatorId(null)}
                className={`vm-chip ${creatorId === null ? 'vm-chip-on' : 'vm-chip-off'}`}
              >
                {t('dataTable.allCreators')}
              </button>
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCreatorId(creatorId === c.id ? null : c.id)}
                  className={`vm-chip ${creatorId === c.id ? 'vm-chip-on' : 'vm-chip-off'}`}
                >
                  {c.name || t('dataTable.unknownCreator')} {c.video_count}
                </button>
              ))}
            </>
          )}
          {videos.some((v) => v.category) && (
            <select
              value={category ?? ''}
              onChange={(e) => setCategory(e.target.value || null)}
              className="vm-select ml-auto h-8 py-1 text-xs"
            >
              <option value="">{t('dataTable.allCategories')}</option>
              {Array.from(new Set(videos.map((v) => v.category).filter(Boolean))).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app py-16 text-center">
          <p className="text-secondary">{t('dataTable.emptyLib')}</p>
          <Link to="/tasks/new" className="mt-2 inline-block text-sm text-accent">
            {t('dataTable.goNewTask')}
          </Link>
        </div>
      ) : (
        <div className="vm-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app text-left text-xs text-secondary">
                <th className="w-6 px-2 py-2.5" />
                <th className="px-2 py-2.5 font-medium">{t('dataTable.colVideo')}</th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => clickSort(c.key)}
                    className={`cursor-pointer whitespace-nowrap px-2 py-2.5 text-right font-medium hover:text-accent ${
                      sortKey === c.key ? 'text-accent' : ''
                    }`}
                  >
                    {t('dataTable.' + c.label)}
                    {sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
                <th
                  className="whitespace-nowrap px-2 py-2.5 text-right font-medium"
                  title={t('dataTable.indexTip')}
                >
                  {t('dataTable.indexCol')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const hit = scores.get(v.id)
                const sc = hit?.sc
                const open = openId === v.id
                return (
                  <>
                    <tr
                      key={v.id}
                      onClick={() => setOpenId(open ? null : v.id)}
                      className={`cursor-pointer border-b border-app transition-colors ${
                        open ? 'bg-accent/10' : 'hover:bg-fill'
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-block transition-transform duration-200 motion-reduce:transition-none ${
                            open ? 'rotate-90 text-accent' : 'text-secondary'
                          }`}
                        >
                          <CaretRight size={13} />
                        </span>
                      </td>
                      <td className="max-w-72 px-2 py-2.5">
                        <div className="truncate font-medium text-primary" title={v.title}>
                          {v.title || t('dataTable.noTitleFix')}
                        </div>
                        <div className="truncate text-xs text-secondary">
                          {v.author || v.platform}
                          {v.music ? ` · ♪ ${v.music}` : ''}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{fmtNum(v.view_count)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{fmtNum(v.like_count)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{fmtNum(v.comment_count)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{fmtNum(v.share_count)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{fmtNum(v.favorite_count)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">{v.duration_sec}s</td>
                      <td className={`px-2 py-2.5 text-right font-mono text-sm font-bold ${scoreColor(sc?.total)}`}>
                        {runningScores.has(v.id) ? (
                          <span className="animate-pulse text-xs font-normal text-warning">{t('dataTable.scoringInline')}</span>
                        ) : (
                          sc?.total ?? '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs">
                        {(() => {
                          const di = deepIndex.get(v.id)
                          if (!di) return <span className="text-tertiary">—</span>
                          const cls =
                            di.grade === 'S'
                              ? 'text-accent font-bold'
                              : di.grade === 'A'
                                ? 'text-primary font-bold'
                                : 'text-secondary'
                          return (
                            <span className={cls}>
                              {di.index}
                              <span className="ml-1 rounded bg-fill px-1">{di.grade}</span>
                            </span>
                          )
                        })()}
                      </td>
                    </tr>

                    {open && (
                      <tr key={`${v.id}-detail`} className="border-b border-app">
                        <td colSpan={COLS.length + 3} className="bg-surface px-4 py-0">
                          <div className="vm-row-detail grid grid-cols-[auto_1fr] gap-x-10 gap-y-4 py-4">
                            {/* 左：五维明细 */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-primary">
                                {t('dataTable.fiveDim')}
                                {sc && (
                                  <span className={`ml-2 font-mono text-sm font-bold ${scoreColor(sc.total && sc.total / 5)}`}>
                                    {sc.total}/50
                                  </span>
                                )}
                              </div>
                              {sc ? (
                                DIMS.map((d) => <DimBar key={d.key} label={t('dataTable.' + d.label)} value={sc[d.key] as number} />)
                              ) : (
                                <div className="text-xs text-tertiary">
                                  {v.status === 'transcribed' ? t('dataTable.notScored') : t('dataTable.needTranscribe')}
                                </div>
                              )}
                            </div>

                            {/* 右：完整摘要 + 评分依据 */}
                            <div className="min-w-0 space-y-3">
                              {sc?.summary && (
                                <div>
                                  <div className="mb-1 text-xs font-medium text-primary">{t('dataTable.contentSummary')}</div>
                                  <p className="text-xs leading-relaxed text-secondary">{sc.summary}</p>
                                </div>
                              )}
                              {sc?.rationale && (
                                <div>
                                  <div className="mb-1 text-xs font-medium text-primary">{t('dataTable.scoringRationale')}</div>
                                  <p className="text-xs leading-relaxed text-secondary">{sc.rationale}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-3 pt-1">
                                <span className="vm-url max-w-96">{v.url.replace(/^https?:\/\//, '')}</span>
                                {hit && (
                                  <Link
                                    to={`/reports/${hit.id}`}
                                    className="shrink-0 text-xs text-accent hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {t('dataTable.fullReport')}
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-app px-3 py-2 text-[11px] text-tertiary">
            {t('dataTable.footnote')}
          </div>
        </div>
      )}
    </div>
  )
}
