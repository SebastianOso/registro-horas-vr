import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface HomePageProps {
  session: Session
  profile: { nombre: string; rol: string } | null
}

export function HomePage({ session, profile }: HomePageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-ink">Hola, {profile?.nombre ?? session.user.email}</h1>
        <p className="mt-2 text-muted">Sesión iniciada correctamente.</p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-6 rounded-card bg-accent-500 px-4 py-2 font-medium text-on-brand transition-colors hover:bg-accent-600"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
