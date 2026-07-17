import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  deleteCookie,
  listCookies,
  PLATFORM_LABELS,
  uploadCookie,
  type CookieInfo,
} from '../api/cookies'

interface Paths {
  data_dir: string
  media_dir: string
  subtitles_dir: string
  cookies_dir: string
}

export function Settings() {
  const [paths, setPaths] = useState<Paths | null>(null)
  const [cookies, setCookies] = useState<CookieInfo[]>([])
  const [editPlatform, setEditPlatform] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get<Paths>('/system/paths').then((r) => setPaths(r.data))
    listCookies().then(setCookies)
  }
  useEffect(load, [])

  const save = () => {
    if (!editPlatform || !content.trim()) return
    setSaving(true)
    uploadCookie(editPlatform, content)
      .then(() => {
        setEditPlatform(null)
        setContent('')
        load()
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">设置</h1>
      <p className="mb-8 text-neutral-500">数据目录、Cookie 与系统配置</p>

      {/* 数据目录 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">数据目录</h2>
        <div className="space-y-2 vm-card p-4 font-mono text-xs">
          {paths ? (
            <>
              <Row label="根目录" value={paths.data_dir} />
              <Row label="媒体文件" value={paths.media_dir} />
              <Row label="字幕文件" value={paths.subtitles_dir} />
              <Row label="Cookie" value={paths.cookies_dir} />
            </>
          ) : (
            <div className="text-neutral-500">加载中…</div>
          )}
        </div>
      </section>

      {/* Cookie 导入 */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-neutral-400">Cookie 导入</h2>
        <p className="mb-3 text-xs text-neutral-500">
          用于会员视频 / 登录限制。用浏览器扩展（如 Get
          cookies.txt）导出 Netscape 格式后粘贴。
        </p>
        <div className="space-y-2">
          {cookies.map((c) => (
            <div
              key={c.platform}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-neutral-900/80 px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    c.has_cookie ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                />
                <span className="text-sm">{PLATFORM_LABELS[c.platform] || c.platform}</span>
                <span className="text-xs text-neutral-500">
                  {c.has_cookie ? `${c.size} B` : '未导入'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditPlatform(c.platform)
                    setContent('')
                  }}
                  className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  {c.has_cookie ? '更新' : '导入'}
                </button>
                {c.has_cookie && (
                  <button
                    onClick={() => deleteCookie(c.platform).then(load)}
                    className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:text-red-300"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editPlatform && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setEditPlatform(null)}
        >
          <div
            className="flex w-full max-w-lg flex-col vm-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                导入 {PLATFORM_LABELS[editPlatform] || editPlatform} Cookie
              </h3>
              <button
                onClick={() => setEditPlatform(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <textarea
              className="vm-input min-h-[200px] resize-y font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tkey\tvalue'}
            />
            <p className="mt-2 text-xs text-neutral-500">
              粘贴完整的 cookies.txt 内容（Netscape 格式，首行通常是 # Netscape HTTP Cookie File）
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditPlatform(null)}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                onClick={save}
                disabled={!content.trim() || saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-neutral-500">{label}</span>
      <span className="break-all text-neutral-300">{value}</span>
    </div>
  )
}
