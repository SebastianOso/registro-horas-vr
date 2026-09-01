# Plan: `registro-horas-vr` — gobernanza multi-agente + app de servicio becario

## Contexto

Los becarios de la zona de realidad virtual registran hoy sus turnos en un Microsoft Form, y
alguien después consolida esas respuestas a mano en Excel. El doble llenado es la molestia que
motiva el proyecto: el becario captura su turno una vez y el coordinador ve el avance actualizado
sin transcribir nada.

**No hay exportación a Excel en el alcance.** La tabla viva del coordinador *es* el reemplazo del
Excel; exportar reproduciría el paso manual que queremos eliminar. Si algún trámite formal lo exige
después, se agrega entonces.

El objetivo inmediato tampoco es la app, sino la capa de gobernanza que permita pedirla en lenguaje
natural y que un flujo de agentes la construya con supervisión mínima: `CLAUDE.md`, subagentes,
skills y el protocolo de orquestación contra GitHub. La app es el primer ejercicio real de ese
flujo.

Objetivo secundario declarado: **aprender Supabase**. Por eso el esquema y las políticas RLS se
escriben para leerse y entenderse, la PR de base de datos va separada de la de UI, y el orquestador
explica los conceptos conforme aparecen en vez de solo ejecutarlos.

---

## Qué hace la app

**Becario:** inicia sesión, registra un turno (fecha, hora inicio, hora fin) y ve sus horas
acumuladas contra su meta del semestre.

**Coordinador:** crea semestres, carga becarios en lote, y ve una tabla con el avance de cada
becario —acumuladas, meta, faltantes, porcentaje— siempre al día.

---

## El problema central: proteger el contexto del orquestador

El flujo pedido es: un agente explora, otro desarrolla y abre PR, otro revisa. Y cuando la revisión
pide cambios, **los aplica esta conversación (el orquestador)**, no un agente de desarrollo nuevo.

Esa decisión es correcta, y de ella se derivan casi todas las reglas de abajo. Cada subagente
arranca con contexto vacío. Respawnear un desarrollador para atender hallazgos lo obliga a releer
el código y a **re-derivar la intención** —qué se pidió, qué tradeoff se aceptó, qué se difirió a
propósito—, y esa intención no vive en el código: vive en esta conversación.

El riesgo simétrico es que, si el orquestador absorbe detalle de implementación, su ventana se
agota y el esquema colapsa. La restricción que gobierna todo: **el orquestador conserva la
intención y delega el detalle.** Nunca lee archivos completos para revisar, nunca recibe
transcripciones, solo reportes de forma fija.

### Handoffs estructurados

El **desarrollador** devuelve:

```
rama:       feat/registro-turno
pr:         #12
archivos:   src/features/turnos/TurnoForm.tsx  (nuevo)
            src/lib/supabase.ts                (modificado)
decisiones: usé <input type="time"> nativo en vez de un picker propio
diferido:   validación de traslape — depende de dominio-horas
riesgos:    la zona horaria se asume local del navegador, sin probar
```

El **revisor** devuelve hallazgos y veredicto:

```
hallazgos:
  - archivo: src/features/turnos/TurnoForm.tsx
    linea:   34
    grave:   alta
    claim:   el turno se inserta sin verificar que fin > inicio
    fix:     validar antes del insert
veredicto: cambios-requeridos
```

### El triaje es el trabajo del orquestador

| Salida | Cuándo | Acción |
|---|---|---|
| **Aplicar** | Mecánico, no contradice ninguna decisión previa | `Edit` puntual sobre el hunk, sin leer el archivo entero |
| **Rechazar** | Choca con un tradeoff aceptado a propósito | Responder en la PR explicando la razón |
| **Escalar** | Revela una decisión de diseño no tomada | Preguntarte a ti |

Solo el orquestador puede hacer este triaje, porque solo él sabe el porqué. Por eso el revisor se
define **sin permisos de escritura**: que no pueda editar no es una limitación, es lo que mantiene
honesto el flujo.

---

## Disciplina de PRs

