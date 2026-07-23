import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteAnalysis, listAnalyses } from '../api/analyses'
import { listVideos } from '../api/videos'
import { listCreators } from '../api/creators'
import { ProgressBar } from './Library'
import type { Analysis, Creator, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'
import { useI18n } from '../i18n'

const PROCESSING = new Set(['running', 'pending'])

function statusStyle(s: string): string {
  if (s === 'done') return 'bg-accent/10 text-accent'
  if (s === 'failed') return 'bg-danger/10 text-danger'
  if (PROCESSING.has(s)) return 'bg-warning/10 text-warning'
  return 'bg-fill text-secondary'
}

export function Reports() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<Analysis[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [tpl, setTpl] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const STATUS_LABELS: Record<string, string> = {
    done: t('reports.statusDone'),
    failed: t('reports.statusFailed'),
    running: t('reports.statusRunning'),
    pending: t('reports.statusPending'),
  }

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
    const m = new Map(videos.map((v) => [v.id, v.title || t('reports.noTitle')]))
    return (id: string) => m.get(id) ?? `${t('reports.videoPrefix')} ${id.slice(0, 8)}…`
  }, [videos, t])
  const creatorName = useMemo(() => {
    const m = new Map(creators.map((c) => [c.id, c.name || t('reports.unknownCreator')]))
    return (id: string) => m.get(id) ?? `${t('reports.creatorPrefix')} ${id.slice(0, 8)}…`
  }, [creators, t])

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
          <h1 className="mb-1 text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-secondary">{t('reports.subtitle')}</p>
        </div>
        <input
          className="vm-input h-9 max-w-64"
          placeholder={t('reports.searchPlaceholder')}
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
            {t('reports.all')} {items.length}
          </button>
          {usedTpls.map((tt) => (
            <button
              key={tt}
              onClick={() => setTpl(tpl === tt ? null : tt)}
              className={`vm-chip ${tpl === tt ? 'vm-chip-on' : 'vm-chip-off'}`}
            >
              {TEMPLATE_LABELS[tt] || tt} {items.filter((a) => a.template === tt).length}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="text-secondary">{t('reports.loading')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app py-16 text-center">
          <p className="text-secondary">{t('reports.empty')}</p>
          <Link to="/library" className="mt-2 inline-block text-sm text-accent">
            {t('reports.goLibrary')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/reports/${a.id}`)}
              className="vm-card cursor-pointer transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{TEMPLATE_LABELS[a.template] || a.template}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle(a.status)}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                    {a.status === 'done' && (
                      <span className="text-xs text-secondary">
                        {a.chunks} {t('reports.chunks')} · {a.model}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-secondary">
                    {a.creator_id ? creatorName(a.creator_id) : videoTitle(a.video_id)}
                    {' · '}
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  {a.status === 'failed' && a.error && (
                    <div className="mt-1 text-xs text-danger">⚠ {a.error.slice(0, 80)}</div>
                  )}
                  {PROCESSING.has(a.status) && <ProgressBar pct={a.progress ?? 0} />}
                </div>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {a.status === 'done' && (
                    <Link to={`/reports/${a.id}`} className="vm-btn-neon text-xs">
                      {t('reports.openReport')}
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
                        ? 'bg-danger text-on-accent hover:bg-danger'
                        : 'text-danger hover:text-danger'
                    }`}
                  >
                    {confirmDelId === a.id ? t('reports.confirmDelete') : t('reports.delete')}
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
