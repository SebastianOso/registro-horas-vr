import { useState } from 'react'
import type { ReactNode } from 'react'
import { MenuIcon } from './icons'
import type { NavItem } from './Sidebar'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  profile: { nombre: string; rol: string }
  navItems: NavItem[]
  children: ReactNode
}

export function AppShell({ profile, navItems, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="hidden md:block">
        <Sidebar profile={profile} navItems={navItems} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar profile={profile} navItems={navItems} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-muted/10 bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="rounded-card p-1 text-ink"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <span className="text-sm font-semibold text-ink">Registro de horas</span>
        </header>

        <main className="flex-1 p-5 md:p-10">{children}</main>
      </div>
    </div>
  )
}
