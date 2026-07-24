import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import logoBilibili from '@lobehub/icons-static-svg/icons/bilibili-color.svg'
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
  const [bootStage, setBootStage] = useState('starting')
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
            // 升级后首启需解压组件（约半分钟），把阶段同步到 splash 文案
            invoke<string>('get_boot_stage')
              .then((s) => !cancelled && setBootStage(s))
              .catch(() => undefined)
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
        <AppShell ready={ready} bootStage={bootStage} />
      </I18nProvider>
    </ThemeProvider>
  )
}

function AppShell({ ready, bootStage }: { ready: boolean; bootStage: string }) {
  const { t } = useI18n()

  if (!ready) {
    return (
      <LoadingScreen
        label={bootStage === 'extracting' ? t('common.extracting') : t('common.starting')}
      />
    )
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

/** TikTok/抖音共用的音符 glyph */
const NOTE_PATH =
  'M14.5 2h2.1c.35 1.9 1.6 3.35 3.4 3.72v2.4c-1.25-.03-2.42-.4-3.4-1.04v6.62a5.35 5.35 0 1 1-5.35-5.35c.27 0 .54.02.8.07v2.5a2.85 2.85 0 1 0 2.05 2.78V2z'

/** 各平台品牌 glyph（手绘极简版；B站用官方彩色 svg） */
const PLATFORM_GLYPHS: Array<{ key: string; node: React.ReactNode }> = [
  {
    key: 'youtube',
    node: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0033" />
        <path d="M10 9.2 15.6 12 10 14.8Z" fill="#fff" />
      </svg>
    ),
  },
  {
    key: 'bilibili',
    node: <img src={logoBilibili} alt="" className="h-6 w-6" />,
  },
  {
    key: 'douyin',
    node: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect width="24" height="24" rx="6" fill="#161823" />
        <g transform="scale(0.75) translate(4.2 4.2)">
          <path d={NOTE_PATH} fill="#25F4EE" transform="translate(-1 -0.7)" />
          <path d={NOTE_PATH} fill="#FE2C55" transform="translate(1 0.7)" />
          <path d={NOTE_PATH} fill="#fff" />
        </g>
      </svg>
    ),
  },
  {
    key: 'kuaishou',
    node: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect width="24" height="24" rx="6" fill="#FF4906" />
        <circle cx="9.2" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="16.2" cy="12" r="2.3" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: 'xiaohongshu',
    node: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect width="24" height="24" rx="5" fill="#FF2442" />
        <text
          x="12"
          y="16.2"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#fff"
        >
          红
        </text>
      </svg>
    ),
  },
  {
    key: 'tiktok',
    node: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path d={NOTE_PATH} fill="#25F4EE" transform="translate(-0.9 -0.6)" />
        <path d={NOTE_PATH} fill="#FE2C55" transform="translate(0.9 0.6)" />
        <path d={NOTE_PATH} fill="var(--text-primary)" />
      </svg>
    ),
  },
]

const ORBIT_PERIOD = 26 // 公转一圈秒数，与 CSS vm-orbit-run 保持一致

/**
 * 启动等待屏：中心霓虹猫头鹰（洞察 = VideoMind 的隐喻），
 * 外圈各视频平台 logo 沿轨道公转、依次点亮，配扫描光弧与流光进度条。
 */
function LoadingScreen({ label }: { label: string }) {
  return (
    <div
      className="vm-bg flex h-screen flex-col items-center justify-center gap-7"
      style={{ color: 'var(--accent)' }}
    >
      <div className="vm-splash-stage">
        {/* 轨道虚线 */}
        <svg width="380" height="380" viewBox="0 0 380 380" className="absolute inset-0">
          <circle
            cx="190" cy="190" r="150" fill="none"
            stroke="var(--separator)" strokeWidth="1.5" strokeDasharray="3 9"
          />
        </svg>
        {/* 扫描光弧 */}
        <div className="vm-orbit-scan">
          <svg width="380" height="380" viewBox="0 0 380 380">
            <defs>
              <linearGradient id="vmScan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <circle
              cx="190" cy="190" r="150" fill="none"
              stroke="url(#vmScan)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="72 870"
            />
          </svg>
        </div>

        {/* 平台徽章公转 */}
        {PLATFORM_GLYPHS.map((p, i) => (
          <div
            key={p.key}
            className="vm-orbit-item"
            style={{ animationDelay: `-${((ORBIT_PERIOD / PLATFORM_GLYPHS.length) * i).toFixed(2)}s` }}
          >
            <div className="vm-orbit-chip" style={{ animationDelay: `${i * 0.6}s` }}>
              {p.node}
            </div>
          </div>
        ))}

        {/* 中心猫头鹰 */}
        <svg
          width="132"
          height="132"
          viewBox="0 0 120 120"
          fill="none"
          role="img"
          aria-label={label}
          className="relative"
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
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-secondary">
          <span>{label}</span>
          <span className="owl-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
        <div className="vm-splash-bar">
          <span />
        </div>
      </div>
    </div>
  )
}
