import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CalendarIcon, HomeIcon } from './components/icons'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { useProfile } from './features/auth/useProfile'
import { useSession } from './features/auth/useSession'
import { HomePage } from './features/home/HomePage'
import { SemestresPage } from './features/semestres/SemestresPage'

const NAV_COORDINADOR = [
  { to: '/semestres', label: 'Semestres', icon: <CalendarIcon className="h-[18px] w-[18px]" /> },
]

const NAV_BECARIO = [
  { to: '/', label: 'Mi progreso', icon: <HomeIcon className="h-[18px] w-[18px]" /> },
]

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-muted">Cargando...</p>
    </main>
  )
}

interface AuthenticatedAppProps {
  profile: { nombre: string; rol: string }
  becarioId: string
}

function AuthenticatedApp({ profile, becarioId }: AuthenticatedAppProps) {
  const esCoordinador = profile.rol === 'coordinador'
  const navItems = esCoordinador ? NAV_COORDINADOR : NAV_BECARIO

  return (
    <AppShell profile={profile} navItems={navItems}>
      <Routes>
        <Route
          path="/"
          element={
            esCoordinador ? (
              <Navigate to="/semestres" replace />
            ) : (
              <HomePage nombre={profile.nombre} becarioId={becarioId} />
            )
          }
        />
        <Route
          path="/semestres"
          element={esCoordinador ? <SemestresPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const { session, loading: sessionLoading } = useSession()
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(session)

  if (sessionLoading || (session && profileLoading)) {
    return <Loading />
  }

  const debeCambiarPassword = profile?.debe_cambiar_password ?? false

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/cambiar-password"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : debeCambiarPassword ? (
            <ChangePasswordPage onSuccess={refetchProfile} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/*"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : debeCambiarPassword ? (
            <Navigate to="/cambiar-password" replace />
          ) : profile ? (
            <AuthenticatedApp profile={profile} becarioId={session.user.id} />
          ) : (
            <Loading />
          )
        }
      />
    </Routes>
  )
}

export default App
