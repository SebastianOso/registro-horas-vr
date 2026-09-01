import { useState } from 'react'
import type { FormEvent } from 'react'
import { PlusIcon } from '../../components/icons'

interface TurnoFormProps {
  onSubmit: (input: { fecha: string; hora_inicio: string; hora_fin: string }) => Promise<{
    error: string | null
  }>
}

export function TurnoForm({ onSubmit }: TurnoFormProps) {
  const [fecha, setFecha] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (horaFin <= horaInicio) {
      setError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }

    setSubmitting(true)
    const { error: crearError } = await onSubmit({
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    })
    setSubmitting(false)

    if (crearError) {
      setError(crearError)
      return
    }

    setFecha('')
    setHoraInicio('')
    setHoraFin('')
  }

  return (
    <div className="mb-7 rounded-card bg-surface shadow-card">
      <div className="border-b border-muted/10 px-6 py-4 text-[15px] font-semibold text-ink">
        Registrar turno
      </div>
      <form
        className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha" className="text-sm font-medium text-ink">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            required
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="horaInicio" className="text-sm font-medium text-ink">
            Hora inicio
          </label>
          <input
            id="horaInicio"
            type="time"
            required
            value={horaInicio}
            onChange={(event) => setHoraInicio(event.target.value)}
            className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="horaFin" className="text-sm font-medium text-ink">
            Hora fin
          </label>
          <input
            id="horaFin"
            type="time"
            required
            value={horaFin}
            onChange={(event) => setHoraFin(event.target.value)}
            className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-brand-600 px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <PlusIcon className="h-4 w-4" />
            {submitting ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="px-6 pb-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
