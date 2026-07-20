import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { deleteAnalysis, getAnalysis, listAnalyses, saveReport } from '../api/analyses'
import { getVideo } from '../api/videos'
import { labelOf, ParsedView } from '../components/ReportView'
import { ProgressBar } from './Library'
import type { Analysis, Video } from '../types'
import { TEMPLATE_LABELS } from '../types'

const PROCESSING = new Set(['running', 'pending'])

export function ReportDetail() {
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
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          报告加载失败：{err}
        </div>
      </div>
    )
  }
  if (!analysis) return <div className="text-neutral-500">加载中…</div>

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
          return `${pad}【${labelOf(k)}】\n${items}`
        }
        if (v && typeof v === 'object')
          return `${pad}【${labelOf(k)}】\n${toPlainText(v as Record<string, unknown>, depth + 1)}`
        return `${pad}【${labelOf(k)}】${String(v)}`
      })
      .join('\n\n')
  }

  const doCopy = () => {
    navigator.clipboard
      .writeText(toPlainText(analysis.parsed))
      .then(() => setSaveMsg('已复制报告全文到剪贴板'))
      .catch(() => setSaveMsg('复制失败'))
  }

  const doSave = (fmt: 'md' | 'html' | 'pdf') => {
    setSaveMsg('导出中…')
    saveReport(analysis.id, fmt)
      .then((r) => setSaveMsg(`已保存到下载文件夹：${r.filename}`))
      .catch((e: unknown) =>
        setSaveMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`),
      )
  }

  return (
    <div className="max-w-4xl">
      <BackLink />

      <div className="mb-6 mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {TEMPLATE_LABELS[analysis.template] || analysis.template}
          </h1>
          <div className="mt-1 text-sm text-neutral-500">
            {video ? (
              <>《{video.title || '(无标题)'}》 · {video.author}</>
            ) : analysis.creator_id ? (
              <>博主画像分析</>
            ) : (
              <>video {analysis.video_id.slice(0, 8)}…</>
            )}
          </div>
          <div className="mt-1 font-mono text-xs text-neutral-600">
            {analysis.model} · {analysis.language} · {analysis.chunks} 片段 ·{' '}
            {new Date(analysis.created_at).toLocaleString()}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {analysis.status === 'done' && (
            <>
              <button onClick={doCopy} className="vm-btn-neon text-xs">复制全文</button>
              <button onClick={() => doSave('md')} className="vm-btn-neon text-xs">MD</button>
              <button onClick={() => doSave('html')} className="vm-btn-neon text-xs">HTML</button>
              <button onClick={() => doSave('pdf')} className="vm-btn-neon text-xs">PDF</button>
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
              confirmDel ? 'bg-red-600 text-white hover:bg-red-500' : 'text-red-400 hover:text-red-300'
            }`}
          >
            {confirmDel ? '确认删除？' : '删除'}
          </button>
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-neutral-500">该视频的报告</span>
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
        <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
          {saveMsg}
        </div>
      )}

      {analysis.status === 'failed' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          ⚠ {analysis.error || '分析失败'}
        </div>
      )}

      {PROCESSING.has(analysis.status) && (
        <div className="vm-card p-5">
          <div className="text-sm text-neutral-300">
            {analysis.status === 'pending' ? '排队等待中…' : '正在分析…'}
          </div>
          <ProgressBar pct={analysis.progress ?? 0} />
        </div>
      )}

      {analysis.status === 'done' && (
        <div className="vm-card p-6">
          <ParsedView data={analysis.parsed} />
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/reports"
      className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-cyan-300"
    >
      <ArrowLeft size={16} /> 返回报告中心
    </Link>
  )
}
