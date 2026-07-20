import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { createAnalysis, listAnalyses } from '../api/analyses'
import { exportVideosCsv, listVideos, recollectVideo } from '../api/videos'
import { listProviders } from '../api/providers'
import { listCreators } from '../api/creators'
import type { Analysis, Creator, Provider, Video } from '../types'

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

const COLS: { key: SortKey; label: string }[] = [
  { key: 'view_count', label: '播放' },
  { key: 'like_count', label: '点赞' },
  { key: 'comment_count', label: '评论' },
  { key: 'share_count', label: '分享' },
  { key: 'favorite_count', label: '收藏' },
  { key: 'duration_sec', label: '时长' },
  { key: 'total', label: '总分' },
]

const DIMS: { key: keyof Score; label: string }[] = [
  { key: 'emotion', label: '情绪' },
  { key: 'conflict', label: '冲突' },
  { key: 'tension', label: '张力' },
  { key: 'info_gap', label: '信息差' },
  { key: 'resonance', label: '共鸣' },
]

const fmtNum = (n: number): string =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}w` : String(n)

const scoreColor = (n: number | undefined): string => {
  if (n == null) return 'text-neutral-600'
  if (n >= 8) return 'text-cyan-300'
  if (n >= 5) return 'text-neutral-200'
  return 'text-neutral-500'
}

/** 五维单项：标签 + 数值 + 条形（8+ 青色发光，5-7 中性，<5 暗） */
function DimBar({ label, value }: { label: string; value: number | undefined }) {
  const v = value ?? 0
  const bar =
    v >= 8
      ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
      : v >= 5
        ? 'bg-neutral-300'
        : 'bg-neutral-600'
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-neutral-400">{label}</span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
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
    setMsg('导出中…')
    exportVideosCsv()
      .then((r) => setMsg(`已保存 CSV 到下载文件夹（${r.rows} 行，其中 ${r.scored} 条有评分）`))
      .catch((e: unknown) => setMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`))
  }

  // 缺互动数据的视频（早期采集的没存点赞/标题等）：重采只刷元数据，不重复下载
  const stale = videos.filter(
    (v) =>
      v.status !== 'collecting' &&
      (!v.title || (v.like_count === 0 && v.view_count === 0)),
  )
  const doRefreshData = async () => {
    setBusy(true)
    setMsg(`正在补采 ${stale.length} 条视频的标题/互动数据（不会重复下载）…`)
    try {
      for (const v of stale) await recollectVideo(v.id)
      setMsg(`已提交 ${stale.length} 条补采，数据到位后自动刷新表格`)
    } catch (e) {
      setMsg(`补采失败：${e instanceof Error ? e.message : String(e)}`)
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
      setMsg('还没有可用的模型服务商，请先到「模型服务商」配置')
      return
    }
    setBusy(true)
    setMsg(`正在为 ${pending.length} 条视频发起评分（${prov.name}）…`)
    try {
      for (const v of pending) {
        await createAnalysis({ video_id: v.id, template: 'score', provider_id: prov.id })
      }
      setMsg(`已提交 ${pending.length} 条评分任务，完成后自动填入表格`)
      load()
    } catch (e) {
      setMsg(`提交失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">数据总表</h1>
          <p className="text-sm text-neutral-500">
            互动数据 + 专家五维评分 · 点击行展开详情 · CSV 含口播稿全文
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {stale.length > 0 && (
            <button onClick={doRefreshData} disabled={busy} className="vm-btn-neon text-xs">
              {busy ? '提交中…' : `补采数据（${stale.length} 条缺失）`}
            </button>
          )}
          {pending.length > 0 && (
            <button onClick={doBatchScore} disabled={busy} className="vm-btn-neon text-xs">
              {busy ? '提交中…' : `批量评分（${pending.length} 条未评）`}
            </button>
          )}
          <button onClick={doExport} className="vm-btn-primary text-xs">
            导出 CSV
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
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
                全部博主
              </button>
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCreatorId(creatorId === c.id ? null : c.id)}
                  className={`vm-chip ${creatorId === c.id ? 'vm-chip-on' : 'vm-chip-off'}`}
                >
                  {c.name || '(未知)'} {c.video_count}
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
              <option value="">全部分类</option>
              {Array.from(new Set(videos.map((v) => v.category).filter(Boolean))).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">视频库还是空的</p>
          <Link to="/tasks/new" className="mt-2 inline-block text-sm text-cyan-400">
            去新建分析 →
          </Link>
        </div>
      ) : (
        <div className="vm-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-xs text-neutral-400">
                <th className="w-6 px-2 py-2.5" />
                <th className="px-2 py-2.5 font-medium">视频</th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => clickSort(c.key)}
                    className={`cursor-pointer whitespace-nowrap px-2 py-2.5 text-right font-medium hover:text-cyan-300 ${
                      sortKey === c.key ? 'text-cyan-300' : ''
                    }`}
                  >
                    {c.label}
                    {sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
                <th
                  className="whitespace-nowrap px-2 py-2.5 text-right font-medium"
                  title="深度拆解的爆款指数（0-100 + S/A/B/C 等级）"
                >
                  指数
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
                      className={`cursor-pointer border-b border-white/[0.04] transition-colors ${
                        open ? 'bg-cyan-400/[0.04]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-block transition-transform duration-200 motion-reduce:transition-none ${
                            open ? 'rotate-90 text-cyan-300' : 'text-neutral-500'
                          }`}
                        >
                          <CaretRight size={13} />
                        </span>
                      </td>
                      <td className="max-w-72 px-2 py-2.5">
                        <div className="truncate font-medium text-neutral-200" title={v.title}>
                          {v.title || '(无标题 — 点「补采数据」修复)'}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
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
                          <span className="animate-pulse text-xs font-normal text-amber-400">评分中</span>
                        ) : (
                          sc?.total ?? '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs">
                        {(() => {
                          const di = deepIndex.get(v.id)
                          if (!di) return <span className="text-neutral-600">—</span>
                          const cls =
                            di.grade === 'S'
                              ? 'text-cyan-300 font-bold'
                              : di.grade === 'A'
                                ? 'text-neutral-200 font-bold'
                                : 'text-neutral-500'
                          return (
                            <span className={cls}>
                              {di.index}
                              <span className="ml-1 rounded bg-white/[0.06] px-1">{di.grade}</span>
                            </span>
                          )
                        })()}
                      </td>
                    </tr>

                    {open && (
                      <tr key={`${v.id}-detail`} className="border-b border-white/[0.06]">
                        <td colSpan={COLS.length + 3} className="bg-black/20 px-4 py-0">
                          <div className="vm-row-detail grid grid-cols-[auto_1fr] gap-x-10 gap-y-4 py-4">
                            {/* 左：五维明细 */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-neutral-300">
                                五维评分
                                {sc && (
                                  <span className={`ml-2 font-mono text-sm font-bold ${scoreColor(sc.total && sc.total / 5)}`}>
                                    {sc.total}/50
                                  </span>
                                )}
                              </div>
                              {sc ? (
                                DIMS.map((d) => <DimBar key={d.key} label={d.label} value={sc[d.key] as number} />)
                              ) : (
                                <div className="text-xs text-neutral-600">
                                  {v.status === 'transcribed' ? '未评分 — 点上方「批量评分」' : '需先完成转录'}
                                </div>
                              )}
                            </div>

                            {/* 右：完整摘要 + 评分依据 */}
                            <div className="min-w-0 space-y-3">
                              {sc?.summary && (
                                <div>
                                  <div className="mb-1 text-xs font-medium text-neutral-300">内容摘要</div>
                                  <p className="text-xs leading-relaxed text-neutral-400">{sc.summary}</p>
                                </div>
                              )}
                              {sc?.rationale && (
                                <div>
                                  <div className="mb-1 text-xs font-medium text-neutral-300">评分依据</div>
                                  <p className="text-xs leading-relaxed text-neutral-400">{sc.rationale}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-3 pt-1">
                                <span className="vm-url max-w-96">{v.url.replace(/^https?:\/\//, '')}</span>
                                {hit && (
                                  <Link
                                    to={`/reports/${hit.id}`}
                                    className="shrink-0 text-xs text-cyan-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    完整报告 →
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
          <div className="border-t border-white/[0.06] px-3 py-2 text-[11px] text-neutral-600">
            五维 = 情绪/冲突/张力/信息差/共鸣（各 0-10，总分 0-50）· 抖音不公开播放数，播放列为 0 属正常
          </div>
        </div>
      )}
    </div>
  )
}
