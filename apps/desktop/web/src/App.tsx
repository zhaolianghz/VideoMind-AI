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
 * 启动等待屏 v2：猫头鹰居中（洞察 = VideoMind），外围 5 个视频平台 logo
 * 沿圆环分布、依次脉冲点亮，配旋转光弧。sidecar 冷启动时陪伴用户。
 */
function LoadingScreen({ label }: { label: string }) {
  const steps = ['正在唤醒分析引擎', '连接视频平台', '加载转录模型', '即将就绪']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((x) => (x + 1) % steps.length), 2200)
    return () => clearInterval(id)
  }, [])

  const R = 118
  const C = 150
  // YouTube / B站 / 抖音 / 快手 / 小红书 —— 单色简化 logo（随 accent 上色）
  const platforms = [
    <g><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="var(--surface)" /></g>,
    <g><rect x="3" y="7" width="18" height="12" rx="3" /><path d="M7 7l-3-3M17 7l3-3" stroke="currentColor" strokeWidth="1.6" fill="none" /><circle cx="9.5" cy="13" r="1.1" fill="var(--surface)" /><circle cx="14.5" cy="13" r="1.1" fill="var(--surface)" /></g>,
    <path d="M9 17a2.4 2.4 0 1 1 2.4-2.4V6.5l8-1.4v2.6l-6 1V15A2.4 2.4 0 0 1 9 17z" />,
    <path d="M13 2L4 14h6l-1.2 8L18 9.8h-6z" />,
    <path d="M12 20s-7-4.6-7-9.6C5 7.4 7 6 9 6c1.5 0 2.4 1 3 2 .6-1 1.5-2 3-2 2 0 4 1.4 4 4.4 0 5-7 9.6-7 9.6z" />,
  ]

  return (
    <div className="vm-bg flex h-screen flex-col items-center justify-center gap-7">
      <div className="vm-splash" style={{ color: 'var(--accent)' }}>
        <div className="vm-splash-stage">
          <div className="vm-splash-ring" />
          {platforms.map((glyph, i) => {
            const a = ((-90 + i * (360 / platforms.length)) * Math.PI) / 180
            return (
              <div
                key={i}
                className="vm-splash-badge"
                style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a), animationDelay: `${i * 0.52}s` }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">{glyph}</svg>
              </div>
            )
          })}
          <div className="vm-splash-core">
            <svg width="96" height="96" viewBox="0 0 120 120" fill="none" role="img" aria-label={label}>
              <circle className="owl-glow" cx="60" cy="60" r="42" fill="url(#owlGlow)" />
              <g className="owl-float">
                <path d="M34 40 L40 22 L52 34 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M86 40 L80 22 L68 34 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <ellipse cx="60" cy="62" rx="30" ry="34" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
                <circle cx="48" cy="54" r="13" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="72" cy="54" r="13" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
                <circle className="owl-eye left" cx="48" cy="54" r="6.5" fill="currentColor" />
                <circle className="owl-eye right" cx="72" cy="54" r="6.5" fill="currentColor" />
                <circle cx="50" cy="51.5" r="1.8" fill="var(--surface)" />
                <circle cx="74" cy="51.5" r="1.8" fill="var(--surface)" />
                <path d="M60 60 L55 68 L65 68 Z" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1" strokeLinejoin="round" />
              </g>
              <defs>
                <radialGradient id="owlGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-lg font-semibold tracking-wide" style={{ color: 'var(--primary)' }}>
            VideoMind AI
          </div>
          <div className="flex items-center gap-1 text-sm text-secondary">
            <span>{steps[step]}</span>
            <span className="owl-dots"><span>.</span><span>.</span><span>.</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
