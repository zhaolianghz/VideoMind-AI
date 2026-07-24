import { useEffect, useState } from 'react'
import {
  BrowserOption,
  CookieInfo,
  deleteCookie,
  importCookieFromBrowser,
  listBrowsers,
  listCookies,
  uploadCookie,
} from '../api/cookies'
import { getPaths, PathsInfo } from '../api/system'
import { getPreferences, putPreferences, Preferences } from '../api/preferences'
import { useI18n } from '../i18n'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { isTauri, pickDirectory } from '../utils/tauri'

const APP_VERSION = '0.1.0'
const APP_REPO = 'https://github.com/zhaolianghz/VideoMind-AI'
const APP_RELEASES = `${APP_REPO}/releases`

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
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState('')

  const label = t('platformLabels.' + info.platform) || info.platform

  const doImport = async (browser: string) => {
    setBusy(browser)
    setMsg(null)
    try {
      const r = await importCookieFromBrowser(info.platform, browser)
      setMsg({
        ok: true,
        text: t('settings.imported').replace('{browser}', browser).replace('{n}', String(r.cookies)),
      })
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
      setMsg({ ok: true, text: t('settings.manualSaved') })
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
              ? 'bg-accent'
              : 'bg-fill'
          }`}
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-primary">{label}</div>
          <div className="text-xs text-secondary">
            {info.has_cookie
              ? `${t('settings.configured')} · ${(info.size / 1024).toFixed(1)} KB${
                  info.updated_at
                    ? ` · ${t('settings.updated')} ${info.updated_at.slice(0, 19).replace('T', ' ')}`
                    : ''
                }`
              : t('settings.notConfigured')}
          </div>
        </div>
        {info.has_cookie && (
          <button onClick={doDelete} className="text-xs text-secondary transition hover:text-danger">
            {t('settings.clear')}
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="vm-btn-neon text-xs">
          {open ? t('settings.collapse') : info.has_cookie ? t('settings.reimport') : t('settings.import')}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-app pt-4">
          <div className="text-xs text-secondary">
            {t('settings.browserImportHint').replace('{label}', label)}
          </div>
          {browsers.length === 0 ? (
            <div className="rounded-lg border border-app bg-warning/10 px-3 py-2 text-xs text-warning">
              {t('settings.noBrowsers')}
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
                  {busy === b.name ? t('settings.reading') : b.label}
                </button>
              ))}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-secondary">{t('settings.keychainHint')}</div>

          {msg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                msg.ok
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            onClick={() => setShowManual(!showManual)}
            className="text-xs text-secondary underline-offset-2 transition hover:text-primary hover:underline"
          >
            {showManual ? t('settings.manualHide') : t('settings.manualToggle')}
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
              <button onClick={doManualSave} disabled={!manual.trim()} className="vm-btn-primary text-xs disabled:opacity-40">
                {t('settings.save')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Settings() {
  const { t } = useI18n()
  const [paths, setPaths] = useState<PathsInfo | null>(null)
  const [cookies, setCookies] = useState<CookieInfo[]>([])
  const [browsers, setBrowsers] = useState<BrowserOption[]>([])
  const [prefs, setPrefs] = useState<Preferences>({
    transcribe_model: '',
    transcribe_language: '',
    media_dir: '',
    report_dir: '',
  })
  const [prefMsg, setPrefMsg] = useState('')
  const [storageMsg, setStorageMsg] = useState('')
  const canPick = isTauri()
  const [err, setErr] = useState('')
  const [version, setVersion] = useState(APP_VERSION)

  const refreshCookies = () => {
    listCookies().then(setCookies).catch((e) => setErr(errText(e)))
  }

  useEffect(() => {
    getPaths().then(setPaths).catch(() => undefined)
    listBrowsers().then(setBrowsers).catch(() => setBrowsers([]))
    getPreferences().then(setPrefs).catch(() => undefined)
    refreshCookies()
    if (isTauri()) {
      import('@tauri-apps/api/app')
        .then((m) => m.getVersion())
        .then(setVersion)
        .catch(() => undefined)
    }
  }, [])

  const savePref = (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    putPreferences(patch)
      .then(() => setPrefMsg(t('settings.prefSaved')))
      .catch(() => setPrefMsg(t('settings.prefFail')))
  }

  const changeDir = (key: 'media_dir' | 'report_dir') => {
    pickDirectory().then((picked) => {
      if (!picked) return
      putPreferences({ [key]: picked } as Partial<Preferences>)
        .then(() => Promise.all([getPreferences(), getPaths()]))
        .then(([p, pa]) => {
          setPrefs(p)
          setPaths(pa)
          setStorageMsg(t('settings.dirUpdated'))
        })
        .catch(() => setStorageMsg(t('settings.dirUpdateFail')))
    })
  }

  const resetDir = (key: 'media_dir' | 'report_dir') => {
    putPreferences({ [key]: '' } as Partial<Preferences>)
      .then(() => Promise.all([getPreferences(), getPaths()]))
      .then(([p, pa]) => {
        setPrefs(p)
        setPaths(pa)
        setStorageMsg(t('settings.dirRestored'))
      })
      .catch(() => setStorageMsg(t('settings.dirUpdateFail')))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-secondary">{t('settings.subtitle')}</p>
      </div>

      {err && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-primary">{t('settings.appearance')}</h2>
          <p className="mt-1 text-xs text-secondary">{t('settings.appearanceHint')}</p>
        </div>
        <div className="max-w-xs">
          <ThemeSwitcher variant="full" />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-primary">{t('settings.cookieTitle')}</h2>
          <p className="mt-1 text-xs text-secondary">{t('settings.cookieHint')}</p>
        </div>
        <div className="space-y-3">
          {cookies.map((c) => (
            <CookieRow key={c.platform} info={c} browsers={browsers} onChanged={refreshCookies} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-primary">{t('settings.prefTitle')}</h2>
          <p className="mt-1 text-xs text-secondary">{t('settings.prefHint')}</p>
        </div>
        <div className="vm-card flex flex-wrap items-center gap-4 p-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs text-secondary">{t('settings.whisperModel')}</span>
            <select
              className="vm-select h-9"
              value={prefs.transcribe_model || 'auto'}
              onChange={(e) => savePref({ transcribe_model: e.target.value })}
            >
              <option value="auto">{t('settings.autoModel')}</option>
              <option value="tiny">tiny</option>
              <option value="base">base</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large-v3">large-v3</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs text-secondary">{t('settings.language')}</span>
            <select
              className="vm-select h-9"
              value={prefs.transcribe_language || 'auto'}
              onChange={(e) => savePref({ transcribe_language: e.target.value })}
            >
              <option value="auto">{t('settings.autoDetect')}</option>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {prefMsg && <span className="text-xs text-accent">{prefMsg}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-primary">{t('settings.storageDirTitle')}</h2>
          <p className="mt-1 text-xs text-secondary">{t('settings.storageDirHint')}</p>
        </div>
        <div className="vm-card divide-y divide-separator">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm text-primary">{t('settings.mediaDirLabel')}</div>
              <div className="vm-url mt-0.5">{paths?.media_dir ?? t('common.loading')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => changeDir('media_dir')}
                disabled={!canPick}
                className="vm-btn-neon text-xs disabled:opacity-40"
              >
                {t('settings.change')}
              </button>
              {prefs.media_dir && (
                <button
                  onClick={() => resetDir('media_dir')}
                  className="text-xs text-tertiary transition hover:text-danger"
                >
                  {t('settings.resetDefault')}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm text-primary">{t('settings.reportDirLabel')}</div>
              <div className="vm-url mt-0.5">{paths?.report_dir ?? t('common.loading')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => changeDir('report_dir')}
                disabled={!canPick}
                className="vm-btn-neon text-xs disabled:opacity-40"
              >
                {t('settings.change')}
              </button>
              {prefs.report_dir && (
                <button
                  onClick={() => resetDir('report_dir')}
                  className="text-xs text-tertiary transition hover:text-danger"
                >
                  {t('settings.resetDefault')}
                </button>
              )}
            </div>
          </div>
        </div>
        {storageMsg && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
            {storageMsg}
          </div>
        )}
        {!canPick && (
          <div className="text-[11px] text-warning">
            {t('settings.pickUnavailable')}
          </div>
        )}
        <div className="text-[11px] leading-relaxed text-tertiary">
          {t('settings.mediaDirNote')}
        </div>
      </section>

      {paths && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-primary">{t('settings.storageTitle')}</h2>
          <div className="vm-card divide-y divide-app text-sm">
            {Object.entries(paths).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="shrink-0 text-secondary">{k}</span>
                <span className="vm-url">{String(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-primary">{t('settings.aboutTitle')}</h2>
        <div className="vm-card flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">VideoMind AI</span>
              <span className="vm-url shrink-0">v{version}</span>
            </div>
            <div className="mt-1 text-xs text-secondary">{t('settings.aboutHint')}</div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <a
              href={APP_RELEASES}
              target="_blank"
              rel="noreferrer"
              className="vm-btn-primary text-xs"
            >
              {t('settings.checkUpdate')}
            </a>
            <a
              href={APP_REPO}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-secondary transition-colors hover:text-accent"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
