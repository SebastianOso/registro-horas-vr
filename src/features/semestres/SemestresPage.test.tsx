import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { SemestresPage } from './SemestresPage'

vi.mock('../../lib/supabase', () => {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const order = vi.fn().mockResolvedValue({
    data: [
      {
        id: '1',
        nombre: '2026-1',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-06-30',
        activo: true,
        creado_en: '2026-01-01T00:00:00Z',
      },
    ],
    error: null,
  })
  const select = vi.fn().mockReturnValue({ order })

  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select, insert, update }),
    },
  }
})

describe('SemestresPage', () => {
  it('lista los semestres existentes', async () => {
    render(<SemestresPage />)

    expect(await screen.findByText('2026-1')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('rechaza si la fecha de fin no es posterior a la de inicio', async () => {
    render(<SemestresPage />)
    await screen.findByText('2026-1')

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '2026-2' } })
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText('Fecha fin'), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: /crear/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La fecha de fin debe ser posterior a la de inicio.',
    )
    const insertMock = vi.mocked(supabase.from).mock.results[0].value.insert
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('crea un semestre con datos válidos', async () => {
    render(<SemestresPage />)
    await screen.findByText('2026-1')

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '2026-2' } })
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText('Fecha fin'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: /crear/i }))

    await waitFor(() => {
      const insertMock = vi.mocked(supabase.from).mock.results[0].value.insert
      expect(insertMock).toHaveBeenCalledWith({
        nombre: '2026-2',
        fecha_inicio: '2026-07-01',
        fecha_fin: '2026-12-31',
      })
    })
  })
})
