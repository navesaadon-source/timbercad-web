-- TimberCad – database schema (phase 1)
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists pg_net;

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null default '',
  full_name     text not null default '',
  company_name  text not null default '',
  phone         text not null default '',
  role          text not null default 'client' check (role in ('admin','client')),
  defaults      jsonb not null default '{"hinge":{},"drawer":{}}'::jsonb,
  notes         text not null default '',
  drive_folder  text not null default '',
  auto_folders  boolean not null default true,   -- false: service client, no automatic job folders
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- admin e-mails get the admin role automatically on first sign-in
alter table public.profiles add column if not exists auto_folders boolean not null default true;

create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails values ('timbercad.cnc@gmail.com') on conflict do nothing;
alter table public.admin_emails enable row level security;  -- no policies: readable only by the sign-up trigger

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)) then 'admin' else 'client' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- clients may not promote themselves or edit admin-only fields
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
drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles admin insert" on public.profiles for insert to authenticated
  with check (public.is_admin());

-- ───────────────────────── catalog ─────────────────────────
create table if not exists public.catalog (
  id        uuid primary key default gen_random_uuid(),
  category  text not null,
  key       text not null,
  label     text not null,
  parent    text,
  sort      int  not null default 100,
  active    boolean not null default true,
  unique (category, key, parent)
);
alter table public.catalog enable row level security;
drop policy if exists "catalog read" on public.catalog;
create policy "catalog read" on public.catalog for select using (true);
drop policy if exists "catalog admin" on public.catalog;
create policy "catalog admin" on public.catalog for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── orders ─────────────────────────
create sequence if not exists public.order_no_seq start 1001;
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      int  not null default nextval('public.order_no_seq') unique,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  project_name  text not null,
  job_name      text not null default '',
  status        text not null default 'submitted'
                check (status in ('submitted','production','frozen','done','billing','billed','cancelled')),
  hardware      jsonb not null default '{"hinge":{},"drawer":{}}'::jsonb,
  carcass       jsonb not null default '{}'::jsonb,
  fronts        jsonb not null default '{}'::jsonb,
  notes         text not null default '',
  admin_notes   text not null default '',
  attachments   jsonb not null default '[]'::jsonb,
  sheets_count  int,
  hub_path      text,
  frozen_at     timestamptz,
  legacy_id     text,                         -- id from the previous system (import)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
alter table public.orders add column if not exists hidden boolean not null default false;
create unique index if not exists orders_legacy_idx on public.orders(legacy_id) where legacy_id is not null;
create index if not exists profiles_email_idx on public.profiles(lower(email));

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- job_name defaults to the project name (used as the iMOS / Drive folder name)
create or replace function public.orders_defaults() returns trigger language plpgsql as $$
begin
  if coalesce(new.job_name, '') = '' then
    new.job_name := regexp_replace(trim(new.project_name), '[\\/:*?"<>|]+', ' ', 'g');
  end if;
  return new;
end $$;
drop trigger if exists orders_defaults_trg on public.orders;
create trigger orders_defaults_trg before insert on public.orders
  for each row execute function public.orders_defaults();

-- Workflow rules for clients (admins may change anything):
--   submitted  → client may edit content, or cancel
--   production → client may only freeze (→ frozen)
--   frozen     → client may only resume (→ production)
--   anything else is read-only for the client
create or replace function public.orders_client_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    if new.status = 'frozen' and old.status is distinct from 'frozen' then new.frozen_at := now(); end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.admin_notes is distinct from old.admin_notes
     or new.sheets_count is distinct from old.sheets_count or new.hub_path is distinct from old.hub_path
     or new.job_name is distinct from old.job_name or new.order_no is distinct from old.order_no
     or new.hidden is distinct from old.hidden then
    raise exception 'Not allowed to change this field';
  end if;
  if old.status = 'submitted' then
    if new.status not in ('submitted','cancelled') then raise exception 'Not allowed to change status'; end if;
    return new;
  end if;
  -- outside "submitted": only the status may change, and only freeze / resume
  if (new.project_name, new.hardware, new.carcass, new.fronts, new.notes, new.attachments)
     is distinct from (old.project_name, old.hardware, old.carcass, old.fronts, old.notes, old.attachments) then
    raise exception 'The order is in production and can no longer be edited';
  end if;
  if old.status = 'production' and new.status = 'frozen' then new.frozen_at := now(); return new; end if;
  if old.status = 'frozen' and new.status = 'production' then return new; end if;
  if new.status = old.status then return new; end if;
  raise exception 'Not allowed to change status';
