-- TimberCad – phase 6: sign-up requests that the admin approves
-- New sign-ins get status 'pending'. The client fills in name + company (requested_at is set),
-- the admin is notified, and only after approval can the client see or open orders.
-- Clients that already exist are approved.

alter table public.profiles add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));
alter table public.profiles alter column status set default 'pending';
alter table public.profiles add column if not exists requested_at timestamptz;
update public.profiles set status = 'approved' where role = 'admin';

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (status = 'approved' or role = 'admin'))
$$;

-- admin e-mails are approved on first sign-in
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  v_admin := exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email));
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    case when v_admin then 'admin' else 'client' end,
    case when v_admin then 'approved' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- clients may not approve themselves
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.role is distinct from old.role or new.notes is distinct from old.notes or new.auto_folders is distinct from old.auto_folders
     or new.drive_folder is distinct from old.drive_folder or new.email is distinct from old.email
     or new.status is distinct from old.status then
    raise exception 'Not allowed to change this field';
  end if;
  return new;
end $$;

-- notifications: request sent → admin; approved → client
create or replace function public.profiles_signup_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client jsonb;
begin
  v_client := to_jsonb(new) - 'defaults' - 'notes';
  if new.status = 'pending' and new.requested_at is not null and old.requested_at is null then
    perform public.notify(jsonb_build_object('type', 'signup_request', 'client', v_client));
  end if;
  if new.status = 'approved' and old.status = 'pending' and new.role = 'client' then
    perform public.notify(jsonb_build_object('type', 'signup_approved', 'client', v_client));
  end if;
  return new;
end $$;
drop trigger if exists profiles_signup_trg on public.profiles;
create trigger profiles_signup_trg after update of status, requested_at on public.profiles
  for each row execute function public.profiles_signup_log();

-- the sample program is given on approval, not on first sign-in
create or replace function public.profiles_sample() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'client' and new.status = 'approved' then perform public.add_sample_order(new.id); end if;
  return new;
end $$;
drop trigger if exists profiles_sample_trg on public.profiles;
create trigger profiles_sample_trg after insert or update of status on public.profiles
  for each row execute function public.profiles_sample();

-- a client that is not approved sees and creates nothing
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select to authenticated
  using ((user_id = auth.uid() and public.is_approved()) or public.is_admin());
drop policy if exists "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert to authenticated
  with check ((user_id = auth.uid() and status = 'submitted' and public.is_approved()) or public.is_admin());
drop policy if exists "orders update" on public.orders;
create policy "orders update" on public.orders for update to authenticated
  using ((user_id = auth.uid() and public.is_approved()) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_approved()) or public.is_admin());
drop policy if exists "files write" on storage.objects;
create policy "files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (((storage.foldername(name))[1] = auth.uid()::text and public.is_approved()) or public.is_admin()));
drop policy if exists "hubs sample read" on storage.objects;
create policy "hubs sample read" on storage.objects for select to authenticated
  using (bucket_id = 'hubs' and name like 'sample/%' and public.is_approved());
