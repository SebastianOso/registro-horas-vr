import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AuthError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { LoginForm } from './LoginForm'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
}

describe('LoginForm', () => {
  it('exige correo y contraseña', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText('Correo')).toBeRequired()
    expect(screen.getByLabelText('Contraseña')).toBeRequired()
  })

  it('muestra un error cuando las credenciales son inválidas', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as AuthError,
    })

    render(<LoginForm />)
    fillAndSubmit('becario@example.com', 'contraseña-incorrecta')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos.',
    )
  })

  it('llama a onSuccess cuando el login es exitoso', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)
    const onSuccess = vi.fn()

    render(<LoginForm onSuccess={onSuccess} />)
    fillAndSubmit('becario@example.com', 'becario@example.com')

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })
})
