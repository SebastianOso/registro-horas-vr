import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ChangePasswordPageProps {
  /** Refresca el perfil en caché del padre para que deje de forzar esta pantalla. */
  onSuccess: () => Promise<void>
}

export function ChangePasswordPage({ onSuccess }: ChangePasswordPageProps) {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser distinta de la actual.')
      return
    }

    setLoading(true)
    const { error: invokeError } = await supabase.functions.invoke<{ error?: string }>(
      'cambiar-password-forzado',
      { body: { currentPassword, newPassword } },
    )
    setLoading(false)

    if (invokeError) {
      // supabase-js mete cualquier respuesta no-2xx en `error`, con el body original
      // (nuestro { error: '<mensaje>' }) accesible solo vía error.context, un Response sin
      // consumir — nunca en `data`.
      const body =
        'context' in invokeError && invokeError.context instanceof Response
          ? await invokeError.context.json().catch(() => null)
          : null
      setError(body?.error ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.')
      return
    }

    await onSuccess()
    navigate('/', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-ink">Cambia tu contraseña</h1>
        <p className="mt-1 text-sm text-muted">
          Tu cuenta todavía tiene la contraseña asignada por el coordinador. Elegí una nueva
          antes de continuar.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="currentPassword" className="text-sm font-medium text-ink">
              Contraseña actual
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded-card border border-muted/30 px-3 py-2 text-ink outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="newPassword" className="text-sm font-medium text-ink">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-card border border-muted/30 px-3 py-2 text-ink outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-ink">
              Confirmar nueva contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-card border border-muted/30 px-3 py-2 text-ink outline-none focus:border-brand-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-card bg-brand-600 px-4 py-2 font-medium text-on-brand transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
