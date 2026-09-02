import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { FilaCsv } from './parseCsvBecarios'

export type EstadoPreview = 'error' | 'ya_inscrito' | 'solo_inscripcion' | 'nueva'

export interface FilaClasificada extends FilaCsv {
  estadoPreview: EstadoPreview
}

export type EstadoResultado = 'cuenta_creada' | 'solo_inscrito' | 'omitido' | 'error'

export interface ResultadoFila {
  fila: number
  correo: string
  estado: EstadoResultado
  mensaje?: string
}

export interface Resumen {
  creados: number
  inscritos: number
  omitidos: number
  errores: number
}

interface CargarBecariosRespuesta {
  resultados: ResultadoFila[]
  resumen: Resumen
}

/** Clasifica cada fila válida del CSV contra profiles/inscripciones, y envía el lote a la Edge Function. */
export function useCargarBecarios() {
  const [clasificando, setClasificando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const clasificar = useCallback(
    async (filas: FilaCsv[], semestreId: string): Promise<FilaClasificada[]> => {
      setClasificando(true)
      try {
        const correos = [...new Set(filas.filter((fila) => !fila.error).map((fila) => fila.correo))]

        const { data: existentes } = correos.length
          ? await supabase.from('profiles').select('id, correo').in('correo', correos)
          : { data: [] as { id: string; correo: string }[] }

        const correoAId = new Map((existentes ?? []).map((p) => [p.correo, p.id]))
        const idsExistentes = [...correoAId.values()]

        const { data: inscritos } = idsExistentes.length
          ? await supabase
              .from('inscripciones')
              .select('becario_id')
              .eq('semestre_id', semestreId)
              .in('becario_id', idsExistentes)
          : { data: [] as { becario_id: string }[] }

        const idsInscritos = new Set((inscritos ?? []).map((i) => i.becario_id))

        return filas.map((fila) => {
          if (fila.error) {
            return { ...fila, estadoPreview: 'error' as const }
          }
          const becarioId = correoAId.get(fila.correo)
          if (becarioId && idsInscritos.has(becarioId)) {
            return { ...fila, estadoPreview: 'ya_inscrito' as const }
          }
          if (becarioId) {
            return { ...fila, estadoPreview: 'solo_inscripcion' as const }
          }
          return { ...fila, estadoPreview: 'nueva' as const }
        })
      } finally {
        setClasificando(false)
      }
    },
    [],
  )

  const enviar = useCallback(
    async (
      filas: FilaClasificada[],
      semestreId: string,
      password: string,
    ): Promise<{ data: CargarBecariosRespuesta | null; error: string | null }> => {
      setEnviando(true)
      try {
        const becarios = filas
          .filter((fila) => fila.estadoPreview !== 'error')
          .map((fila) => ({ nombre: fila.nombre, matricula: fila.matricula, correo: fila.correo }))

        const { data, error: invokeError } = await supabase.functions.invoke<CargarBecariosRespuesta>(
          'cargar-becarios',
          { body: { semestre_id: semestreId, password, becarios } },
        )

        if (invokeError) {
          // Mismo patrón que ChangePasswordPage: supabase-js mete el body de un status
          // no-2xx en error.context (un Response sin consumir), nunca en `data`.
          const body =
            'context' in invokeError && invokeError.context instanceof Response
              ? await invokeError.context.json().catch(() => null)
              : null
          return { data: null, error: body?.error ?? 'No se pudo cargar el lote. Intenta de nuevo.' }
        }

        return { data: data ?? null, error: null }
      } finally {
        setEnviando(false)
      }
    },
    [],
  )

  return { clasificar, enviar, clasificando, enviando }
}
