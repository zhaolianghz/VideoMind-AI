import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Providers } from './pages/Providers'
import { NewTask } from './pages/NewTask'
import { Library } from './pages/Library'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { api } from './api/client'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    let tries = 0
    const poll = () => {
      if (cancelled) return
      // 生产(Tauri): 轮询 sidecar API base（sidecar 后台启动中可能暂返回空）
      // 开发(浏览器): invoke 抛错 → 用 vite proxy 的 /api/v1
      invoke<string | undefined>('get_api_base')
        .then((base) => {
          if (cancelled) return
          if (base) {
            api.defaults.baseURL = base
            setReady(true)
          } else if (tries++ < 90) {
            setTimeout(poll, 1000) // sidecar 启动中，1s 后重试（最多 90s）
          } else {
            setReady(true) // 超时降级
          }
        })
        .catch(() => {
          if (!cancelled) setReady(true) // 非 Tauri 环境
        })
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-500">
        后端启动中…
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks/new" element={<NewTask />} />
            <Route path="/library" element={<Library />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
