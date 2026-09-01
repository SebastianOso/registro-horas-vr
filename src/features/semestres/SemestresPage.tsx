import { useState } from 'react'
import type { FormEvent } from 'react'
import { PlusIcon } from '../../components/icons'
import { useSemestres } from './useSemestres'
import type { Semestre } from './useSemestres'

export function SemestresPage() {
  const { semestres, loading, error, crear, toggleActivo } = useSemestres()
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (fechaFin <= fechaInicio) {
      setFormError('La fecha de fin debe ser posterior a la de inicio.')
      return
    }

    setSubmitting(true)
    const { error: crearError } = await crear({
      nombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    })
    setSubmitting(false)

    if (crearError) {
      setFormError(crearError)
      return
    }

    setNombre('')
    setFechaInicio('')
    setFechaFin('')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Semestres</h1>
        <p className="mt-1 text-sm text-muted">
          Creá un semestre y activalo cuando empiece el periodo de servicio.
        </p>
      </div>

      <div className="mb-7 rounded-card bg-surface shadow-card">
        <div className="border-b border-muted/10 px-6 py-4 text-[15px] font-semibold text-ink">
          Crear semestre
        </div>
        <form
          className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className="text-sm font-medium text-ink">
              Nombre
            </label>
            <input
              id="nombre"
              required
              placeholder="2026-2"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inicio" className="text-sm font-medium text-ink">
              Fecha inicio
            </label>
            <input
              id="inicio"
              type="date"
              required
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fin" className="text-sm font-medium text-ink">
              Fecha fin
            </label>
            <input
              id="fin"
              type="date"
              required
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
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
              {submitting ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
        {formError && (
          <p role="alert" className="px-6 pb-4 text-sm text-danger">
            {formError}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-muted/15">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Fin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Estado
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {semestres.map((semestre: Semestre) => (
                <tr key={semestre.id} className="border-b border-muted/10 last:border-0">
                  <td className="px-6 py-3.5 text-sm font-medium text-ink">{semestre.nombre}</td>
                  <td className="px-6 py-3.5 text-sm text-muted">{semestre.fecha_inicio}</td>
                  <td className="px-6 py-3.5 text-sm text-muted">{semestre.fecha_fin}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        semestre.activo ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'
                      }`}
                    >
                      {semestre.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActivo(semestre)}
                      className="rounded-card border border-muted/30 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-canvas"
                    >
                      {semestre.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && semestres.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted">
                    Todavía no hay semestres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
