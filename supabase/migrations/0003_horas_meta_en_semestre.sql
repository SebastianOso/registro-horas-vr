-- La meta de horas pasa a vivir en el semestre: todos los becarios de un periodo
-- comparten el mismo objetivo, así que repetirlo en cada inscripción obligaba al
-- coordinador a tipear el mismo número una vez por becario.
--
-- inscripciones.horas_meta sobrevive como override opcional (nullable) para el caso
-- puntual de un becario con carga distinta al resto de su periodo. La vista
-- avance_becarios resuelve cuál aplica con coalesce(i.horas_meta, s.horas_meta) y sigue
-- siendo el ÚNICO lugar donde se calcula el avance (ver skill dominio-horas).

-- =========================================================================
-- semestres.horas_meta
-- =========================================================================

-- Se agrega nullable y después se endurece, en vez de "add column not null default X":
-- un default permanente haría que un insert que olvide la meta pase silencioso con un
-- número inventado, y la meta es justo el dato que el coordinador tiene que declarar.
alter table public.semestres
  add column horas_meta numeric(6, 2);

-- Backfill de los semestres que ya existen: se toma la meta de sus inscripciones si las
-- tiene, y 80 (la meta vigente del programa) para los que todavía no tienen ninguna.
-- Sin el coalesce exterior, un semestre sin inscripciones quedaría null y el "set not
-- null" de abajo abortaría la migración entera.
update public.semestres s
set horas_meta = coalesce(
  (
    select max(i.horas_meta)
    from public.inscripciones i
    where i.semestre_id = s.id
  ),
  80
);

alter table public.semestres
  alter column horas_meta set not null,
  add constraint semestres_horas_meta_positiva check (horas_meta > 0);

comment on table public.semestres is
  'Periodos de servicio (ej. "2026-1"). Solo coordinadores los crean/editan. '
  'horas_meta es la meta de horas de todos los becarios inscritos al periodo.';

comment on column public.semestres.horas_meta is
  'Meta de horas por default de este periodo. Aplica a toda inscripción que no traiga '
  'su propio override en inscripciones.horas_meta.';

-- =========================================================================
-- inscripciones.horas_meta -> override opcional
-- =========================================================================

-- El check inline "horas_meta > 0" de 0001 NO se toca: una CHECK se satisface cuando la
-- expresión da null (unknown no es false), así que las filas sin override pasan, y las
-- que sí traen uno siguen obligadas a ser positivas.
alter table public.inscripciones
  alter column horas_meta drop not null;

comment on table public.inscripciones is
  'Relación becario-semestre. La meta base vive en semestres.horas_meta; aquí solo se '
  'guarda un override opcional para un becario con meta distinta a la de su periodo.';

comment on column public.inscripciones.horas_meta is
  'Override opcional de la meta del semestre. null = aplica semestres.horas_meta. '
  'Nunca leer esta columna directo para mostrar la meta: usar avance_becarios.horas_meta, '
  'que ya resuelve el coalesce.';

-- =========================================================================
-- Vista de avance (ver skill dominio-horas: un único lugar para el cálculo)
-- =========================================================================

-- drop + create, no "create or replace": replace exige que cada columna conserve tipo Y
-- typmod, y horas_meta pasa de una referencia directa a numeric(6,2) a un coalesce cuyo
-- typmod es -1, lo que falla con "cannot change data type of view column". No hay
-- objetos dependientes de esta vista.
drop view if exists public.avance_becarios;

-- security_invoker hace que la vista aplique el RLS del usuario que consulta, no el del
-- dueño de la vista. Sin esto, la vista se ejecutaría con privilegios del creador y
-- expondría todas las filas sin filtrar.
create view public.avance_becarios
with (security_invoker = true) as
select
  a.inscripcion_id,
  a.becario_id,
  a.semestre_id,
  a.becario_nombre,
  a.matricula,
  a.semestre_nombre,
  a.horas_meta,
  a.minutos_acumulados,
  round(a.minutos_acumulados / 60.0, 2) as horas_acumuladas,
  greatest(a.horas_meta - round(a.minutos_acumulados / 60.0, 2), 0) as horas_faltantes,
  case
    when a.horas_meta > 0
      then round(least(a.minutos_acumulados / 60.0, a.horas_meta) / a.horas_meta * 100, 1)
    else 0
  end as porcentaje
from (
  -- La meta efectiva se resuelve una sola vez acá y los derivados de arriba la reusan,
  -- en vez de repetir el coalesce en cada expresión.
  select
    i.id as inscripcion_id,
    i.becario_id,
    i.semestre_id,
    p.nombre as becario_nombre,
    p.matricula,
    s.nombre as semestre_nombre,
    coalesce(i.horas_meta, s.horas_meta) as horas_meta,
    coalesce(sum(r.minutos), 0) as minutos_acumulados
  from public.inscripciones i
  join public.profiles p on p.id = i.becario_id
  join public.semestres s on s.id = i.semestre_id
  left join public.registros r on r.inscripcion_id = i.id
  -- s.horas_meta va explícito en el group by: Postgres solo deduce dependencia funcional
  -- desde la PK de la tabla agrupada, y acá se agrupa por i.id, no por s.id.
  group by i.id, i.becario_id, i.semestre_id, p.nombre, p.matricula, s.nombre,
           i.horas_meta, s.horas_meta
) a;

comment on view public.avance_becarios is
  'Fuente única del cálculo de avance (acumuladas, faltantes, porcentaje). horas_meta ya '
  'viene resuelta: el override de la inscripción si existe, si no la del semestre. '
  'El frontend consulta esta vista, nunca reimplementa el sum/join ni el coalesce.';

-- Defensivo: recrear la vista la despoja de los grants que tuviera. Los default
-- privileges de Supabase sobre el esquema public normalmente ya lo cubren, en cuyo caso
-- esta línea es un no-op; sin ella, si no lo cubrieran, la vista quedaría ilegible para
-- la app y el síntoma sería un 403 opaco en el home del becario.
grant select on public.avance_becarios to authenticated;
