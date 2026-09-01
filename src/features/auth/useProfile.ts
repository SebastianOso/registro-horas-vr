import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface Profile {
  nombre: string
  rol: string
  debe_cambiar_password: boolean
}

interface ProfileState {
  profile: Profile | null
  loading: boolean
  refetch: () => Promise<void>
}

/** Perfil (nombre, rol, estado de contraseña) de la sesión actual. `profile` es null sin sesión. */
export function useProfile(session: Session | null): ProfileState {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('nombre, rol, debe_cambiar_password')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
    setLoading(false)
  }, [session])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, refetch: fetchProfile }
}
