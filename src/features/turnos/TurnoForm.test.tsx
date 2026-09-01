import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TurnoForm } from './TurnoForm'

function fillForm(fecha: string, inicio: string, fin: string) {
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: fecha } })
  fireEvent.change(screen.getByLabelText('Hora inicio'), { target: { value: inicio } })
  fireEvent.change(screen.getByLabelText('Hora fin'), { target: { value: fin } })
  fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
}

describe('TurnoForm', () => {
  it('rechaza si la hora de fin no es posterior a la de inicio', () => {
    const onSubmit = vi.fn()
    render(<TurnoForm onSubmit={onSubmit} />)

    fillForm('2026-08-31', '14:00', '10:00')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La hora de fin debe ser posterior a la hora de inicio.',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envía el turno con datos válidos y limpia el formulario', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: null })
    render(<TurnoForm onSubmit={onSubmit} />)

    fillForm('2026-08-31', '10:00', '14:00')

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        fecha: '2026-08-31',
        hora_inicio: '10:00',
        hora_fin: '14:00',
      }),
    )
    await waitFor(() => expect(screen.getByLabelText('Fecha')).toHaveValue(''))
  })

  it('muestra el error que devuelve onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: 'No hay una inscripción activa.' })
    render(<TurnoForm onSubmit={onSubmit} />)

    fillForm('2026-08-31', '10:00', '14:00')

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay una inscripción activa.')
  })
})
