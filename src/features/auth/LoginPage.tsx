import { useNavigate } from 'react-router-dom'
import { LoginForm } from './LoginForm'

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <LoginForm onSuccess={() => navigate('/', { replace: true })} />
    </main>
  )
}
