-- TimberCad – phase 5: a sample program for every client. Safe to re-run.
-- Every client gets one order "תוכנית דוגמא" that opens the shared sample work center
-- (hubs/sample/APP_SAMPLE.html, uploaded by the PC watcher). It is never billed and never listed for the admin.

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
