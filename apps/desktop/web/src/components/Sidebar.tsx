import { NavLink } from 'react-router-dom'
import { ChartBar, FolderOpen, Gear, House, Plus, Robot } from '@phosphor-icons/react'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

const items = [
  { to: '/', key: 'nav.dashboard', Icon: House },
  { to: '/tasks/new', key: 'nav.newTask', Icon: Plus },
  { to: '/library', key: 'nav.library', Icon: FolderOpen },
  { to: '/reports', key: 'nav.reports', Icon: ChartBar },
  { to: '/providers', key: 'nav.providers', Icon: Robot },
  { to: '/settings', key: 'nav.settings', Icon: Gear },
]

export function Sidebar() {
  const { t } = useI18n()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-neutral-900">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-lg font-bold tracking-tight">{t('brand')}</div>
        <div className="text-xs text-neutral-500">{t('tagline')}</div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map(({ to, key, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
              }`
            }
          >
            <Icon size={18} weight="regular" />
            {t(key)}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <LanguageSwitcher />
        <span className="font-mono text-xs text-neutral-600">v0.1.0</span>
      </div>
    </aside>
  )
}
