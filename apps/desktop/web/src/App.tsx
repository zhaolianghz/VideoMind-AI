import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Providers } from './pages/Providers'
import { NewTask } from './pages/NewTask'
import { Library } from './pages/Library'
import { VideoDetail } from './pages/VideoDetail'
import { Reports } from './pages/Reports'
import { ReportDetail } from './pages/ReportDetail'
import { DataTable } from './pages/DataTable'
import { Settings } from './pages/Settings'
import { api } from './api/client'
import { I18nProvider, useI18n } from './i18n'
import { ThemeProvider } from './theme'

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

  // Theme + i18n 包裹全部内容，让加载态也能被翻译 / 应用主题
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppShell ready={ready} />
      </I18nProvider>
    </ThemeProvider>
  )
}

function AppShell({ ready }: { ready: boolean }) {
  const { t } = useI18n()

  if (!ready) {
    return <LoadingScreen label={t('common.starting')} />
  }

  return (
    <BrowserRouter>
      <div className="vm-bg flex h-screen text-primary">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks/new" element={<NewTask />} />
            <Route path="/library" element={<Library />} />
            <Route path="/videos/:id" element={<VideoDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportDetail />} />
            <Route path="/data" element={<DataTable />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

/**
 * 启动等待屏：sidecar 冷启动可能要数十秒，用一只霓虹猫头鹰
 * （洞察 / 智慧 = VideoMind 的隐喻）陪伴，替代干巴巴的文字。
 */
function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="vm-bg flex h-screen flex-col items-center justify-center gap-6" style={{ color: 'var(--accent)' }}>
      <svg
        width="132"
        height="132"
        viewBox="0 0 120 120"
        fill="none"
        role="img"
        aria-label={label}
      >
        {/* 身后呼吸光晕 */}
        <circle className="owl-glow" cx="60" cy="60" r="42" fill="url(#owlGlow)" />
        <g className="owl-float">
          {/* 耳羽 */}
          <path d="M34 40 L40 22 L52 34 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M86 40 L80 22 L68 34 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          {/* 身体 */}
          <ellipse cx="60" cy="62" rx="30" ry="34" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
          {/* 腹部纹理 */}
          <path d="M60 44 Q72 60 60 92 Q48 60 60 44 Z" fill="currentColor" opacity="0.18" />
          {/* 眼眶 */}
          <circle cx="48" cy="54" r="14" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="72" cy="54" r="14" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          {/* 眼睛（会眨） */}
          <g>
            <circle className="owl-eye left" cx="48" cy="54" r="7" fill="currentColor" />
            <circle className="owl-eye right" cx="72" cy="54" r="7" fill="currentColor" />
            {/* 高光（不眨，保持灵动） */}
            <circle cx="50.5" cy="51.5" r="2" fill="var(--surface)" />
            <circle cx="74.5" cy="51.5" r="2" fill="var(--surface)" />
          </g>
          {/* 喙 */}
          <path d="M60 60 L55 68 L65 68 Z" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1" strokeLinejoin="round" />
          {/* 爪 */}
          <path d="M52 96 l-3 6 M56 97 l0 7 M60 97 l0 7 M64 97 l0 7 M68 96 l3 6" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <defs>
          <radialGradient id="owlGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <div className="flex items-center gap-1 text-sm text-secondary">
        <span>{label}</span>
        <span className="owl-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  )
}
