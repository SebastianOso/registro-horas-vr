interface HomePageProps {
  nombre: string
}

export function HomePage({ nombre }: HomePageProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Hola, {nombre}</h1>
      <p className="mt-1 text-sm text-muted">Sesión iniciada correctamente.</p>
    </div>
  )
}
