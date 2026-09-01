-- 0001_schema.sql
-- Esquema inicial de registro-horas-vr: semestres, profiles, inscripciones,
-- registros; función es_coordinador(), vista avance_becarios y RLS completo.
--
-- Decisión que sostiene el esquema: las horas cuelgan de inscripcion_id, no
-- de becario_id, porque un becario puede repetir semestre y sus horas de
-- cada periodo no deben mezclarse. Ver docs/plan-original.md, sección
-- "Modelo de datos", y la skill dominio-horas para el detalle completo.

-- =========================================================================
-- Tablas
-- =========================================================================

create table public.semestres (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint semestres_fechas_validas check (fecha_fin > fecha_inicio)
);

comment on table public.semestres is
  'Periodos de servicio (ej. "2026-1"). Solo coordinadores los crean/editan.';

-- profiles espeja auth.users 1:1. El rol vive aquí y NO en
-- auth.users.user_metadata: ese campo lo puede escribir el propio usuario
-- vía auth.updateUser(), lo que le permitiría auto-promoverse a
-- coordinador. es_coordinador() (abajo) lee el rol de esta tabla.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  matricula text not null unique,
  correo text not null unique,
  rol text not null default 'becario' check (rol in ('becario', 'coordinador')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.profiles is
  'Datos de perfil y rol de cada usuario. rol es la única fuente de verdad de autorización.';

create table public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  becario_id uuid not null references public.profiles (id) on delete cascade,
  semestre_id uuid not null references public.semestres (id) on delete cascade,
  horas_meta numeric(6, 2) not null check (horas_meta > 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint inscripciones_becario_semestre_unico unique (becario_id, semestre_id)
);

comment on table public.inscripciones is
  'Relación becario-semestre. La meta de horas vive aquí, no en profiles, '
  'para permitir metas distintas si el becario repite semestre.';

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones (id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  -- Guardada como entero (no interval) para que sum(minutos) sea trivial.
  -- Nunca se recalcula en el cliente: se lee esta columna, no se reproduce.
  minutos integer generated always as
    (extract(epoch from (hora_fin - hora_inicio)) / 60)::integer stored,
  notas text,
  creado_en timestamptz not null default now(),
  -- Los turnos que cruzan medianoche no son representables (limitación
  -- aceptada a propósito: el laboratorio de VR cierra de noche). Cambiarlo
  -- requiere migrar hora_inicio/hora_fin a timestamptz, no un parche aquí.
  constraint registros_horario_valido check (hora_fin > hora_inicio),
  -- Chequeo laxo contra errores de captura obvios (fecha muy en el futuro),
  -- no una regla de negocio estricta.
  constraint registros_fecha_no_futura check (fecha <= current_date + 1)
);

comment on table public.registros is
  'Turnos registrados por un becario, colgados de su inscripción (nunca '
  'directo de becario_id) para no mezclar horas entre semestres repetidos.';

create index registros_inscripcion_id_idx on public.registros (inscripcion_id);
create index inscripciones_becario_id_idx on public.inscripciones (becario_id);
create index inscripciones_semestre_id_idx on public.inscripciones (semestre_id);

-- =========================================================================
-- Funciones
-- =========================================================================

/**
 * Indica si el usuario autenticado actual tiene rol 'coordinador'.
 *
 * SECURITY DEFINER es necesario porque esta función se usa dentro de
 * políticas RLS sobre la propia tabla profiles: si corriera con los
 * privilegios del invocador, la subconsulta a profiles dispararía RLS de
 * nuevo y causaría recursión infinita. search_path fijo evita que un rol
 * con privilegios de escritura sobre otros esquemas la secuestre.
 */
create or replace function public.es_coordinador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and rol = 'coordinador'
      and activo
  );
$$;

/**
 * Impide que un usuario sin rol coordinador cambie rol, activo, matrícula
 * o correo de un profile — son identificadores institucionales, no datos
 * que el propio becario deba poder autoeditarse. Necesaria porque una
 * política RLS de UPDATE por sí sola no puede restringir qué columnas
 * cambian dentro de la misma fila.
 *
 * El chequeo solo aplica cuando hay un usuario autenticado (auth.uid() no
 * nulo): los triggers, a diferencia de RLS, se disparan también para la
 * llave secret/service role y para SQL directo desde el dashboard, donde
 * auth.uid() es null. Exigir es_coordinador() ahí bloquearía promociones o
 * reactivaciones legítimas hechas fuera de una sesión de usuario.
 */
create or replace function public.proteger_campos_privilegiados_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
      and not public.es_coordinador()
      and (new.rol is distinct from old.rol
        or new.activo is distinct from old.activo
        or new.matricula is distinct from old.matricula
        or new.correo is distinct from old.correo) then
    raise exception 'Solo un coordinador puede cambiar rol, activo, matrícula o correo de un profile';
  end if;
  return new;
end;
$$;

create trigger profiles_proteger_campos_privilegiados
  before update on public.profiles
  for each row
  execute function public.proteger_campos_privilegiados_profile();

-- =========================================================================
-- Vista de avance (ver skill dominio-horas: un único lugar para el cálculo)
-- =========================================================================

