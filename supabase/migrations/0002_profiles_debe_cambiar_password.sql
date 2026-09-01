-- 0002_profiles_debe_cambiar_password.sql
-- Agrega la señal de "contraseña por defecto sin cambiar" a profiles, protegida por el
-- mismo trigger que ya protege rol/activo/matricula/correo.

alter table public.profiles
  add column debe_cambiar_password boolean not null default true;

comment on column public.profiles.debe_cambiar_password is
  'true mientras la cuenta conserve la contraseña asignada por el coordinador. Solo la Edge '
  'Function cambiar-password-forzado (service_role) o un coordinador pueden apagarla — un '
  'becario no puede escribirla directo via RLS, ver proteger_campos_privilegiados_profile.';

-- Se extiende el trigger existente para que también proteja debe_cambiar_password: un
-- usuario autenticado sin rol coordinador no puede apagarla directo (ej. un PATCH manual a
-- profiles desde las devtools) — solo coordinador, o una llamada sin sesión de usuario
-- (auth.uid() null, que es como corre la Edge Function con la llave service_role).
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
        or new.correo is distinct from old.correo
        or new.debe_cambiar_password is distinct from old.debe_cambiar_password) then
    raise exception 'Solo un coordinador puede cambiar rol, activo, matrícula, correo o el estado de cambio de contraseña de un profile';
  end if;
  return new;
end;
$$;
