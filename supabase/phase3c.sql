-- TimberCad – phase 3c: hide orders (admin only), business name = contact name where empty. Safe to re-run.
alter table public.orders add column if not exists hidden boolean not null default false;

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

update public.profiles set company_name = full_name
 where coalesce(trim(company_name), '') = '' and coalesce(trim(full_name), '') <> '';
