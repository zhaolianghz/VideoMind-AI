import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { collectBatch, collectVideo } from '../api/videos'
import { collectChannel } from '../api/creators'
import { isDouyinLink } from '../api/platforms'
import { isTauri } from '../utils/tauri'
import { useI18n } from '../i18n'

/** iOS 风格开关 + 文案 */
function Switch({ checked, disabled, onChange, children }: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center gap-2.5 text-sm text-primary transition-opacity ${
        disabled ? 'cursor-not-allowed opacity-40' : ''
      }`}
    >
      <span
        className="relative block h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? 'var(--success)' : 'var(--fill)',
          boxShadow: checked ? 'none' : 'inset 0 0 0 1px var(--border)',
        }}
      >
        <span
          className="absolute left-0 top-[2px] block h-[18px] w-[18px] rounded-full bg-white shadow"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(2px)',
            transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        />
      </span>
      {children}
    </button>
  )
}

export function NewTask() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'single' | 'batch' | 'channel'>('single')
  const [url, setUrl] = useState('')
  const [batchText, setBatchText] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [channelLimit, setChannelLimit] = useState(20)
  const [download, setDownload] = useState(true)
  const [autoTranscribe, setAutoTranscribe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureStage, setCaptureStage] = useState<'idle' | 'open' | 'importing'>('idle')

  const batchUrls = batchText.split('\n').map((s) => s.trim()).filter(Boolean)

  const submit = () => {
    setError(null)
    setSubmitting(true)
    const done = () => navigate('/library')
    const fail = (e: unknown) => {
      if (isAxiosError(e) && typeof e.response?.data?.detail === 'string') {
        setError(e.response.data.detail)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    const fin = () => setSubmitting(false)

    if (mode === 'single') {
      if (!url.trim()) {
        setSubmitting(false)
        return
      }
      collectVideo({ url: url.trim(), download, auto_transcribe: autoTranscribe }).then(done).catch(fail).finally(fin)
    } else if (mode === 'batch') {
      if (batchUrls.length === 0) {
        setSubmitting(false)
        return
      }
      collectBatch(batchUrls, download, autoTranscribe).then(done).catch(fail).finally(fin)
    } else {
      if (!channelUrl.trim()) {
        setSubmitting(false)
        return
      }
      // 抖音博主主页：yt-dlp 不支持，走应用内 webview 采集（仅桌面端）
      if (isDouyinLink(channelUrl)) {
        void submitDouyinCreator()
        return
      }
      collectChannel(channelUrl.trim(), channelLimit, download, autoTranscribe)
        .then(done)
        .catch(fail)
        .finally(fin)
    }
  }

  // 抖音博主主页采集：Rust 开可见 webview 加载主页 → 注入脚本抓视频 URL →
  // 经 douyin-capture-done 事件回传 → 批量入库（每条 /video/<id> yt-dlp 支持）
  const submitDouyinCreator = async () => {
    if (!isTauri()) {
      setError(t('newTask.captureNeedDesktop'))
      setSubmitting(false)
      return
    }
    let unlistenDone: (() => void) | undefined
    let unlistenCancel: (() => void) | undefined
    const teardown = () => {
      unlistenDone?.()
      unlistenCancel?.()
    }
    unlistenDone = await listen<{ count: number; urls: string[] }>(
      'douyin-capture-done',
      async (ev) => {
        teardown()
        const urls = ev.payload.urls
        if (!urls.length) {
          setSubmitting(false)
          setCaptureStage('idle')
          setError(t('newTask.captureNone'))
          return
        }
        setCaptureStage('importing')
        try {
          await collectBatch(urls, download, autoTranscribe)
          navigate('/library')
        } catch (e) {
          setCaptureStage('idle')
          setError(
            isAxiosError(e) && typeof e.response?.data?.detail === 'string'
              ? e.response.data.detail
              : e instanceof Error
                ? e.message
                : String(e),
          )
        } finally {
          setSubmitting(false)
        }
      },
    )
    unlistenCancel = await listen('douyin-capture-cancelled', () => {
      teardown()
      setSubmitting(false)
      setCaptureStage('idle')
      setError(t('newTask.captureCancelled'))
    })
    try {
      await invoke('collect_douyin_creator', {
        url: channelUrl.trim(),
        limit: channelLimit,
      })
      setCaptureStage('open')
    } catch (e) {
      teardown()
      setSubmitting(false)
      setCaptureStage('idle')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const canSubmit = !submitting && (
    mode === 'single' ? !!url.trim() : mode === 'batch' ? batchUrls.length > 0 : !!channelUrl.trim()
  )
  const submitLabel = submitting
    ? t('newTask.submitting')
    : mode === 'single'
      ? t('newTask.startCollect')
      : mode === 'batch'
        ? `${t('newTask.batchCollect')} ${batchUrls.length}`
        : `${t('newTask.channelCollect')} ${channelLimit} ${t('newTask.items')}`

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-10">
      {/* 标题区：居中 hero */}
      <div className="vm-reveal text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('newTask.title')}</h1>
        <p className="mt-2 text-secondary">{t('newTask.subtitle')}</p>
      </div>

      {/* 模式切换：分段控件 */}
      <div className="vm-reveal mt-8 inline-flex rounded-full bg-fill p-1" style={{ animationDelay: '60ms' }}>
        {(['single', 'batch', 'channel'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              mode === m
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {m === 'single' ? t('newTask.single') : m === 'batch' ? t('newTask.batch') : t('newTask.channel')}
          </button>
        ))}
      </div>

      {/* 输入区：hero 输入框直接铺在页面上 */}
      <div className="vm-reveal mt-6 w-full" style={{ animationDelay: '120ms' }}>
        {mode === 'single' ? (
          <input
            className="vm-hero-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('newTask.urlLabel') + ' — https://www.bilibili.com/video/…  |  v.douyin.com/…'}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            autoFocus
          />
        ) : mode === 'batch' ? (
          <div>
            <textarea
              className="vm-hero-input min-h-[180px] resize-y font-mono !text-xs leading-relaxed"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={`${t('newTask.batchLabel')}\nhttps://www.bilibili.com/video/BV1…\nhttps://v.douyin.com/xxx/\nhttps://www.douyin.com/video/…`}
              autoFocus
            />
            <div className="mt-2 text-right font-mono text-xs text-tertiary">
              {batchUrls.length > 0 && (
                <span className="font-bold" style={{ color: 'var(--viz-1)' }}>{batchUrls.length}</span>
              )}{batchUrls.length > 0 ? ' ' : '0 '}
              {t('newTask.validUrls')}
            </div>
          </div>
        ) : (
          <div>
            <input
              className="vm-hero-input"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder={t('newTask.channelLabel') + ' — https://space.bilibili.com/…  |  youtube.com/@…'}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
              autoFocus
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-secondary">{t('newTask.channelLimit')}</span>
              <input
                type="number"
                min={1}
                max={100}
                className="vm-input w-24 text-center"
                value={channelLimit}
                onChange={(e) =>
                  setChannelLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                }
              />
              <span className="text-xs text-tertiary">{t('newTask.channelHint')}</span>
            </div>
          </div>
        )}
      </div>

      {/* 选项 + 发射键：一行收尾 */}
      <div
        className="vm-reveal mt-6 flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-4"
        style={{ animationDelay: '180ms' }}
      >
        <div className="flex flex-col gap-3">
          <Switch checked={download} onChange={setDownload}>
            {t('newTask.download')}
          </Switch>
          <Switch checked={autoTranscribe} onChange={setAutoTranscribe} disabled={!download}>
            {t('newTask.autoTranscribe')}
          </Switch>
        </div>
        <button onClick={submit} disabled={!canSubmit} className="vm-btn-hero shrink-0">
          {submitLabel} →
        </button>
      </div>

      {captureStage !== 'idle' && (
        <div className="mt-5 w-full rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-primary">
          {captureStage === 'importing'
            ? t('newTask.captureImporting')
            : t('newTask.captureOpen')}
        </div>
      )}

      {error && (
        <div className="mt-5 w-full rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <p className="vm-reveal mt-10 text-xs text-tertiary" style={{ animationDelay: '240ms' }}>
        {t('newTask.support')}
      </p>
    </div>
  )
}
