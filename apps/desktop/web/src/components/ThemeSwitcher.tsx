import { Desktop, Moon, Sun } from '@phosphor-icons/react'
import { useI18n } from '../i18n'
import { useTheme, type ThemePref } from '../theme'

const OPTIONS: { pref: ThemePref; Icon: typeof Sun; labelKey: string }[] = [
  { pref: 'system', Icon: Desktop, labelKey: 'settings.appearanceSystem' },
  { pref: 'light', Icon: Sun, labelKey: 'settings.appearanceLight' },
  { pref: 'dark', Icon: Moon, labelKey: 'settings.appearanceDark' },
]

/**
 * 主题切换：Apple 风格分段控件。
 * variant="compact" → 仅图标（侧边栏页脚）；"full" → 图标 + 文字（设置页）。
 */
export function ThemeSwitcher({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const full = variant === 'full'
  return (
    <div className="flex rounded-lg border border-app p-0.5">
      {OPTIONS.map(({ pref, Icon, labelKey }) => {
        const active = theme === pref
        return (
          <button
            key={pref}
            onClick={() => setTheme(pref)}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            className={`flex items-center justify-center gap-1.5 rounded transition-colors ${
              full ? 'flex-1 px-3 py-1.5 text-sm' : 'px-2 py-1'
            } ${
              active ? 'bg-fill text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            <Icon size={full ? 16 : 15} weight={active ? 'fill' : 'regular'} />
            {full && <span className="font-medium">{t(labelKey)}</span>}
          </button>
        )
      })}
    </div>
  )
}