- **Objetivo: ≤10 archivos y ≤1000 líneas.** Límites blandos: si una historia coherente necesita 13
  archivos y 1100 líneas, pasa — **la coherencia manda sobre el número**. Lo que no se permite es
  empacar dos historias distintas en una PR.
- **Esquema y UI en PRs separadas.** Primero la migración con tablas y RLS; ya fusionada, la PR de
  frontend que la consume. Da granularidad, mantiene los tipos generados sincronizados, y hace la
  PR de base de datos legible — tu material de aprendizaje.
- Si el desarrollador prevé rebasar los límites, **parte el trabajo y lo reporta**.

---

## Roster de agentes

- **`Explore`** (integrado, no se define) — localizar código.
- **`desarrollador`** (`.claude/agents/desarrollador.md`) — rama, implementa, commitea, abre PR,
  devuelve handoff. **No atiende revisiones.** Modelo sonnet.
- **`revisor-pr`** (`.claude/agents/revisor-pr.md`) — lee el diff y reporta. Herramientas: `Read`,
  `Grep`, `Glob`, `Bash` de solo lectura. **Sin `Edit` ni `Write`.** Carga las skills de proyecto
  para revisar conformidad de diseño y dominio, no solo corrección genérica.

Para corrección general se reutiliza `/code-review`. El `revisor-pr` cubre lo que un revisor
genérico no sabe: sistema de diseño, reglas del dominio y seguridad de RLS.

**Skills:** `design-system` (tokens, componentes permitidos) y `dominio-horas` (formato de turnos,
traslapes, cálculo de avance).

---

## Modelo de datos

Cuatro tablas. La decisión que sostiene todo:

```
semestres      id, nombre ("2026-1"), fecha_inicio, fecha_fin, activo
profiles       id → auth.users, nombre, matricula, correo, rol, activo
inscripciones  id, becario_id → profiles, semestre_id → semestres,
               horas_meta, activo        · unique(becario_id, semestre_id)
registros      id, inscripcion_id → inscripciones,
               fecha, hora_inicio, hora_fin, minutos (generada), notas
```

**`registros` cuelga de `inscripcion_id`, no de `becario_id`.** Como un becario puede repetir
semestre, colgar las horas directo del becario haría que al repetir se le mezclaran las horas de
ambos periodos. Atarlas a la inscripción las separa por construcción, y el cálculo de avance queda
en un `sum(minutos)` agrupado por inscripción contra su `horas_meta`. La meta vive ahí también, lo
que da meta por becario y por semestre en un solo campo.

Otros detalles:
- `minutos` es columna generada `STORED` desde `hora_fin - hora_inicio`. Guardarla como entero
  (no `interval`) hace triviales las sumas del avance.
- Un `CHECK` exige `hora_fin > hora_inicio`, lo que implica que **los turnos que cruzan medianoche
  no son representables** — correcto para un laboratorio que cierra de noche, pero es la decisión a
  revisar si eso cambia.
- El rol se guarda en `profiles`, leído desde una función `es_coordinador()` marcada
  `SECURITY DEFINER` (necesaria para evitar recursión infinita al consultarse desde una política
  sobre la misma tabla). **No** se usa `user_metadata`: es escribible por el propio usuario vía
  `auth.updateUser()`, así que un becario podría promoverse a coordinador.
- Las políticas usan `(select auth.uid())` y no `auth.uid()` pelón. El subquery escalar hace que
  Postgres lo evalúe una vez por consulta en vez de una por fila — en la tabla del coordinador es
  la diferencia entre rápida e inutilizable.
- El avance se expone como una **vista** `avance_becarios` que hace el join y la suma, para que el
  frontend no reimplemente el cálculo.

---

## El backend real: carga en lote

Tu intuición previa sobre "un backend" era correcta y aquí es donde aterriza.

Crear cuentas requiere la **llave secreta** de Supabase, y esa llave no puede tocar el navegador:
en un repo público, quien tenga el bundle tendría control total de la base. La solución es una
**Edge Function** —código que corre en el servidor de Supabase, guarda la llave secreta y verifica
que quien llama sea coordinador.

`supabase/functions/cargar-becarios/` recibe la lista y por cada renglón:

