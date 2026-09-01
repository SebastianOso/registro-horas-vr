import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { useSession } from './features/auth/useSession'
import { HomePage } from './features/home/HomePage'

function App() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-muted">Cargando...</p>
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={session ? <HomePage session={session} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
