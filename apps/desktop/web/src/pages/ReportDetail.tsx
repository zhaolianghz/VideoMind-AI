import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { deleteAnalysis, getAnalysis, listAnalyses, saveReport } from '../api/analyses'
import { pickDirectory } from '../utils/tauri'
import { getVideo } from '../api/videos'
import { labelOf, ParsedView } from '../components/ReportView'
import { ProgressBar } from './Library'
import type { Analysis, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'
import { useI18n } from '../i18n'

const PROCESSING = new Set(['running', 'pending'])

export function ReportDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [siblings, setSiblings] = useState<Analysis[]>([])
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (!id) return
    let alive = true
    const load = () =>
      getAnalysis(id)
        .then((a) => {
          if (!alive) return
          setAnalysis(a)
          if (a.video_id) {
            getVideo(a.video_id).then((v) => alive && setVideo(v)).catch(() => undefined)
            // 同视频的其它已完成报告（快速切换/对比）
            listAnalyses(a.video_id)
              .then((all) => alive && setSiblings(all.filter((x) => x.status === 'done')))
              .catch(() => undefined)
          }
        })
        .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : String(e)))
    load()
    // 分析进行中每 3s 刷新进度
    const timer = setInterval(() => {
      if (!analysis || PROCESSING.has(analysis.status)) load()
    }, 3000)
    return () => {
      alive = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, analysis?.status])

  if (err) {
    return (
      <div className="max-w-3xl">
        <BackLink />
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {t('reportDetail.loadFail')}{err}
        </div>
      </div>
    )
  }
  if (!analysis) return <div className="text-secondary">{t('common.loading')}</div>

  // 桌面 webview 不支持 <a download>（会把整个界面导航到文件 URL 回不来），
  // 改为后端写入 ~/Downloads
  const toPlainText = (data: Record<string, unknown>, depth = 0): string => {
    const pad = '  '.repeat(depth)
    return Object.entries(data)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          const items = v
            .map((it) =>
              typeof it === 'object' && it !== null
                ? toPlainText(it as Record<string, unknown>, depth + 1)
                : `${pad}- ${String(it)}`,
            )
            .join('\n')
          return `${pad}【${labelOf(k, t)}】\n${items}`
        }
        if (v && typeof v === 'object')
          return `${pad}【${labelOf(k, t)}】\n${toPlainText(v as Record<string, unknown>, depth + 1)}`
        return `${pad}【${labelOf(k, t)}】${String(v)}`
      })
      .join('\n\n')
  }

  const doCopy = () => {
    navigator.clipboard
      .writeText(toPlainText(analysis.parsed))
      .then(() => setSaveMsg(t('reportDetail.copied')))
      .catch(() => setSaveMsg(t('reportDetail.copyFail')))
  }

  const doSave = (fmt: 'md' | 'html' | 'pdf') => {
    setSaveMsg(t('reportDetail.exporting'))
    saveReport(analysis.id, fmt)
      .then((r) => setSaveMsg(`${t('reportDetail.savedTo')}${r.filename}`))
      .catch((e: unknown) =>
        setSaveMsg(`${t('reportDetail.exportFail')}${e instanceof Error ? e.message : String(e)}`),
      )
  }

  // 另存为：弹原生目录选择框，选完以 PDF 导出到该位置（不受默认报告目录约束）
  const doSaveAs = () => {
    setSaveMsg(t('reportDetail.chooseDir'))
    pickDirectory().then((dir) => {
      if (!dir) {
        setSaveMsg('')
        return
      }
      saveReport(analysis.id, 'pdf', dir)
        .then((r) => setSaveMsg(`${t('reportDetail.savedToDir')}${r.filename}`))
        .catch((e: unknown) =>
          setSaveMsg(`${t('reportDetail.exportFail')}${e instanceof Error ? e.message : String(e)}`),
        )
    })
  }

  return (
    <div className="max-w-4xl">
      <BackLink />

      <div className="mb-6 mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {TEMPLATE_LABELS[analysis.template] || analysis.template}
          </h1>
          <div className="mt-1 text-sm text-secondary">
            {video ? (
              <>《{video.title || t('reports.noTitle')}》 · {video.author}</>
            ) : analysis.creator_id ? (
              <>{t('reportDetail.creatorProfile')}</>
            ) : (
              <>video {analysis.video_id.slice(0, 8)}…</>
            )}
          </div>
          <div className="mt-1 font-mono text-xs text-secondary">
            {analysis.model} · {analysis.language} · {analysis.chunks} {t('reports.chunks')} ·{' '}
            {new Date(analysis.created_at).toLocaleString()}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {analysis.status === 'done' && (
            <>
              <button onClick={doCopy} className="vm-btn-neon text-xs">{t('reportDetail.copyAll')}</button>
              <button onClick={() => doSave('md')} className="vm-btn-neon text-xs">MD</button>
              <button onClick={() => doSave('html')} className="vm-btn-neon text-xs">HTML</button>
              <button onClick={() => doSave('pdf')} className="vm-btn-neon text-xs">PDF</button>
              <button onClick={doSaveAs} className="vm-btn-neon text-xs">{t('reportDetail.saveAs')}</button>
            </>
          )}
          <button
            onClick={() =>
              confirmDel
                ? deleteAnalysis(analysis.id).then(() => navigate('/reports'))
                : setConfirmDel(true)
            }
            onMouseLeave={() => setConfirmDel(false)}
            className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              confirmDel ? 'bg-danger text-on-accent hover:bg-danger' : 'text-danger hover:text-danger'
            }`}
          >
            {confirmDel ? t('reports.confirmDelete') : t('reports.delete')}
          </button>
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-secondary">{t('reportDetail.videoReports')}</span>
          {siblings.map((sb) => (
            <Link
              key={sb.id}
              to={`/reports/${sb.id}`}
              className={`vm-chip ${sb.id === analysis.id ? 'vm-chip-on' : 'vm-chip-off'}`}
            >
              {TEMPLATE_LABELS[sb.template] || sb.template}
            </Link>
          ))}
        </div>
      )}

      {saveMsg && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          {saveMsg}
        </div>
      )}

      {analysis.status === 'failed' && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          ⚠ {analysis.error || t('reportDetail.analysisFailed')}
        </div>
      )}

      {PROCESSING.has(analysis.status) && (
        <div className="vm-card p-5">
          <div className="text-sm text-primary">
            {analysis.status === 'pending' ? t('reportDetail.queued') : t('reportDetail.analyzing')}
          </div>
          <ProgressBar pct={analysis.progress ?? 0} />
        </div>
      )}

      {analysis.status === 'done' && (
        <div className="pb-10 pt-2">
          <ParsedView data={analysis.parsed} />
        </div>
      )}
    </div>
  )
}

function BackLink() {
  const { t } = useI18n()
  return (
    <Link
      to="/reports"
      className="inline-flex items-center gap-1.5 text-sm text-secondary transition hover:text-accent"
    >
      <ArrowLeft size={16} /> {t('reportDetail.back')}
    </Link>
  )
}
