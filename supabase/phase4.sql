-- TimberCad – phase 4: billing. Client rates, per-order billing, work hours with retainer alerts.
-- Run once in Supabase SQL Editor. Safe to re-run.

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
