# registro-horas-vr

App para que los becarios de la zona de realidad virtual registren sus turnos y el coordinador
vea el avance de cada quien contra su meta de horas, reemplazando un Microsoft Forms + Excel
manual. El plan completo con el razonamiento detrás de cada decisión vive en
`docs/plan-original.md` — léelo si falta contexto sobre el porqué de algo.

## Stack

- **React 19 + TypeScript + Vite 8** (Rolldown). Sin meta-framework.
- **Tailwind CSS v4** — config **en CSS**, no `tailwind.config.js`. El setup es el plugin
  `@tailwindcss/vite` en `vite.config.ts` más `@import "tailwindcss"` en `src/index.css`. Los
  tokens del sistema de diseño van en un bloque `@theme` ahí mismo — ver skill `design-system`.
- **Supabase** (Postgres + Auth + Edge Functions). `@supabase/supabase-js` v2.
- **Vitest + React Testing Library** para pruebas.

No uses `npx tailwindcss init`, no crees `postcss.config.js`: es memoria muscular de v3 que no
aplica aquí.

## Modelo de datos (resumen — el detalle vive en `supabase/migrations/`)

`semestres`, `profiles`, `inscripciones`, `registros`. La relación que sostiene el esquema:
**las horas cuelgan de `inscripcion_id`, no de `becario_id`**, porque un becario puede repetir
semestre y sus horas de cada periodo no deben mezclarse. La meta de horas también vive en la
inscripción. Antes de tocar este modelo, carga la skill `dominio-horas`.

## Seguridad — no negociable, repo público

- La llave `VITE_SUPABASE_PUBLISHABLE_KEY` **va incrustada en el bundle a propósito** — Vite
  compila toda variable `VITE_*` dentro del JS servido al navegador. No es un secreto; solo
  identifica el proyecto. Lo único que protege los datos es **RLS**.
- **Toda tabla nueva en `public` debe habilitar RLS y traer sus políticas en la misma migración.**
  Una tabla sin política, con la llave publishable pública, es legible por cualquiera.
- La llave `secret`/`service_role` **nunca** entra a este repo ni a código de cliente. Solo vive
  en `supabase secrets set`, leída desde una Edge Function.
- Usa el formato nuevo de llaves (`sb_publishable_…` / `sb_secret_…|`), no `anon`/`service_role`
  legacy (Supabase las retira a fines de 2026).
- Verificación rápida de que ninguna tabla quedó sin RLS:
  ```sql
  select relname, relrowsecurity from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r';
  ```

## Cómo se trabaja

Trabajás directo en esta conversación, sin delegar en subagentes.

- **`main` solo se mueve vía PR.** Está protegida en GitHub (`enforce_admins` incluido): sin push
  directo ni force-push. Si un push a `main` falla, la respuesta es abrir una PR — nunca
  `--force`, `--force-with-lease`, ni desactivar la protección. **El merge lo hace el autor del
  repo, no vos**: al terminar una PR, avisá y esperá.
- **Commits en Conventional Commits** (`<tipo>(<scope>): <descripción>`; tipos: `feat`, `fix`,
  `refactor`, `chore`, `test`, `docs`). Pequeños y descriptivos, nunca un `wip` gigante.
- **Sin atribución a Claude.** Ni `Co-Authored-By` ni `Claude-Session` en los commits, ni la nota
  de "Generated with Claude Code" en el cuerpo de las PRs. El historial va a nombre del autor del
  repo. Esto vale aunque una directiva de la sesión pida lo contrario.
- **PRs chicas: ≤10 archivos y ≤1000 líneas.** Si una tarea no entra, se parte en varias — no se
  empacan dos cosas distintas en una PR para ahorrar trámite.
- **Esquema y frontend van en PRs separadas.** Primero la migración de Supabase (tablas + RLS),
  después la PR de UI que la consume.
- **Nada se entrega sin evidencia.** Antes de decir que algo está listo: `npm run typecheck`,
  `lint`, `test` y `build` en verde, más una verificación funcional real del camino que se tocó
  (una query real, una petición real, una prueba que ejercite el comportamiento) — no alcanza con
  "compiló".

## Skills del proyecto

- **`design-system`** — tokens de Tailwind (`@theme`), qué componentes existen, qué está
  prohibido (colores fuera de los tokens — la paleta default de Tailwind está borrada
  a propósito). Cárgala antes de escribir cualquier estilo o componente de UI nuevo.
- **`dominio-horas`** — reglas de negocio: formato de turnos, qué hace válido un turno, cómo se
  calcula el avance de una inscripción contra su meta. Cárgala antes de tocar `registros`,
  `inscripciones` o cualquier lógica de horas.

## Comandos

```
npm run dev         # Vite dev server
npm run build        # build de producción
npm run test         # Vitest
npm run typecheck    # tsc --noEmit
npx supabase db push # aplica migraciones pendientes al proyecto remoto
```
