import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type Semestre = Database['public']['Tables']['semestres']['Row']

interface CrearSemestreInput {
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  horas_meta: number
}

interface UseSemestresResult {
  semestres: Semestre[]
  loading: boolean
  error: string | null
  crear: (input: CrearSemestreInput) => Promise<{ error: string | null }>
  toggleActivo: (semestre: Semestre) => Promise<void>
}

/** Semestres visibles para el usuario actual (lectura abierta por RLS a cualquier autenticado). */
export function useSemestres(): UseSemestresResult {
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSemestres = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('semestres')
      .select('*')
      .order('fecha_inicio', { ascending: false })

    setError(fetchError?.message ?? null)
    setSemestres(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSemestres()
  }, [fetchSemestres])

  async function crear(input: CrearSemestreInput) {
    const { error: insertError } = await supabase.from('semestres').insert(input)
    if (insertError) {
      return { error: insertError.message }
    }
    await fetchSemestres()
    return { error: null }
  }

  async function toggleActivo(semestre: Semestre) {
    await supabase.from('semestres').update({ activo: !semestre.activo }).eq('id', semestre.id)
    await fetchSemestres()
  }

  return { semestres, loading, error, crear, toggleActivo }
}
