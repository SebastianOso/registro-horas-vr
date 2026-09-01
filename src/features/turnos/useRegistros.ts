import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type Registro = Database['public']['Tables']['registros']['Row']

interface CrearTurnoInput {
  fecha: string
  hora_inicio: string
  hora_fin: string
}

interface UseRegistrosResult {
  registros: Registro[]
  loading: boolean
  crear: (input: CrearTurnoInput) => Promise<{ error: string | null }>
}

/** Últimos turnos de una inscripción puntual — nunca de un becario_id directo (ver skill dominio-horas). */
export function useRegistros(inscripcionId: string | undefined): UseRegistrosResult {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRegistros = useCallback(async () => {
    if (!inscripcionId) {
      setRegistros([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('registros')
      .select('*')
      .eq('inscripcion_id', inscripcionId)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .limit(10)

    setRegistros(data ?? [])
    setLoading(false)
  }, [inscripcionId])

  useEffect(() => {
    fetchRegistros()
  }, [fetchRegistros])

  async function crear(input: CrearTurnoInput) {
    if (!inscripcionId) {
      return { error: 'No hay una inscripción activa para registrar el turno.' }
    }

    const { error } = await supabase.from('registros').insert({
      inscripcion_id: inscripcionId,
      ...input,
    })

    if (error) {
      return { error: error.message }
    }

    await fetchRegistros()
    return { error: null }
  }

  return { registros, loading, crear }
}
