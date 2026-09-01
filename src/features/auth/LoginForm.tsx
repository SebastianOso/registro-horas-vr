import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (signInError) {
      setError('Correo o contraseña incorrectos.')
      return
    }

    onSuccess?.()
  }

  return (
    <div className="w-full max-w-sm rounded-card bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-semibold text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted">Registro de horas — zona de realidad virtual</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-card border border-muted/30 px-3 py-2 text-ink outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
