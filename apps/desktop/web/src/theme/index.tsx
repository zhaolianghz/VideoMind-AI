import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** 用户偏好；'system' 跟随 OS 外观并实时响应切换 */
export type ThemePref = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'vm-theme'

interface ThemeCtx {
  theme: ThemePref
  setTheme: (t: ThemePref) => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'system', setTheme: () => {} })

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'system' || v === 'light' || v === 'dark') return v
  } catch { /* 存储不可用 → system */ }
  return 'system'
}

/** 把偏好落到 <html data-theme>：system 时移除属性，交给 CSS 的 prefers-color-scheme */
function apply(pref: ThemePref): void {
  const el = document.documentElement
  if (pref === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', pref)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(readPref)

  const setTheme = (t: ThemePref) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
  }

  // 偏好变化 → 落到 DOM
  useEffect(() => { apply(theme) }, [theme])

  // system 模式下，OS 外观实时切换时无需改属性（CSS 媒体查询已处理），
  // 但 color-scheme 等仍靠 CSS；此处仅确保初次挂载属性正确。
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