end $$;
drop trigger if exists orders_client_guard_trg on public.orders;
create trigger orders_client_guard_trg before update on public.orders
  for each row execute function public.orders_client_guard();

alter table public.orders enable row level security;
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert to authenticated
  with check ((user_id = auth.uid() and status = 'submitted') or public.is_admin());
drop policy if exists "orders update" on public.orders;
create policy "orders update" on public.orders for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders delete" on public.orders;
create policy "orders delete" on public.orders for delete to authenticated using (public.is_admin());

-- ───────────────────────── order history ─────────────────────────
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  actor_id    uuid,
  kind        text not null,
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id);
alter table public.order_events enable row level security;
drop policy if exists "events read" on public.order_events;
create policy "events read" on public.order_events for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- ───────────────────────── notifications ─────────────────────────
-- Settings read by the trigger (fill in after deploying the "notify" function):
--   insert into public.settings values ('notify_url','https://<project>.supabase.co/functions/v1/notify'),
--                                      ('notify_secret','<same value as NOTIFY_SECRET secret>');
create table if not exists public.settings (key text primary key, value text not null default '');
alter table public.settings enable row level security;
drop policy if exists "settings admin" on public.settings;
create policy "settings admin" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.notify(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url from public.settings where key = 'notify_url';
  select value into v_secret from public.settings where key = 'notify_secret';
  if coalesce(v_url, '') = '' then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(v_secret, '')),
    body := payload
  );
end $$;

create or replace function public.orders_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client jsonb; v_kind text; v_client_action boolean;
begin
  v_client_action := auth.uid() is not null and not public.is_admin();
  select to_jsonb(p) - 'defaults' - 'notes' into v_client from public.profiles p where p.id = new.user_id;
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, actor_id, kind, to_status, note, created_at)
      values (new.id, auth.uid(), 'created', new.status,
              case when new.legacy_id is not null then 'יובא מהמערכת הקודמת' end, new.created_at);
    if v_client_action then
      perform public.notify(jsonb_build_object('type', 'order_created', 'order', to_jsonb(new), 'client', v_client));
    end if;
    return new;
  end if;
  if new.hub_path is not null and old.hub_path is null then
    insert into public.order_events (order_id, actor_id, kind, note) values (new.id, auth.uid(), 'hub_ready', new.sheets_count::text);
  end if;
  if new.status is distinct from old.status then
    v_kind := case when new.status = 'frozen' then 'frozen'
                   when old.status = 'frozen' then 'unfrozen' else 'status' end;
    insert into public.order_events (order_id, actor_id, kind, from_status, to_status)
      values (new.id, auth.uid(), v_kind, old.status, new.status);
    if v_kind in ('frozen', 'unfrozen') and v_client_action then
      perform public.notify(jsonb_build_object('type', 'order_' || v_kind, 'order', to_jsonb(new), 'client', v_client));
    end if;
  elsif (new.project_name, new.hardware, new.carcass, new.fronts, new.notes, new.attachments)
        is distinct from (old.project_name, old.hardware, old.carcass, old.fronts, old.notes, old.attachments) then
    insert into public.order_events (order_id, actor_id, kind) values (new.id, auth.uid(), 'edited');
  end if;
  return new;
end $$;

drop trigger if exists orders_log_trg on public.orders;
create trigger orders_log_trg after insert or update on public.orders
  for each row execute function public.orders_log();

-- ───────────────────────── file storage ─────────────────────────
-- bucket "project-files": <user_id>/<order_id>/<file>   (client uploads)
-- bucket "hubs":          <user_id>/<order_id>.html     (job hub, uploaded by the PC watcher)
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('hubs', 'hubs', false) on conflict do nothing;

