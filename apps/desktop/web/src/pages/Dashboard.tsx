import { useEffect, useState } from 'react'
import { getHealth } from '../api/system'
import type { HealthStatus } from '../types'

export function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getHealth()
      .then((h) => alive && setHealth(h))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">工作台</h1>
      <p className="mb-8 text-neutral-500">AI 视频情报分析系统</p>

      <div className="vm-card p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">后端连接状态</h2>
        {health && (
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-lg">
              {health.service} · <span className="text-neutral-400">{health.version}</span>
            </span>
          </div>
        )}
        {err && (
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-red-400">未连接：{err}</span>
          </div>
        )}
        {!health && !err && <div className="text-neutral-500">检测中…</div>}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: '已分析视频', value: '—' },
          { label: '任务队列', value: '0' },
          { label: '知识库条目', value: '—' },
        ].map((c) => (
          <div
            key={c.label}
            className="vm-card p-5"
          >
            <div className="text-sm text-neutral-500">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
