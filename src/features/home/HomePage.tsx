import { TurnoForm } from '../turnos/TurnoForm'
import { useInscripcionActiva } from '../turnos/useInscripcionActiva'
import { useRegistros } from '../turnos/useRegistros'

interface HomePageProps {
  nombre: string
  becarioId: string
}

export function HomePage({ nombre, becarioId }: HomePageProps) {
  const { avance, loading: avanceLoading, refetch: refetchAvance } = useInscripcionActiva(
    becarioId,
  )
  const { registros, crear } = useRegistros(avance?.inscripcion_id ?? undefined)

  async function handleCrear(input: { fecha: string; hora_inicio: string; hora_fin: string }) {
    const result = await crear(input)
    if (!result.error) {
      await refetchAvance()
    }
    return result
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Hola, {nombre}</h1>
        <p className="mt-1 text-sm text-muted">
          {avance ? avance.semestre_nombre : 'Sesión iniciada correctamente.'}
        </p>
      </div>

      {avanceLoading ? null : avance == null ? (
        <div className="rounded-card bg-surface p-6 text-sm text-muted shadow-card">
          Todavía no tenés una inscripción en un semestre activo. Avisale a tu coordinador para
          que te dé de alta.
        </div>
      ) : (
        <>
          <div className="mb-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="rounded-card bg-surface p-5 shadow-card">
              <div className="text-sm font-medium text-muted">Horas acumuladas</div>
              <div className="mt-1.5 text-3xl font-bold text-ink">
                {avance.horas_acumuladas} <span className="text-base font-medium text-muted">h</span>
              </div>
            </div>
            <div className="rounded-card bg-surface p-5 shadow-card">
              <div className="text-sm font-medium text-muted">Meta del semestre</div>
              <div className="mt-1.5 text-3xl font-bold text-ink">
                {avance.horas_meta} <span className="text-base font-medium text-muted">h</span>
              </div>
            </div>
            <div className="rounded-card bg-surface p-5 shadow-card">
              <div className="text-sm font-medium text-muted">Avance</div>
              <div className="mt-2.5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.min(avance.porcentaje ?? 0, 100)}%` }}
                  />
                </div>
                <span className="text-base font-bold text-ink">{avance.porcentaje}%</span>
              </div>
            </div>
          </div>

          <TurnoForm onSubmit={handleCrear} />

          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            <div className="border-b border-muted/10 px-6 py-4 text-[15px] font-semibold text-ink">
              Últimos turnos
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr className="border-b border-muted/15">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Entrada
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Salida
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                      Horas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr key={registro.id} className="border-b border-muted/10 last:border-0">
                      <td className="px-6 py-3.5 text-sm text-ink">{registro.fecha}</td>
                      <td className="px-6 py-3.5 text-sm text-muted">{registro.hora_inicio}</td>
                      <td className="px-6 py-3.5 text-sm text-muted">{registro.hora_fin}</td>
                      <td className="px-6 py-3.5 text-right text-sm text-muted">
                        {registro.minutos != null ? (registro.minutos / 60).toFixed(1) : '—'} h
                      </td>
                    </tr>
                  ))}
                  {registros.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted">
                        Todavía no registraste ningún turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
