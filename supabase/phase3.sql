-- TimberCad – phase 3 patch (PC watcher sync + import from the previous system)
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- (Already included in schema.sql for new installs.)

-- Order history: "hub ready" event, imported orders keep their original date,
-- and no e-mail alerts for changes made by the PC watcher or by the import (no signed-in user).
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

-- the import looks orders up by their id in the previous system
create unique index if not exists orders_legacy_idx on public.orders(legacy_id) where legacy_id is not null;
create index if not exists profiles_email_idx on public.profiles(lower(email));

-- the PC watcher and the "admin" function use the secret key (service_role): give it table rights
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
