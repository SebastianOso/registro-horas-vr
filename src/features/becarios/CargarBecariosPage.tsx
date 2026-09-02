import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useSemestres } from '../semestres/useSemestres'
import { parseCsvBecarios } from './parseCsvBecarios'
import { useCargarBecarios } from './useCargarBecarios'
import type { EstadoPreview, EstadoResultado, FilaClasificada, ResultadoFila, Resumen } from './useCargarBecarios'

const ETIQUETA_PREVIEW: Record<EstadoPreview, string> = {
  nueva: 'Cuenta nueva',
  solo_inscripcion: 'Ya existe · solo se inscribe',
  ya_inscrito: 'Ya inscrito · se omite',
  error: 'Error',
}

const CLASE_PREVIEW: Record<EstadoPreview, string> = {
  nueva: 'bg-brand-50 text-brand-700',
  solo_inscripcion: 'bg-success/15 text-success',
  ya_inscrito: 'bg-muted/15 text-muted',
  error: 'bg-danger/10 text-danger',
}

const ETIQUETA_RESULTADO: Record<EstadoResultado, string> = {
  cuenta_creada: 'Cuenta creada',
  solo_inscrito: 'Solo inscrito',
  omitido: 'Omitido',
  error: 'Error',
}

const CLASE_RESULTADO: Record<EstadoResultado, string> = {
  cuenta_creada: 'bg-brand-50 text-brand-700',
  solo_inscrito: 'bg-success/15 text-success',
  omitido: 'bg-muted/15 text-muted',
  error: 'bg-danger/10 text-danger',
}

function Badge({ className, children }: { className: string; children: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
  )
}