drop policy if exists "files read" on storage.objects;
create policy "files read" on storage.objects for select to authenticated
  using (bucket_id in ('project-files','hubs') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "files write" on storage.objects;
create policy "files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "files delete" on storage.objects;
create policy "files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ───────────────────────── privileges ─────────────────────────
grant usage on schema public to anon, authenticated;
grant select on public.catalog to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.orders, public.catalog, public.settings to authenticated;
grant select on public.order_events to authenticated;
grant usage, select on sequence public.order_no_seq to authenticated;
revoke execute on function public.notify(jsonb) from public, anon, authenticated;

-- the PC watcher and the "admin" function use the secret key (service_role): give it table rights
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ───────── billing (phase 4) ─────────

-- rates per client (admin only: clients never see these)
create table if not exists public.billing_rates (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  min_price      numeric(10,2),          -- minimum price per order ...
  min_sheets     integer,                -- ... covering up to this many sheets
  per_sheet      numeric(10,2),          -- each sheet above that
  hourly_rate    numeric(10,2),          -- service hours (and hours beyond the retainer)
  retainer_price numeric(10,2),          -- monthly retainer price
  retainer_hours numeric(7,2),           -- hours included in the retainer each month
  notes          text not null default '',
  updated_at     timestamptz not null default now()
);

-- billing details per order (amount = null → computed from the client's rates and the sheets count)
create table if not exists public.order_billing (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  amount     numeric(10,2),
  note       text not null default '',
  invoice_no text not null default '',
  billed_at  timestamptz
);

-- service / retainer hours
create table if not exists public.work_hours (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  work_date   date not null default current_date,
  hours       numeric(7,2) not null check (hours > 0),
  description text not null default '',
  billed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists work_hours_user_date on public.work_hours(user_id, work_date);

alter table public.billing_rates enable row level security;
alter table public.order_billing enable row level security;
alter table public.work_hours enable row level security;
drop policy if exists "rates admin" on public.billing_rates;
create policy "rates admin" on public.billing_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "order billing admin" on public.order_billing;
create policy "order billing admin" on public.order_billing for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "hours admin" on public.work_hours;
create policy "hours admin" on public.work_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.billing_rates, public.order_billing, public.work_hours to authenticated, service_role;

-- alert when a client's retainer hours for the month reach 80% and when they run out
create or replace function public.work_hours_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_used numeric; v_before numeric; v_client jsonb; v_month date;
begin
  select retainer_hours into v_total from public.billing_rates where user_id = new.user_id;
  if coalesce(v_total, 0) <= 0 then return new; end if;
  v_month := date_trunc('month', new.work_date)::date;
  -- runs BEFORE the row is written, so the sum holds only the other lines of that month
  select coalesce(sum(hours), 0) into v_before from public.work_hours
   where user_id = new.user_id and id <> new.id and work_date >= v_month and work_date < (v_month + interval '1 month');
  v_used := v_before + new.hours;
  select to_jsonb(p) - 'defaults' - 'notes' into v_client from public.profiles p where p.id = new.user_id;
  if v_used >= v_total and v_before < v_total then
    perform public.notify(jsonb_build_object('type', 'retainer_exhausted', 'client', v_client,
      'note', format('נוצלו %s מתוך %s שעות ריטיינר בחודש %s', v_used, v_total, to_char(v_month, 'MM/YYYY'))));
  elsif v_used >= v_total * 0.8 and v_before < v_total * 0.8 then
    perform public.notify(jsonb_build_object('type', 'retainer_low', 'client', v_client,
      'note', format('נוצלו %s מתוך %s שעות ריטיינר בחודש %s', v_used, v_total, to_char(v_month, 'MM/YYYY'))));
  end if;
  return new;
end $$;
drop trigger if exists work_hours_alert_trg on public.work_hours;
create trigger work_hours_alert_trg before insert or update of hours, work_date, user_id on public.work_hours
  for each row execute function public.work_hours_alert();

-- ───────── sample program (phase 5) ─────────

alter table public.orders add column if not exists is_sample boolean not null default false;

-- anyone signed in may read the shared sample work center
drop policy if exists "hubs sample read" on storage.objects;
create policy "hubs sample read" on storage.objects for select to authenticated
  using (bucket_id = 'hubs' and name like 'sample/%');

create or replace function public.add_sample_order(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where user_id = p_user and is_sample) then return; end if;
  insert into public.orders (user_id, project_name, job_name, status, is_sample, hub_path, notes)
  values (p_user, 'תוכנית דוגמא', 'APP_SAMPLE', 'done', true, 'sample/APP_SAMPLE.html',
          'תוכנית לדוגמה: כך ייראה מרכז העבודה של כל הזמנה שלכם.');
end $$;

create or replace function public.profiles_sample() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'client' then perform public.add_sample_order(new.id); end if;
  return new;
end $$;
drop trigger if exists profiles_sample_trg on public.profiles;
create trigger profiles_sample_trg after insert on public.profiles
  for each row execute function public.profiles_sample();

-- the clients that already exist
select public.add_sample_order(id) from public.profiles where role = 'client';

-- ───────────────────────── phase 6: sign-up approval ─────────────────────────

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
