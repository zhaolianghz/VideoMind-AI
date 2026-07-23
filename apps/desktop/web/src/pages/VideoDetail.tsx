import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getVideo } from '../api/videos'
import { getTranscript } from '../api/transcripts'
import { listAnalyses, saveReport } from '../api/analyses'
import { api } from '../api/client'
import type { Analysis, Transcript, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'
import { useI18n } from '../i18n'
import { ParsedView } from '../components/ReportView'

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const PROCESSING = new Set(['running', 'pending'])

export function VideoDetail() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selAnalysis, setSelAnalysis] = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    getVideo(id).then(setVideo)
    getTranscript(id).then(setTranscript).catch(() => {})
    listAnalyses(id).then((a) => {
      setAnalyses(a)
      if (a[0]) setSelAnalysis(a[0].id)
    })
  }, [id])

  // 有分析在跑时每 3s 刷新（转录+分析一条龙可能耗时数分钟）
  useEffect(() => {
    if (!analyses.some((a) => PROCESSING.has(a.status))) return
    const timer = setInterval(() => {
      listAnalyses(id).then(setAnalyses)
      getTranscript(id).then(setTranscript).catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [id, analyses])

  const jumpTo = (tt: number) => {
    if (videoRef.current) videoRef.current.currentTime = tt
  }

  const current = analyses.find((a) => a.id === selAnalysis)
  const mediaUrl = `${api.defaults.baseURL ?? '/api/v1'}/media/${id}`

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/library" className="text-sm text-secondary hover:text-primary">
          {t('videoDetail.back')}
        </Link>
        <h1 className="truncate text-lg font-bold">{video?.title || t('videoDetail.loading')}</h1>
        {video && (
          <span className="rounded-full bg-fill px-2 py-0.5 text-xs text-secondary">
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
            className="aspect-video w-full rounded-xl bg-surface object-contain"
          />
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-app bg-surface">
            <div className="border-b border-app px-4 py-2 text-xs text-secondary">
              {t('videoDetail.transcript')}{' '}
              {transcript ? `· ${transcript.asr_model} · ${transcript.language}` : ''}
            </div>
            <div className="flex-1 overflow-auto p-2">
              {!transcript && (
                <div className="p-4 text-sm text-secondary">{t('videoDetail.noTranscript')}</div>
              )}
              {transcript?.segments.map((s, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(s.start)}
                  className="flex w-full gap-3 rounded px-2 py-1 text-left text-sm hover:bg-fill"
                >
                  <span className="shrink-0 font-mono text-xs text-accent">
                    {fmtTs(s.start)}
                  </span>
                  <span className="text-primary">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右：报告 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-app bg-surface">
          <div className="flex items-center gap-2 border-b border-app px-4 py-2">
            <span className="text-xs text-secondary">{t('videoDetail.report')}</span>
            <div className="ml-auto flex items-center gap-2">
              {analyses.length > 0 && (
                <select
                  className="rounded border border-app bg-surface px-2 py-0.5 text-xs"
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
              <Link
                to={`/library?analyze=${id}`}
                className="rounded border border-accent/40 px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
              >
                {t('videoDetail.analyze')}
              </Link>
              {current?.status === 'done' && (
                // 桌面 webview 不支持 <a download>（会把整个界面导航到导出内容），走后端落盘
                <button
                  onClick={() => {
                    setExportMsg(t('reportDetail.exporting'))
                    saveReport(current.id, 'pdf')
                      .then((r) => setExportMsg(`${t('reportDetail.savedTo')}${r.filename}`))
                      .catch((e: unknown) => {
                        const detail = (e as { response?: { data?: { detail?: string } } })
                          ?.response?.data?.detail
                        setExportMsg(
                          `${t('reportDetail.exportFail')}${detail ?? (e instanceof Error ? e.message : String(e))}`,
                        )
                      })
                  }}
                  className="rounded border border-success/40 px-2 py-0.5 text-xs text-success hover:bg-success/10"
                >
                  {t('videoDetail.export')}
                </button>
              )}
            </div>
          </div>
          {exportMsg && (
            <div className="border-b border-app bg-accent/10 px-4 py-1.5 text-xs text-accent">
              {exportMsg}
            </div>
          )}
          <div className="flex-1 overflow-auto p-4">
            {analyses.length === 0 ? (
              <div className="py-8 text-center text-sm text-secondary">
                {t('videoDetail.noReport')}
                <Link to={`/library?analyze=${id}`} className="mt-2 block text-accent">
                  {t('videoDetail.goAnalyze')}
                </Link>
              </div>
            ) : current ? (
              current.status === 'done' ? (
                <ParsedView data={current.parsed} />
              ) : PROCESSING.has(current.status) ? (
                <div className="py-10 text-center text-sm text-secondary">
                  {t('reportDetail.analyzing')}
                  {current.progress ? ` ${current.progress}%` : ''}
                </div>
              ) : (
                <div className="space-y-4 py-8 text-center text-sm">
                  <div className="mx-auto max-w-md rounded-lg border border-danger/30 bg-danger/10 p-3 text-left text-danger">
                    {t('reportDetail.analysisFailed')}
                    {current.error ? `：${current.error}` : ''}
                  </div>
                  <Link to={`/library?analyze=${id}`} className="inline-block text-accent">
                    {t('videoDetail.goAnalyze')}
                  </Link>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

