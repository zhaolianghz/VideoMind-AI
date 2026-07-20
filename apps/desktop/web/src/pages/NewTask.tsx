import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { collectBatch, collectVideo } from '../api/videos'
import { collectChannel } from '../api/creators'

export function NewTask() {
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

  const batchUrls = batchText.split('\n').map((s) => s.trim()).filter(Boolean)

  const submit = () => {
    setError(null)
    setSubmitting(true)
    const done = () => navigate('/library')
    const fail = (e: unknown) => {
      // FastAPI 的 HTTPException detail 里有具体原因（如需要 Cookie），优先展示
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
      collectChannel(channelUrl.trim(), channelLimit, download, autoTranscribe)
        .then(done)
        .catch(fail)
        .finally(fin)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">新建分析任务</h1>
      <p className="mb-6 text-neutral-500">粘贴视频链接，开始采集与转录</p>

      <div className="mb-4 flex gap-2">
        {(['single', 'batch', 'channel'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
              mode === m
                ? 'bg-neutral-100 text-neutral-900'
                : 'border border-white/10 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {m === 'single' ? '单个视频' : m === 'batch' ? '批量导入' : '按博主采集'}
          </button>
        ))}
      </div>

      <div className="vm-card p-6">
        {mode === 'single' ? (
          <>
            <label className="mb-1 block text-sm text-neutral-400">
              视频 URL / 分享口令
            </label>
            <input
              className="vm-input mb-4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="支持直接粘贴 App 分享口令，如「2.38 复制打开抖音… https://v.douyin.com/xxx/ …」"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        ) : mode === 'batch' ? (
          <>
            <label className="mb-1 block text-sm text-neutral-400">
              视频 URL 列表（每行一个，支持分享口令）
            </label>
            <textarea
              className="vm-input mb-2 min-h-[160px] resize-y font-mono text-xs"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={
                'https://www.bilibili.com/video/BV1...\n2.38 复制打开抖音，看看… https://v.douyin.com/xxx/ …\nhttps://www.douyin.com/video/...'
              }
            />
            <div className="mb-4 text-xs text-neutral-500">
              {batchUrls.length} 个有效 URL（空行自动忽略）
            </div>
          </>
        ) : (
          <>
            <label className="mb-1 block text-sm text-neutral-400">
              博主主页 / 频道链接
            </label>
            <input
              className="vm-input mb-3"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://space.bilibili.com/... 或 https://www.youtube.com/@..."
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <label className="mb-1 block text-sm text-neutral-400">
              采集最近多少条
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className="vm-input mb-2 w-28"
              value={channelLimit}
              onChange={(e) =>
                setChannelLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
            />
            <div className="mb-4 text-xs text-neutral-500">
              已入库的视频自动跳过，不会重复采集。抖音/B站主页需先在「设置」导入 Cookie。
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

        <label className="mb-3 flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={autoTranscribe}
            onChange={(e) => setAutoTranscribe(e.target.checked)}
            disabled={!download}
          />
          下载完成后自动转录（全自动流水线，无需逐条点「转录」）
        </label>

        {error && (
          <div className="mb-3 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={
            submitting ||
            (mode === 'single'
              ? !url.trim()
              : mode === 'batch'
                ? batchUrls.length === 0
                : !channelUrl.trim())
          }
          className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
        >
          {submitting
            ? '提交中…'
            : mode === 'single'
              ? '开始采集'
              : mode === 'batch'
                ? `批量采集 ${batchUrls.length || ''} 个`
                : `采集该博主最近 ${channelLimit} 条`}
        </button>
        <p className="mt-4 text-xs text-neutral-600">
          支持：YouTube / B站 / 抖音 / 快手 / 小红书 / TikTok（会员视频请在「设置」导入 Cookie）
        </p>
      </div>
    </div>
  )
}
