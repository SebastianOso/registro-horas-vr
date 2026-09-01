import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { ChangePasswordPage } from './ChangePasswordPage'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

function fillForm(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
}

function renderPage(onSuccess: () => Promise<void> = () => Promise.resolve()) {
  render(
    <MemoryRouter>
      <ChangePasswordPage onSuccess={onSuccess} />
    </MemoryRouter>,
  )
}

describe('ChangePasswordPage', () => {
  it('rechaza si las contraseñas nuevas no coinciden', () => {
    renderPage()
    fillForm('actual123', 'nueva123', 'otra456')

    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas nuevas no coinciden.')
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('rechaza si la nueva es igual a la actual', () => {
    renderPage()
    fillForm('actual123', 'actual123', 'actual123')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La nueva contraseña debe ser distinta de la actual.',
    )
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('llama a la Edge Function y refresca el perfil del padre en un cambio válido', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ok: true },
      error: null,
    } as Awaited<ReturnType<typeof supabase.functions.invoke>>)
    const onSuccess = vi.fn().mockResolvedValue(undefined)

    renderPage(onSuccess)
    fillForm('actual123', 'nueva1234', 'nueva1234')

    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith('cambiar-password-forzado', {
        body: { currentPassword: 'actual123', newPassword: 'nueva1234' },
      }),
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('muestra el error que devuelve la función', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'La contraseña actual no es correcta.' })),
      },
    } as Awaited<ReturnType<typeof supabase.functions.invoke>>)

    renderPage()
    fillForm('mala', 'nueva1234', 'nueva1234')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual no es correcta.',
    )
  })
})
