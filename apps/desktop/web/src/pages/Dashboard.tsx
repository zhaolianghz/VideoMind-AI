import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listVideos } from '../api/videos'
import { listAnalyses } from '../api/analyses'
import { listCreators } from '../api/creators'
import type { Analysis, Creator, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'
import { useI18n } from '../i18n'

/** 处理中的视频状态（采集/抽音频/转录中） */
const BUSY_VIDEO = new Set(['collecting', 'extracting', 'transcribing'])

export function Dashboard() {
  const { t } = useI18n()
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
  const analyzedVideos = new Set(done.filter((a) => a.video_id).map((a) => a.video_id)).size
  const busy =
    videos.filter((v) => BUSY_VIDEO.has(v.status)).length +
    analyses.filter((a) => a.status === 'running' || a.status === 'pending').length

  const cards = [
    { label: t('dashboard.statLibrary'), value: videos.length, to: '/library' },
    { label: t('dashboard.statAnalyzed'), value: analyzedVideos, to: '/library' },
    { label: t('dashboard.statReports'), value: done.length, to: '/reports' },
    { label: t('dashboard.statCreators'), value: creators.length, to: '/library' },
  ]

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">{t('dashboard.title')}</h1>
      <p className="mb-8 text-secondary">{t('dashboard.subtitle')}</p>

      {err && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {t('dashboard.backendErr')}{err}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="vm-card block p-5 hover:border-accent/40">
            <div className="text-sm text-secondary">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </Link>
        ))}
      </div>

      {busy > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-primary">{busy} {t('dashboard.tasksInProgress')}</span>
          <Link to="/library" className="ml-auto text-accent hover:underline">
            {t('dashboard.viewProgress')}
          </Link>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-primary">{t('dashboard.recentReports')}</h2>
            <Link to="/reports" className="text-xs text-accent hover:underline">
              {t('dashboard.all')}
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
                    className="vm-card flex items-center gap-3 p-3 text-sm hover:border-accent/40"
                  >
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {TEMPLATE_LABELS[a.template] || a.template}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-primary">
                      {v?.title || (a.creator_id ? t('dashboard.creatorProfile') : t('dashboard.noTitle'))}
                    </span>
                    <span className="shrink-0 text-xs text-secondary">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                )
              })}
          </div>
        </div>
      )}

      {videos.length === 0 && !err && (
        <div className="mt-6 rounded-xl border border-dashed border-app p-8 text-center">
          <p className="text-secondary">{t('dashboard.emptyHint')}</p>
          <Link
            to="/tasks/new"
            className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            {t('dashboard.newTask')}
          </Link>
        </div>
      )}
    </div>
  )
}
