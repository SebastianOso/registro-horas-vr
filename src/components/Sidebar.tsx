import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOutIcon } from './icons'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

interface SidebarProps {
  profile: { nombre: string; rol: string }
  navItems: NavItem[]
  onNavigate?: () => void
}

export function Sidebar({ profile, navItems, onNavigate }: SidebarProps) {
  const iniciales = profile.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="flex h-full w-64 flex-col border-r border-muted/10 bg-surface p-4">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-600 font-bold text-on-brand">
          R
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-ink">Registro de horas</span>
          <span className="text-xs text-muted">Zona de realidad virtual</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-card px-2.5 py-2 text-sm ${
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'font-medium text-ink/80 hover:bg-canvas'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-muted/10 pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-on-brand">
          {iniciales || '?'}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-ink">{profile.nombre}</span>
          <span className="text-xs capitalize text-muted">{profile.rol}</span>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          aria-label="Cerrar sesión"
          className="rounded-card p-1.5 text-muted hover:bg-canvas"
        >
          <LogOutIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>
  )
}
