import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAnalysis, listAnalyses } from '../api/analyses'
import type { Analysis } from '../types'
import { TEMPLATE_LABELS } from '../types'

const PROCESSING = new Set(['running', 'pending'])

function statusStyle(s: string): string {
  if (s === 'done') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'failed') return 'bg-red-500/15 text-red-400'
  if (PROCESSING.has(s)) return 'bg-amber-500/15 text-amber-400'
  return 'bg-white/5 text-neutral-400'
}

const LABELS: Record<string, string> = {
  summary: '摘要', point: '观点', evidence: '论据',
  target_users: '目标用户', monetization: '盈利方式', growth_strategy: '增长策略',
  competitive_edge: '竞争优势', risks: '风险', opportunities: '机会',
  chapter: '章节', topics: '知识点', knowledge_points: '知识点列表',
  cases: '案例', target_audience: '适合人群',
  title_patterns: '标题规律', hook_analysis: '开头钩子分析', content_structure: '内容结构',
  spread_mechanism: '传播机制', replication_model: '复制模型',
}
const labelOf = (k: string): string => LABELS[k] || k

export function Reports() {
  const [items, setItems] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Analysis | null>(null)

  const load = () => listAnalyses().then(setItems).finally(() => setLoading(false))
  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">报告中心</h1>
      <p className="mb-8 text-neutral-500">AI 分析结果 · 每 3s 自动刷新 · 点击查看详情</p>
      {loading ? (
        <div className="text-neutral-500">加载中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">还没有分析报告</p>
          <Link to="/library" className="mt-2 inline-block text-sm text-emerald-400">
            去视频库发起分析 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between vm-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{TEMPLATE_LABELS[a.template] || a.template}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle(a.status)}`}>
                    {a.status}
                  </span>
                  {a.status === 'done' && (
                    <span className="text-xs text-neutral-500">
                      {a.chunks} 片段 · {a.model}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  video {a.video_id.slice(0, 8)}… · {new Date(a.created_at).toLocaleString()}
                </div>
                {a.status === 'failed' && a.error && (
                  <div className="mt-1 text-xs text-red-400">⚠ {a.error.slice(0, 80)}</div>
                )}
              </div>
              <div className="flex gap-2">
                {a.status === 'done' && (
                  <button
                    onClick={() => setActive(a)}
                    className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    查看
                  </button>
                )}
                <button
                  onClick={() => deleteAnalysis(a.id).then(load)}
                  className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:text-red-300"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {active && <ReportModal analysis={active} onClose={() => setActive(null)} />}
    </div>
  )
}

function ReportModal({
  analysis,
  onClose,
}: {
  analysis: Analysis
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col vm-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{TEMPLATE_LABELS[analysis.template]}</h2>
            <p className="text-xs text-neutral-500">
              {analysis.model} · {analysis.language} · {analysis.chunks} 片段
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">导出</span>
            <a href={`/api/v1/reports/${analysis.id}/export?fmt=md`} download className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">MD</a>
            <a href={`/api/v1/reports/${analysis.id}/export?fmt=html`} download className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">HTML</a>
            <a href={`/api/v1/reports/${analysis.id}/export?fmt=pdf`} download className="rounded-lg border border-emerald-800 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950">PDF</a>
            <button onClick={onClose} className="ml-2 text-neutral-400 hover:text-white">✕</button>
          </div>
        </div>
        <div className="overflow-auto">
          <ParsedView data={analysis.parsed} />
        </div>
      </div>
    </div>
  )
}

function ParsedView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(data)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 text-sm font-semibold text-emerald-400">{labelOf(k)}</div>
            <ValueView value={v} />
          </div>
        ))}
    </div>
  )
}

function ValueView({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <div className="text-sm text-neutral-600">—</div>
    if (typeof value[0] === 'object' && value[0] !== null) {
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="rounded-lg border border-white/10 p-3">
              <ParsedView data={item as Record<string, unknown>} />
            </div>
          ))}
        </div>
      )
    }
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-200">
        {value.map((it, i) => (
          <li key={i}>{String(it)}</li>
        ))}
      </ul>
    )
  }
  if (value && typeof value === 'object') {
    return (
      <div className="rounded-lg border border-white/10 p-3">
        <ParsedView data={value as Record<string, unknown>} />
      </div>
    )
  }
  return <p className="text-sm leading-relaxed text-neutral-200">{String(value)}</p>
}
