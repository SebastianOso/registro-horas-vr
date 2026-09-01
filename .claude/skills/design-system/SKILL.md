---
name: design-system
description: Tokens de Tailwind v4, componentes existentes y reglas de estilo de registro-horas-vr. Cárgala antes de escribir cualquier className o crear un componente de UI nuevo — es lo que mantiene el styling consistente en vez de que cada PR invente su propia paleta.
---

# Sistema de diseño — registro-horas-vr

Tailwind v4 es config-en-CSS: no hay `tailwind.config.js`. Los tokens viven en `src/index.css`
dentro de un bloque `@theme`, y el prefijo del nombre decide qué familia de utilidades genera
Tailwind (`--color-*` → `bg-*`/`text-*`/`border-*`, `--radius-*` → `rounded-*`, `--text-*` →
tamaño de fuente).

## La regla que importa más que ninguna otra

`src/index.css` borra la paleta default de Tailwind con `--color-*: initial;` dentro de `@theme`.
Eso significa que **`bg-red-500`, `text-gray-700`, `border-blue-400` y cualquier color que no
esté declarado como token propio simplemente no generan estilo — no es un lint, es que la clase
no existe.** Si necesitás un color que no está en la lista de abajo, agregalo como token nuevo en
`@theme` en la misma PR, con nombre semántico, no lo escribas suelto.

## Tokens actuales

Referenciá siempre `src/index.css` como fuente de verdad — esto es un resumen, no el original.
Familias de tokens que debe tener:

- `--color-brand-{50,500,600,700}` — color primario de marca.
- `--color-surface`, `--color-muted`, `--color-danger`, `--color-success` — semánticos, para no
  acoplar la UI a un tono específico si el tema cambia.
- `--font-sans` — familia tipográfica única del proyecto.
- `--radius-card` — el único radio de borde para tarjetas/contenedores; no uses `rounded-lg` o
  `rounded-xl` sueltos, usa `rounded-card`.
- `--shadow-card` — la única sombra para elevar contenido.

## Reglas de composición

- Antes de crear un componente nuevo, buscá si ya existe uno equivalente en `src/components/` o
  `src/features/*/components/`. Reutilizar mal un componente existente (props extra, variante
  nueva) es preferible a duplicar la estructura visual.
- Formularios: usá los mismos patrones de label/error ya establecidos por el primer formulario
  del proyecto (el de registrar turno) — no inventes una variante nueva de mensaje de error por
  pantalla.
- Espaciado: usá la escala de `--spacing-*`/utilidades estándar de Tailwind (`p-4`, `gap-2`,
  etc.) — esa escala numérica no fue borrada, solo el color.
- Tablas de datos (la vista de avance del coordinador): encabezado con `--color-muted` sobre
  `--color-surface`, sin bordes de color fuera de los tokens.

## Qué revisar en una PR (para `revisor-pr`)

1. ¿Aparece algún className de color que no sea un token de `@theme`? → hallazgo de gravedad
   media (aunque no rompa nada visualmente si Tailwind simplemente no genera la clase, el
   resultado es un elemento sin estilo, que es un bug visual real).
2. ¿Se agregó un token nuevo sin justificación semántica (p. ej. `--color-blue-para-boton-x`
   en vez de reusar `--color-brand-500`)? → señalarlo, no bloqueante salvo que sea evidente
   duplicación.
3. ¿Se reinventó un componente que ya existía en el árbol? → hallazgo.