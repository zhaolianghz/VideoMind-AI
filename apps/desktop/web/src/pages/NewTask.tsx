import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { collectBatch, collectVideo, importLocalVideos } from '../api/videos'
import { collectChannel } from '../api/creators'
import { isDouyinLink } from '../api/platforms'
import { isTauri, MEDIA_EXTENSIONS, pickMediaFiles } from '../utils/tauri'
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
  const [mode, setMode] = useState<'single' | 'batch' | 'channel' | 'local'>('single')
  const [url, setUrl] = useState('')
  const [localPaths, setLocalPaths] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
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
    } else if (mode === 'local') {
      if (localPaths.length === 0) {
        setSubmitting(false)
        return
      }
      importLocalVideos(localPaths, autoTranscribe)
        .then((r) => {
          if (r.created === 0) {
            setError(
              r.skipped > 0
                ? t('newTask.localAllSkipped')
                : t('newTask.localNoValid'),
            )
            return
          }
          done()
        })
        .catch(fail)
        .finally(fin)
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

  // 原生文件选择框（仅桌面端：后端按绝对路径读文件，浏览器给不出真实路径）
  const pickFiles = async () => {
    if (!isTauri()) {
      setError(t('newTask.localNeedDesktop'))
      return
    }
    const picked = await pickMediaFiles()
    if (picked.length === 0) return
    setError(null)
    setLocalPaths((prev) => [...new Set([...prev, ...picked])])
  }

  // 拖拽入窗：Tauri 的 drag-drop 事件带真实文件路径（HTML5 的 File 对象没有）
  useEffect(() => {
    if (mode !== 'local' || !isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    void getCurrentWebview()
      .onDragDropEvent((ev) => {
        if (ev.payload.type === 'over') {
          setDragOver(true)
        } else if (ev.payload.type === 'drop') {
          setDragOver(false)
          const accepted = ev.payload.paths.filter((p) =>
            MEDIA_EXTENSIONS.includes(p.split('.').pop()?.toLowerCase() ?? ''),
          )
          if (accepted.length === 0) {
            setError(t('newTask.localNoValid'))
            return
          }
          setError(null)
          setLocalPaths((prev) => [...new Set([...prev, ...accepted])])
        } else {
          setDragOver(false)
        }
      })
      .then((un) => {
        if (cancelled) un()
        else unlisten = un
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const canSubmit = !submitting && (
    mode === 'single'
      ? !!url.trim()
      : mode === 'batch'
        ? batchUrls.length > 0
        : mode === 'local'
          ? localPaths.length > 0
          : !!channelUrl.trim()
  )
  const submitLabel = submitting
    ? t('newTask.submitting')
    : mode === 'single'
      ? t('newTask.startCollect')
      : mode === 'batch'
        ? `${t('newTask.batchCollect')} ${batchUrls.length}`
        : mode === 'local'
          ? `${t('newTask.localImport')} ${localPaths.length}`
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
        {(['single', 'batch', 'channel', 'local'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              mode === m
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {t('newTask.' + m)}
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
        ) : mode === 'local' ? (
          <div>
            <button
              type="button"
              onClick={pickFiles}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${
                dragOver
                  ? 'border-accent bg-accent/10'
                  : 'border-app hover:border-accent/50 hover:bg-fill'
              }`}
            >
              <span className="text-sm font-medium text-primary">
                {dragOver ? t('newTask.localDropNow') : t('newTask.localPick')}
              </span>
              <span className="text-xs text-tertiary">{t('newTask.localHint')}</span>
            </button>
            {localPaths.length > 0 && (
              <div className="mt-3 max-h-52 space-y-1 overflow-auto">
                {localPaths.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 rounded-lg bg-fill px-3 py-1.5 text-xs"
                  >
                    <span className="truncate font-mono text-secondary" title={p}>
                      {p.split(/[/\\]/).pop()}
                    </span>
                    <button
                      onClick={() => setLocalPaths((prev) => prev.filter((x) => x !== p))}
                      className="ml-auto shrink-0 text-tertiary hover:text-danger"
                      aria-label="remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="pt-1 text-right font-mono text-xs text-tertiary">
                  <span className="font-bold" style={{ color: 'var(--viz-1)' }}>
                    {localPaths.length}
                  </span>{' '}
                  {t('newTask.localSelected')}
                </div>
              </div>
            )}
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
          {/* 本地导入没有「下载」这一步（文件已在本机） */}
          {mode !== 'local' && (
            <Switch checked={download} onChange={setDownload}>
              {t('newTask.download')}
            </Switch>
          )}
          <Switch
            checked={autoTranscribe}
            onChange={setAutoTranscribe}
            disabled={mode !== 'local' && !download}
          >
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