1. ¿Ya existe una cuenta con ese correo? → solo crea la **inscripción** al nuevo semestre.
2. ¿No existe? → crea la cuenta, el `profile`, y luego la inscripción.

Eso cubre en un solo lugar los dos casos que planteaste: reinscribir a alguien que ya sirvió antes,
y dar de alta a los nuevos.

---

## Seguridad y variables de entorno

Sí hay `.env`. Concretamente dos archivos y un tercer lugar que **no** es un archivo del repo:

| Dónde | Qué guarda | ¿Se commitea? |
|---|---|---|
| `.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | **No** — va en `.gitignore` |
| `.env.example` | los mismos nombres, valores vacíos | Sí, como plantilla |
| Secretos de la Edge Function | la llave **secret** | No existe en el repo |

El matiz que importa: **Vite incrusta las variables `VITE_*` dentro del bundle al compilar.**
`.env.local` mantiene la llave fuera del repositorio, pero la llave sí termina visible en el
JavaScript que se sirve al navegador. Eso está bien —es su diseño— y es exactamente la razón por la
que RLS no es negociable: no hay manera de esconder esa llave de un usuario de la app, así que la
protección real tiene que vivir en la base de datos, no en el cliente.

- La llave **publishable** no es una credencial: solo identifica el proyecto y otorga el rol
  `anon` de Postgres. Cada petición sigue pasando por **RLS**.
- La llave **secret** ignora RLS por completo. Nunca va en un `.env` del repo ni en el cliente: se
  carga con `supabase secrets set` y la Edge Function la lee del entorno del servidor.
- Usar el **formato nuevo** (`sb_publishable_…` / `sb_secret_…`). Las llaves legacy
  `anon`/`service_role` se eliminan a finales de 2026; arrancar con ellas sería migrar en meses.
- En CI, la llave publishable se inyecta desde los *secrets* del repo de GitHub para que el build
  de producción compile.
- **Toda tabla nace con RLS habilitado.** El `revisor-pr` rechaza cualquier PR que cree una tabla
  sin su política.

> **Riesgo aceptado.** Decidiste no incluir pruebas automatizadas de RLS. Como RLS es lo único que
> separa los datos del público, en su lugar hay verificación manual obligatoria con dos cuentas
> (§ Verificación) más esta consulta, que lista cualquier tabla con RLS apagada:
> ```sql
> select relname, relrowsecurity from pg_class
> where relnamespace = 'public'::regnamespace and relkind = 'r';
> ```

---

## Stack verificado

Versiones confirmadas contra el registro de npm el 2026-08-31.

| Pieza | Versión | Nota |
|---|---|---|
| `vite` | 8.2.2 | usa Rolldown por defecto |
| `@vitejs/plugin-react` | 6.1.1 | |
| `react` | 19.2.8 | |
| `typescript` | 7.0.2 | |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | v4, config CSS-first |
| `@supabase/supabase-js` | 2.112.4 | no existe v3 |
| `vitest` + `@testing-library/react` | últimas | pruebas |

Se necesita además la **Supabase CLI** para migraciones, generación de tipos y desplegar la Edge
Function.

**TypeScript, no JS.** "React vanilla" significa sin meta-framework; no dice nada de la capa de
tipos. Supabase genera tipos desde el esquema y alimentarlos a `createClient<Database>()` da error
de compilación en cada nombre de tabla y columna. En aritmética de horas, un typo entre `hora_fin`
y `horaFin` produce horas mal contadas en silencio.

**Tailwind v4 es config-en-CSS.** No hay `tailwind.config.js` ni `postcss.config.js`, y no se corre
`npx tailwindcss init` (memoria muscular de v3). El setup es el plugin en `vite.config.ts` más
`@import "tailwindcss"`. Los tokens van en un bloque `@theme`, donde el prefijo decide la familia
de utilidades (`--color-*` → `bg-*`/`text-*`, `--radius-*` → `rounded-*`).

La pieza clave para un sistema de diseño limpio: **`--color-*: initial;` dentro de `@theme` borra
toda la paleta default de Tailwind**, dejando solo tus tokens. Es el mecanismo más efectivo para
que nadie cuele un `bg-red-500` suelto — deja de existir. Se adopta.

---

## Pruebas y CI/CD

- **Vitest** — dominio: aritmética de turnos, traslapes, cálculo de avance contra la meta.
- **React Testing Library** — el formulario valida, muestra errores y envía bien.
- **GitHub Actions** en cada PR: `typecheck` + `lint` + `test`. `main` protegida: nada entra sin PR
  verde.

---

## Estructura

```
registro-horas-vr/
├── CLAUDE.md                       ← stack, protocolo, handoffs, seguridad, presupuesto de contexto
├── .claude/
│   ├── agents/{desarrollador,revisor-pr}.md
│   ├── skills/{design-system,dominio-horas}/SKILL.md
│   └── settings.json               ← allowlist para reducir prompts de permiso
├── .github/workflows/ci.yml
├── supabase/
│   ├── migrations/0001_schema.sql
│   └── functions/cargar-becarios/
├── src/
│   ├── index.css                   ← @import "tailwindcss" + @theme (tokens)
│   ├── lib/{supabase.ts,database.types.ts}
│   └── features/{turnos,semestres,becarios,avance}/
├── .env.example
└── vite.config.ts
```

---

## Fases

**Fase 0 — Prerrequisitos.** `gh` no está instalado (verificado); sin él no hay flujo de PRs.
1. `winget install --id GitHub.cli` y la Supabase CLI.
2. `gh auth login` — **lo corres tú**: es interactivo y abre el navegador.
3. Crear el proyecto en Supabase y obtener las llaves en formato nuevo.
4. `gh repo create registro-horas-vr --public --source=. --remote=origin`, y proteger `main`.

**Fase 1 — Capa de gobernanza.** La escribo yo directamente, no vía agentes: es la configuración
que los agentes van a obedecer, y arrancarla con agentes sería circular. Produce `CLAUDE.md`, los
dos agentes, las dos skills, `settings.json` y `.gitignore`.

**Fase 2 — Andamiaje.** Primer ejercicio real del flujo, en dos PRs:
- **PR A:** `0001_schema.sql` con las cuatro tablas, `es_coordinador()`, la vista `avance_becarios`
  y RLS. La lees con calma.
- **PR B:** Vite + React + TS, Tailwind con tokens, cliente tipado, auth por magic link, CI.

**Fase 3 — Flujo del becario.** "Registrar un turno" end-to-end: `desarrollador` → PR →
`revisor-pr` → triaje aquí → merge. Ensayo general de la gobernanza.

**Fase 4 — Flujo del coordinador.** En PRs sucesivas: gestión de semestres → Edge Function de carga
en lote + su UI → tabla de avance.

---

## Verificación

- **Fase 0:** `gh auth status` sin error; `gh repo view` resuelve.
- **Fase 1:** en sesión nueva, `/agents` lista ambos agentes y las skills aparecen. Se comprueba que
  el `revisor-pr` **no** puede editar pidiéndole que corrija algo: debe negarse por falta de
  herramienta.
- **Fase 2:** `npm run dev` levanta; `bg-red-500` **no** produce estilo, confirmando que la paleta
  default quedó borrada; la migración corre sin error.
- **Fase 3 — prueba de RLS, obligatoria y manual.** Con dos cuentas: el becario A registra un turno;
  B inicia sesión y **no** debe verlo; el coordinador ve ambos. Correr la consulta de
  `relrowsecurity` y confirmar que ninguna tabla aparece apagada.
- **Fase 4:** cargar un lote con un correo nuevo y uno ya existente; verificar que el nuevo obtiene
  cuenta e inscripción y el existente **solo** inscripción, sin cuenta duplicada. Inscribir al mismo
  becario en dos semestres y confirmar que sus horas **no** se mezclan entre ellos.
- **CI:** `typecheck`, `lint` y `test` en verde antes de permitir merge.

---

## Nota sobre modelos

Este plan lo redactó Opus. Ejecutar las fases no lo requiere: el `desarrollador` se define en
sonnet, y puedes cambiar esta sesión a Sonnet para orquestar. El triaje de hallazgos es lo único
que se beneficia de un modelo fuerte, y es una fracción pequeña del trabajo.