export function CargarBecariosPage() {
  const { semestres, loading: loadingSemestres } = useSemestres()
  const { clasificar, enviar, clasificando, enviando } = useCargarBecarios()

  const [semestreId, setSemestreId] = useState('')
  const [password, setPassword] = useState('')
  const [archivoError, setArchivoError] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaClasificada[] | null>(null)
  const [enviarError, setEnviarError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ resultados: ResultadoFila[]; resumen: Resumen } | null>(
    null,
  )

  const semestreSeleccionado = semestres.find((s) => s.id === semestreId)

  async function handleArchivo(event: ChangeEvent<HTMLInputElement>) {
    setArchivoError(null)
    setFilas(null)
    setResultado(null)

    const archivo = event.target.files?.[0]
    if (!archivo) return

    const texto = await archivo.text()
    const { filas: filasParseadas, error } = parseCsvBecarios(texto)

    if (error) {
      setArchivoError(error)
      return
    }

    if (!semestreId) {
      setArchivoError('Elegí un semestre antes de subir el archivo.')
      return
    }

    setFilas(await clasificar(filasParseadas, semestreId))
  }

  const filasEnviables = filas?.filter((f) => f.estadoPreview !== 'error') ?? []
  const puedeEnviar =
    !!filas && filasEnviables.length > 0 && password.length >= 8 && !enviando && !clasificando

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!filas || !semestreId) return

    setEnviarError(null)
    const { data, error } = await enviar(filas, semestreId, password)

    if (error) {
      setEnviarError(error)
      return
    }

    setResultado(data)
  }

  function reiniciar() {
    setFilas(null)
    setResultado(null)
    setEnviarError(null)
    setArchivoError(null)
    setPassword('')
  }

  const resumenFilas = filas
    ? {
        nuevas: filas.filter((f) => f.estadoPreview === 'nueva').length,
        soloInscripcion: filas.filter((f) => f.estadoPreview === 'solo_inscripcion').length,
        yaInscrito: filas.filter((f) => f.estadoPreview === 'ya_inscrito').length,
        conError: filas.filter((f) => f.estadoPreview === 'error').length,
      }
    : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Cargar becarios</h1>
        <p className="mt-1 text-sm text-muted">
          Subí un CSV con las columnas <code>correo, nombre, matricula</code> para dar de alta o
          inscribir becarios en un semestre.
        </p>
      </div>

      {resultado ? (
        <div className="rounded-card bg-surface shadow-card">
          <div className="border-b border-muted/10 px-6 py-4 text-[15px] font-semibold text-ink">
            Resultado de la carga
          </div>
          <div className="flex flex-wrap gap-4 px-6 py-4 text-sm text-muted">
            <span>{resultado.resumen.creados} cuentas creadas</span>
            <span>{resultado.resumen.inscritos} solo inscritos</span>
            <span>{resultado.resumen.omitidos} omitidos</span>
            <span>{resultado.resumen.errores} con error</span>
          </div>

          <div className="divide-y divide-muted/10 md:hidden">
            {resultado.resultados.map((r) => (
              <div key={r.fila} className="flex items-center justify-between gap-3 px-6 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{r.correo}</div>
                  {r.mensaje && <div className="mt-0.5 text-xs text-muted">{r.mensaje}</div>}
                </div>
                <Badge className={CLASE_RESULTADO[r.estado]}>{ETIQUETA_RESULTADO[r.estado]}</Badge>
              </div>
            ))}
          </div>

          <table className="hidden w-full border-collapse md:table">
            <thead>
              <tr className="border-b border-muted/15">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Correo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody>
              {resultado.resultados.map((r) => (
                <tr key={r.fila} className="border-b border-muted/10 last:border-0">
                  <td className="px-6 py-3.5 text-sm text-ink">{r.correo}</td>
                  <td className="px-6 py-3.5">
                    <Badge className={CLASE_RESULTADO[r.estado]}>{ETIQUETA_RESULTADO[r.estado]}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-muted">{r.mensaje ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-6 py-4">
            <button
              type="button"
              onClick={reiniciar}
              className="rounded-card border border-muted/30 px-4 py-2 text-sm font-medium text-ink/80 hover:bg-canvas"
            >
              Cargar otro archivo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-card bg-surface shadow-card">
          <div className="border-b border-muted/10 px-6 py-4 text-[15px] font-semibold text-ink">
            Datos del lote
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="semestre" className="text-sm font-medium text-ink">
                Semestre
              </label>
              <select
                id="semestre"
                required
                value={semestreId}
                disabled={loadingSemestres}
                onChange={(event) => {
                  setSemestreId(event.target.value)
                  setFilas(null)
                  setResultado(null)
                }}
                className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
              >
                <option value="">Elegí un semestre</option>
                {semestres.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink">
                Contraseña del lote
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
              />
              <p className="text-xs text-muted">
                Sirve solo hasta el primer inicio de sesión: la app obliga a cambiarla antes de
                dejar entrar.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="archivo" className="text-sm font-medium text-ink">
                Archivo CSV
              </label>
              <input
                id="archivo"
                type="file"
                accept=".csv,text/csv"
                onChange={handleArchivo}
                className="rounded-card border border-muted/30 px-3 py-2 text-sm text-ink outline-none file:mr-3 file:rounded-card file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
              />
              <p className="text-xs text-muted">
                Columnas esperadas: <code>correo, nombre, matricula</code> (en cualquier orden).
                Ejemplo: <code>ana@escuela.mx, Ana López, A01234</code>
              </p>
            </div>
          </div>

          {archivoError && (
            <p role="alert" className="px-6 pb-4 text-sm text-danger">
              {archivoError}
            </p>
          )}

          {clasificando && <p className="px-6 pb-4 text-sm text-muted">Revisando el archivo...</p>}

          {filas && resumenFilas && (
            <>
              <div className="border-t border-muted/10 px-6 py-3 text-sm text-muted">
                {filas.length} filas: {resumenFilas.nuevas} nuevas, {resumenFilas.soloInscripcion} solo
                inscripción, {resumenFilas.yaInscrito} ya inscritos, {resumenFilas.conError} con error
                {semestreSeleccionado && (
                  <>
                    {' '}
                    · van a heredar la meta de <strong>{semestreSeleccionado.nombre}</strong>
                  </>
                )}
              </div>

              <div className="divide-y divide-muted/10 md:hidden">
                {filas.map((f) => (
                  <div key={f.fila} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div>
                      <div className="text-sm font-medium text-ink">{f.nombre || f.correo || `Fila ${f.fila}`}</div>
                      <div className="mt-0.5 text-xs text-muted">{f.error ?? f.correo}</div>
                    </div>
                    <Badge className={CLASE_PREVIEW[f.estadoPreview]}>
                      {ETIQUETA_PREVIEW[f.estadoPreview]}
                    </Badge>
                  </div>
                ))}
              </div>

              <table className="hidden w-full border-collapse md:table">
                <thead>
                  <tr className="border-b border-muted/15">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.fila} className="border-b border-muted/10 last:border-0">
                      <td className="px-6 py-3.5 text-sm text-ink">{f.nombre || '—'}</td>
                      <td className="px-6 py-3.5 text-sm text-muted">{f.correo || '—'}</td>
                      <td className="px-6 py-3.5">
                        <Badge className={CLASE_PREVIEW[f.estadoPreview]}>
                          {f.error ?? ETIQUETA_PREVIEW[f.estadoPreview]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {enviarError && (
            <p role="alert" className="px-6 py-4 text-sm text-danger">
              {enviarError}
            </p>
          )}

          <div className="border-t border-muted/10 px-6 py-4">
            <button
              type="submit"
              disabled={!puedeEnviar}
              className="rounded-card bg-brand-600 px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {enviando ? 'Cargando...' : `Crear e inscribir (${filasEnviables.length})`}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
