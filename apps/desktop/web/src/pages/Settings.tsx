import { useEffect, useState } from 'react'
import {
  BrowserOption,
  CookieInfo,
  deleteCookie,
  importCookieFromBrowser,
  listBrowsers,
  listCookies,
  PLATFORM_LABELS,
  uploadCookie,
} from '../api/cookies'
import { getPaths, PathsInfo } from '../api/system'
import { getPreferences, putPreferences, Preferences } from '../api/preferences'

const errText = (e: unknown): string => {
  const anyErr = e as { response?: { data?: { detail?: string } }; message?: string }
  return anyErr?.response?.data?.detail ?? anyErr?.message ?? String(e)
}

function CookieRow({
  info,
  browsers,
  onChanged,
}: {
  info: CookieInfo
  browsers: BrowserOption[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null) // 正在读取的浏览器
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState('')

  const label = PLATFORM_LABELS[info.platform] ?? info.platform

  const doImport = async (browser: string) => {
    setBusy(browser)
    setMsg(null)
    try {
      const r = await importCookieFromBrowser(info.platform, browser)
      setMsg({ ok: true, text: `已从 ${browser} 导入 ${r.cookies} 条 Cookie` })
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: errText(e) })
    } finally {
      setBusy(null)
    }
  }

  const doManualSave = async () => {
    setMsg(null)
    try {
      await uploadCookie(info.platform, manual)
      setMsg({ ok: true, text: '已保存手动粘贴的 Cookie' })
      setManual('')
      setShowManual(false)
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: errText(e) })
    }
  }

  const doDelete = async () => {
    await deleteCookie(info.platform)
    setMsg(null)
    onChanged()
  }

  return (
    <div className="vm-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            info.has_cookie
              ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
              : 'bg-neutral-600'
          }`}
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-100">{label}</div>
          <div className="text-xs text-neutral-500">
            {info.has_cookie
              ? `已配置 · ${(info.size / 1024).toFixed(1)} KB${
                  info.updated_at ? ` · 更新于 ${info.updated_at.slice(0, 19).replace('T', ' ')}` : ''
                }`
              : '未配置 — 遇到“需要登录/确认不是机器人”时需导入'}
          </div>
        </div>
        {info.has_cookie && (
          <button
            onClick={doDelete}
            className="text-xs text-neutral-500 transition hover:text-red-400"
          >
            清除
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="vm-btn-neon text-xs">
          {open ? '收起' : info.has_cookie ? '重新导入' : '导入'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <div className="text-xs text-neutral-400">
            从浏览器一键导入（请先在浏览器中登录 {label}）：
          </div>
          {browsers.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              未能获取浏览器列表（后端版本过旧或未连接），请重启应用后重试
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {browsers.map((b) => (
                <button
                  key={b.name}
                  disabled={busy !== null}
                  onClick={() => doImport(b.name)}
                  className={`vm-btn-neon text-xs ${busy === b.name ? 'animate-pulse' : ''} ${
                    busy !== null && busy !== b.name ? 'opacity-40' : ''
                  }`}
                >
                  {busy === b.name ? '读取中…' : b.label}
                </button>
              ))}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-neutral-500">
            macOS 首次读取 Chrome/Edge 会弹出钥匙串授权，请点“始终允许”；读取 Safari 需给本应用
            开启“完全磁盘访问”。导入过程中建议先退出对应浏览器。
          </div>

          {msg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                msg.ok
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            onClick={() => setShowManual(!showManual)}
            className="text-xs text-neutral-500 underline-offset-2 transition hover:text-neutral-300 hover:underline"
          >
            {showManual ? '隐藏手动粘贴' : '高级：手动粘贴 Netscape 格式 Cookie'}
          </button>
          {showManual && (
            <div className="space-y-2">
              <textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                rows={6}
                placeholder={'# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t...'}
                className="vm-input w-full font-mono text-xs"
              />
              <button
                onClick={doManualSave}
                disabled={!manual.trim()}
                className="vm-btn-primary text-xs disabled:opacity-40"
              >
                保存
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Settings() {
  const [paths, setPaths] = useState<PathsInfo | null>(null)
  const [cookies, setCookies] = useState<CookieInfo[]>([])
  const [browsers, setBrowsers] = useState<BrowserOption[]>([])
  const [prefs, setPrefs] = useState<Preferences>({ transcribe_model: '', transcribe_language: '' })
  const [prefMsg, setPrefMsg] = useState('')
  const [err, setErr] = useState('')

  const refreshCookies = () => {
    listCookies().then(setCookies).catch((e) => setErr(errText(e)))
  }

  useEffect(() => {
    getPaths().then(setPaths).catch(() => undefined)
    listBrowsers().then(setBrowsers).catch(() => setBrowsers([]))
    getPreferences().then(setPrefs).catch(() => undefined)
    refreshCookies()
  }, [])

  const savePref = (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    putPreferences(patch)
      .then(() => setPrefMsg('已保存，之后的转录任务生效'))
      .catch(() => setPrefMsg('保存失败'))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">设置</h1>
        <p className="mt-1 text-sm text-neutral-500">平台 Cookie 与本地存储路径</p>
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-200">平台 Cookie</h2>
          <p className="mt-1 text-xs text-neutral-500">
            YouTube 等平台风控时（提示 Sign in to confirm you&apos;re not a
            bot）需要登录态。在浏览器中登录后，点击“导入”即可一键读取，无需手动导出。
          </p>
        </div>
        <div className="space-y-3">
          {cookies.map((c) => (
            <CookieRow key={c.platform} info={c} browsers={browsers} onChanged={refreshCookies} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-200">转录偏好</h2>
          <p className="mt-1 text-xs text-neutral-500">
            自动转录与手动转录的默认参数（单次任务里手动指定的优先）
          </p>
        </div>
        <div className="vm-card flex flex-wrap items-center gap-4 p-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Whisper 模型</span>
            <select
              className="vm-select h-9"
              value={prefs.transcribe_model || 'auto'}
              onChange={(e) => savePref({ transcribe_model: e.target.value })}
            >
              <option value="auto">自动（按时长选择）</option>
              <option value="tiny">tiny（最快）</option>
              <option value="base">base</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large-v3">large-v3（最准）</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">语言</span>
            <select
              className="vm-select h-9"
              value={prefs.transcribe_language || 'auto'}
              onChange={(e) => savePref({ transcribe_language: e.target.value })}
            >
              <option value="auto">自动检测</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
            </select>
          </label>
          {prefMsg && <span className="text-xs text-cyan-300">{prefMsg}</span>}
        </div>
      </section>

      {paths && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-200">本地存储</h2>
          <div className="vm-card divide-y divide-white/[0.06] text-sm">
            {Object.entries(paths).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="shrink-0 text-neutral-400">{k}</span>
                <span className="vm-url">{String(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