-- security_invoker hace que la vista aplique el RLS del usuario que
-- consulta, no el del dueño de la vista. Sin esto, la vista se ejecutaría
-- con privilegios del creador y expondría todas las filas sin filtrar.
create view public.avance_becarios
with (security_invoker = true) as
select
  i.id as inscripcion_id,
  i.becario_id,
  i.semestre_id,
  p.nombre as becario_nombre,
  p.matricula,
  s.nombre as semestre_nombre,
  i.horas_meta,
  coalesce(sum(r.minutos), 0) as minutos_acumulados,
  round(coalesce(sum(r.minutos), 0) / 60.0, 2) as horas_acumuladas,
  greatest(i.horas_meta - round(coalesce(sum(r.minutos), 0) / 60.0, 2), 0) as horas_faltantes,
  case
    when i.horas_meta > 0
      then round(
        least(coalesce(sum(r.minutos), 0) / 60.0, i.horas_meta) / i.horas_meta * 100,
        1
      )
    else 0
  end as porcentaje
from public.inscripciones i
join public.profiles p on p.id = i.becario_id
join public.semestres s on s.id = i.semestre_id
left join public.registros r on r.inscripcion_id = i.id
group by i.id, i.becario_id, i.semestre_id, p.nombre, p.matricula, s.nombre, i.horas_meta;

comment on view public.avance_becarios is
  'Fuente única del cálculo de avance (acumuladas, faltantes, porcentaje). '
  'El frontend consulta esta vista, nunca reimplementa el sum/join.';

-- =========================================================================
-- RLS
-- =========================================================================

alter table public.semestres enable row level security;
alter table public.profiles enable row level security;
alter table public.inscripciones enable row level security;
alter table public.registros enable row level security;

-- semestres: lectura abierta a cualquier autenticado (necesitan ver en qué
-- semestre se están inscribiendo); escritura solo coordinador.
create policy semestres_select_autenticados
  on public.semestres for select
  to authenticated
  using (true);

create policy semestres_insert_coordinador
  on public.semestres for insert
  to authenticated
  with check (public.es_coordinador());

create policy semestres_update_coordinador
  on public.semestres for update
  to authenticated
  using (public.es_coordinador())
  with check (public.es_coordinador());

create policy semestres_delete_coordinador
  on public.semestres for delete
  to authenticated
  using (public.es_coordinador());

-- profiles: cada quien ve/edita el suyo; coordinador ve/administra todos.
-- El insert queda reservado a coordinador porque las cuentas se crean vía
-- la Edge Function de carga en lote (llave secret, bypassa RLS) o, en este
-- caso, un coordinador dado de alta a mano.
create policy profiles_select_propio_o_coordinador
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.es_coordinador());

create policy profiles_insert_coordinador
  on public.profiles for insert
  to authenticated
  with check (public.es_coordinador());

create policy profiles_update_propio_o_coordinador
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id or public.es_coordinador())
  with check ((select auth.uid()) = id or public.es_coordinador());

create policy profiles_delete_coordinador
  on public.profiles for delete
  to authenticated
  using (public.es_coordinador());

-- inscripciones: el becario solo lee las suyas; crear/editar/borrar es
-- exclusivo de coordinador porque es parte del flujo de carga en lote y
-- define la meta de horas del becario.
create policy inscripciones_select_propia_o_coordinador
  on public.inscripciones for select
  to authenticated
  using ((select auth.uid()) = becario_id or public.es_coordinador());

create policy inscripciones_insert_coordinador
  on public.inscripciones for insert
  to authenticated
  with check (public.es_coordinador());

create policy inscripciones_update_coordinador
  on public.inscripciones for update
  to authenticated
  using (public.es_coordinador())
  with check (public.es_coordinador());

create policy inscripciones_delete_coordinador
  on public.inscripciones for delete
  to authenticated
  using (public.es_coordinador());

-- registros: el becario lee/crea/edita/borra los de sus propias
-- inscripciones; coordinador ve y administra todos.
create policy registros_select_propio_o_coordinador
  on public.registros for select
  to authenticated
  using (
    public.es_coordinador()
    or exists (
      select 1 from public.inscripciones i
      where i.id = registros.inscripcion_id
        and i.becario_id = (select auth.uid())
    )
  );

create policy registros_insert_propio_o_coordinador
  on public.registros for insert
  to authenticated
  with check (
    public.es_coordinador()
    or exists (
      select 1 from public.inscripciones i
      where i.id = registros.inscripcion_id
        and i.becario_id = (select auth.uid())
        and i.activo
    )
  );

create policy registros_update_propio_o_coordinador
  on public.registros for update
  to authenticated
  using (
    public.es_coordinador()
    or exists (
      select 1 from public.inscripciones i
      where i.id = registros.inscripcion_id
        and i.becario_id = (select auth.uid())
    )
  )
  with check (
    public.es_coordinador()
    or exists (
      select 1 from public.inscripciones i
      where i.id = registros.inscripcion_id
        and i.becario_id = (select auth.uid())
        and i.activo
    )
  );

create policy registros_delete_propio_o_coordinador
  on public.registros for delete
  to authenticated
  using (
    public.es_coordinador()
    or exists (
      select 1 from public.inscripciones i
      where i.id = registros.inscripcion_id
        and i.becario_id = (select auth.uid())
    )
  );
