import { createContext, useContext, useState, type ReactNode } from 'react'
import { zh } from './locales/zh'
import { en } from './locales/en'

export type Locale = 'zh' | 'en'

const dicts: Record<Locale, typeof zh> = { zh, en }

function lookup(d: typeof zh, key: string): string {
  const v = key.split('.').reduce<unknown>((o, k) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[k]
    return undefined
  }, d)
  return typeof v === 'string' ? v : key
}

interface I18nCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const Ctx = createContext<I18nCtx>({ locale: 'zh', setLocale: () => {}, t: (k) => k })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem('vm-locale') as Locale) || 'zh',
  )
  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('vm-locale', l)
  }
  const t = (key: string) => lookup(dicts[locale], key)
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
