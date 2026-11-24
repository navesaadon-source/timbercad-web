-- TimberCad – phase 3b: per-client switch for automatic Drive folders. Safe to re-run.

-- service clients: no automatic job folders in Drive
alter table public.profiles add column if not exists auto_folders boolean not null default true;
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.role is distinct from old.role or new.notes is distinct from old.notes or new.auto_folders is distinct from old.auto_folders
     or new.drive_folder is distinct from old.drive_folder or new.email is distinct from old.email then
    raise exception 'Not allowed to change this field';
  end if;
  return new;
end $$;
