import { NavLink } from 'react-router-dom'
import { ChartBar, FolderOpen, Gear, House, Plus, Robot } from '@phosphor-icons/react'

const items = [
  { to: '/', label: '工作台', Icon: House },
  { to: '/tasks/new', label: '新建分析', Icon: Plus },
  { to: '/library', label: '视频库', Icon: FolderOpen },
  { to: '/reports', label: '报告中心', Icon: ChartBar },
  { to: '/providers', label: '模型服务商', Icon: Robot },
  { to: '/settings', label: '设置', Icon: Gear },
]

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-neutral-900">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-lg font-bold tracking-tight">VideoMind AI</div>
        <div className="text-xs text-neutral-500">视频智研助手</div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map(({ to, label, Icon }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 font-mono text-xs text-neutral-600">
        v0.1.0 · P0
      </div>
    </aside>
  )
}
