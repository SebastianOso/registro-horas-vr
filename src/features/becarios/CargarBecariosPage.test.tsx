import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { CargarBecariosPage } from './CargarBecariosPage'

vi.mock('../../lib/supabase', () => {
  const semestresOrder = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'sem1',
        nombre: '2026-1',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-06-30',
        activo: true,
        creado_en: '2026-01-01T00:00:00Z',
      },
    ],
    error: null,
  })
  const semestresSelect = vi.fn().mockReturnValue({ order: semestresOrder })

  // "existente@x.mx" ya tiene profile, pero ninguna inscripción en sem1 -> solo_inscripcion.
  const profilesIn = vi
    .fn()
    .mockResolvedValue({ data: [{ id: 'profile-existente', correo: 'existente@x.mx' }], error: null })
  const profilesSelect = vi.fn().mockReturnValue({ in: profilesIn })

  const inscripcionesIn = vi.fn().mockResolvedValue({ data: [], error: null })
  const inscripcionesEq = vi.fn().mockReturnValue({ in: inscripcionesIn })
  const inscripcionesSelect = vi.fn().mockReturnValue({ eq: inscripcionesEq })

  const from = vi.fn((table: string) => {
    if (table === 'semestres') return { select: semestresSelect }
    if (table === 'profiles') return { select: profilesSelect }
    if (table === 'inscripciones') return { select: inscripcionesSelect }
    throw new Error(`tabla inesperada en el mock: ${table}`)
  })

  const invoke = vi.fn().mockResolvedValue({
    data: { resultados: [], resumen: { creados: 1, inscritos: 1, omitidos: 0, errores: 0 } },
    error: null,
  })

  return {
    supabase: {
      from,
      functions: { invoke },
    },
  }
})

function csvFile(contenido: string) {
  return new File([contenido], 'becarios.csv', { type: 'text/csv' })
}

const CSV_TRES_FILAS =
  'correo,nombre,matricula\n' +
  'nueva@x.mx,Nueva Persona,A001\n' +
  'existente@x.mx,Existente Persona,A002\n' +
  'no-es-un-correo,Invalido,A003'

async function subirArchivoConSemestre(csv: string) {
  render(<CargarBecariosPage />)
  await screen.findByText('2026-1')

  fireEvent.change(screen.getByLabelText('Semestre'), { target: { value: 'sem1' } })

  const input = screen.getByLabelText('Archivo CSV') as HTMLInputElement
  fireEvent.change(input, { target: { files: [csvFile(csv)] } })
}

describe('CargarBecariosPage', () => {
  it('clasifica la preview: nueva, solo se inscribe, y error', async () => {
    await subirArchivoConSemestre(CSV_TRES_FILAS)

    // Mobile y desktop renderizan a la vez en jsdom (no hay media query real), así que
    // cada estado aparece dos veces: una en la tarjeta, otra en la fila de la tabla.
    expect(await screen.findAllByText('Cuenta nueva')).not.toHaveLength(0)
    expect(screen.getAllByText('Ya existe · solo se inscribe')).not.toHaveLength(0)
    expect(screen.getAllByText('El correo no tiene un formato válido.')).not.toHaveLength(0)
  })

  it('no envía el lote con una contraseña de menos de 8 caracteres', async () => {
    await subirArchivoConSemestre(CSV_TRES_FILAS)
    await screen.findAllByText('Cuenta nueva')

    fireEvent.change(screen.getByLabelText('Contraseña del lote'), { target: { value: 'corta1' } })

    const boton = screen.getByRole('button', { name: /crear e inscribir/i })
    expect(boton).toBeDisabled()
    expect(vi.mocked(supabase.functions.invoke)).not.toHaveBeenCalled()
  })

  it('envía solo las filas sin error al confirmar', async () => {
    await subirArchivoConSemestre(CSV_TRES_FILAS)
    await screen.findAllByText('Cuenta nueva')

    fireEvent.change(screen.getByLabelText('Contraseña del lote'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /crear e inscribir/i }))

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('cargar-becarios', {
        body: {
          semestre_id: 'sem1',
          password: 'password123',
          becarios: [
            { nombre: 'Nueva Persona', matricula: 'A001', correo: 'nueva@x.mx' },
            { nombre: 'Existente Persona', matricula: 'A002', correo: 'existente@x.mx' },
          ],
        },
      })
    })
  })
})
