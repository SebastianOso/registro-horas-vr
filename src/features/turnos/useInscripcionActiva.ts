import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type Avance = Database['public']['Views']['avance_becarios']['Row']

interface UseInscripcionActivaResult {
  /** null mientras carga; undefined si el becario no tiene inscripción en un semestre activo. */
  avance: Avance | null | undefined
  loading: boolean
  refetch: () => Promise<void>
}

/**
 * Inscripción del becario autenticado en el semestre activo (si tiene más de una — repitió
 * semestre —, siempre se refiere a la del semestre marcado `activo`, nunca se mezclan horas
 * entre inscripciones distintas). El avance sale de la vista avance_becarios, nunca se
 * recalcula acá.
 */
export function useInscripcionActiva(becarioId: string | undefined): UseInscripcionActivaResult {
  const [avance, setAvance] = useState<Avance | null | undefined>(null)
  const [loading, setLoading] = useState(true)

  const fetchAvance = useCallback(async () => {
    if (!becarioId) {
      setAvance(undefined)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: inscripcion } = await supabase
      .from('inscripciones')
      .select('id, semestres!inner(activo)')
      .eq('becario_id', becarioId)
      .eq('activo', true)
      .eq('semestres.activo', true)
      .limit(1)
      .maybeSingle()

    if (!inscripcion) {
      setAvance(undefined)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('avance_becarios')
      .select('*')
      .eq('inscripcion_id', inscripcion.id)
      .maybeSingle()

    setAvance(data ?? undefined)
    setLoading(false)
  }, [becarioId])

  useEffect(() => {
    fetchAvance()
  }, [fetchAvance])

  return { avance, loading, refetch: fetchAvance }
}
