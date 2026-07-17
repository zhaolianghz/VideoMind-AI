import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collectBatch, collectVideo } from '../api/videos'

export function NewTask() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [url, setUrl] = useState('')
  const [batchText, setBatchText] = useState('')
  const [download, setDownload] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const batchUrls = batchText.split('\n').map((s) => s.trim()).filter(Boolean)

  const submit = () => {
    setError(null)
    setSubmitting(true)
    const done = () => navigate('/library')
    const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e))
    const fin = () => setSubmitting(false)

    if (mode === 'single') {
      if (!url.trim()) {
        setSubmitting(false)
        return
      }
      collectVideo({ url: url.trim(), download }).then(done).catch(fail).finally(fin)
    } else {
      if (batchUrls.length === 0) {
        setSubmitting(false)
        return
      }
      collectBatch(batchUrls, download).then(done).catch(fail).finally(fin)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">新建分析任务</h1>
      <p className="mb-6 text-neutral-500">粘贴视频链接，开始采集与转录</p>

      <div className="mb-4 flex gap-2">
        {(['single', 'batch'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
              mode === m
                ? 'bg-neutral-100 text-neutral-900'
                : 'border border-white/10 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {m === 'single' ? '单个视频' : '批量导入'}
          </button>
        ))}
      </div>

      <div className="vm-card p-6">
        {mode === 'single' ? (
          <>
            <label className="mb-1 block text-sm text-neutral-400">视频 URL</label>
            <input
              className="vm-input mb-4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.bilibili.com/video/..."
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        ) : (
          <>
            <label className="mb-1 block text-sm text-neutral-400">
              视频 URL 列表（每行一个）
            </label>
            <textarea
              className="vm-input mb-2 min-h-[160px] resize-y font-mono text-xs"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={
                'https://www.bilibili.com/video/BV1...\nhttps://www.bilibili.com/video/BV2...\nhttps://www.douyin.com/video/...'
              }
            />
            <div className="mb-4 text-xs text-neutral-500">
              {batchUrls.length} 个有效 URL（空行自动忽略）
            </div>
          </>
        )}

        <label className="mb-3 flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={download}
            onChange={(e) => setDownload(e.target.checked)}
          />
          立即下载音频（取消则仅抓取元数据）
        </label>

        {error && (
          <div className="mb-3 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || (mode === 'single' ? !url.trim() : batchUrls.length === 0)}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting
            ? '提交中…'
            : mode === 'single'
              ? '开始采集'
              : `批量采集 ${batchUrls.length || ''} 个`}
        </button>
        <p className="mt-4 text-xs text-neutral-600">
          支持：YouTube / B站 / 抖音 / 快手 / 小红书 / TikTok（会员视频请在「设置」导入 Cookie）
        </p>
      </div>
    </div>
  )
}
