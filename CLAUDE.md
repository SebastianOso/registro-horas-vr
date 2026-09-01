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

## Protocolo de orquestación

Este proyecto se desarrolla con un flujo de agentes contra GitHub, coordinado desde la
conversación principal (el **orquestador** — vos, Claude, leyendo esto en la sesión principal).
La razón de este protocolo: cada subagente arranca con contexto vacío, así que solo el
orquestador conserva **por qué** se tomó cada decisión. La regla que se sigue de eso:

> **El orquestador conserva la intención y delega el detalle.** No lee archivos completos para
> revisar un hallazgo, no le pide a un subagente que le narre lo que hizo: cada subagente
> devuelve un reporte de forma fija (abajo) y el orquestador actúa sobre ese reporte.

### Flujo

1. El orquestador (vos) decide qué construir y con qué alcance (una historia de usuario).
2. Se invoca al agente **`desarrollador`**: crea rama, implementa, hace commit, abre PR, y
   **devuelve el handoff de desarrollo** (formato abajo). No hace nada más — no espera revisión,
   no itera sobre hallazgos.
3. El orquestador invoca al agente **`revisor-pr`** sobre esa PR. Este agente **no tiene
   permiso de escritura** — solo lee y reporta. Devuelve una lista de hallazgos y un veredicto
   (formato abajo).
4. El orquestador hace el **triaje** de cada hallazgo — esto lo hace el orquestador mismo, nunca
   un subagente, porque requiere la intención original:
   - **Aplicar**: el hallazgo es mecánico y no contradice ninguna decisión ya tomada → el
     orquestador edita directamente el hunk señalado (no relee el archivo completo).
   - **Rechazar**: el hallazgo choca con un tradeoff que se aceptó a propósito → el orquestador
     responde en la PR explicando por qué se descarta.
   - **Escalar**: el hallazgo revela una decisión de diseño que no se había tomado → el
     orquestador te pregunta a vos.
5. Si hubo cambios aplicados, se re-invoca `revisor-pr` sobre el diff actualizado. Cuando el
   veredicto es limpio, se hace merge.

**Nunca se reinvoca al `desarrollador` para atender hallazgos de revisión.** Si un hallazgo
requiere trabajo sustancial (no un fix puntual), el orquestador lo implementa directamente o
—si es tan grande que amerita una rama propia— abre una historia nueva.

### Formato de handoff — `desarrollador` → orquestador

```
rama:       feat/<nombre-corto>
pr:         #<numero>
archivos:   <ruta>  (nuevo|modificado)
            ...
decisiones: <decisiones de implementación no obvias tomadas sobre la marcha>
diferido:   <qué se dejó pendiente a propósito y por qué>
riesgos:    <supuestos sin probar, casos límite no cubiertos>
```

### Formato de reporte — `revisor-pr` → orquestador

```
hallazgos:
  - archivo: <ruta>
    linea:   <numero>
    grave:   alta|media|baja
    claim:   <qué está mal, en una oración>
    fix:     <qué cambiar>
veredicto: limpio|cambios-requeridos
```

## Disciplina de PRs

- Objetivo blando: **≤10 archivos y ≤1000 líneas** por PR. Si una historia de usuario coherente
  necesita más, está bien — la coherencia de la historia manda sobre el número. Lo que no se
  vale es empacar dos historias distintas en una PR para ahorrar trámite.
- **Esquema y frontend van en PRs separadas.** Primero la migración de Supabase (tablas + RLS),
  ya fusionada, la PR de UI que la consume.
- Si al planear una tarea el `desarrollador` anticipa que rebasará estos límites sin ser una
  sola historia coherente, debe partirla y reportarlo en vez de entregar una PR gigante.

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
