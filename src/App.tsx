import { Navigate, Route, Routes } from 'react-router-dom'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { useProfile } from './features/auth/useProfile'
import { useSession } from './features/auth/useSession'
import { HomePage } from './features/home/HomePage'

function App() {
  const { session, loading: sessionLoading } = useSession()
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(session)

  if (sessionLoading || (session && profileLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-muted">Cargando...</p>
      </main>
    )
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
        path="/"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : debeCambiarPassword ? (
            <Navigate to="/cambiar-password" replace />
          ) : (
            <HomePage session={session} profile={profile} />
          )
        }
      />
    </Routes>
  )
}

export default App
