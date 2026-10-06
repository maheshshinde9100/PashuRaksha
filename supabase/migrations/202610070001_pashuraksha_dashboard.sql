-- PashuRaksha: farm-owned animal records, telemetry and health alerts.
-- Apply this migration in Supabase SQL Editor or with the Supabase CLI.

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Farm',
  created_at timestamptz not null default now()
);

create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  tag text not null,
  breed text,
  status text not null default 'active' check (status in ('active', 'needs_attention', 'inactive')),
  created_at timestamptz not null default now(),
  unique (farm_id, tag)
);

create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  temperature_c numeric(4, 1) check (temperature_c is null or temperature_c between 25 and 50),
  heart_rate_bpm integer check (heart_rate_bpm is null or heart_rate_bpm between 0 and 250),
  activity_level numeric(5, 2) check (activity_level is null or activity_level between 0 and 100),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (temperature_c is not null or heart_rate_bpm is not null or activity_level is not null)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete set null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists animals_farm_id_idx on public.animals(farm_id);
create index if not exists sensor_readings_animal_recorded_idx on public.sensor_readings(animal_id, recorded_at desc);
create index if not exists alerts_farm_created_idx on public.alerts(farm_id, created_at desc);

-- New verified or unverified Supabase Auth accounts receive a private farm workspace.
create or replace function public.create_farm_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.farms (owner_id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'farm_name'), ''), 'My Farm')
  )
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_farm on auth.users;
create trigger on_auth_user_created_create_farm
after insert on auth.users
for each row execute function public.create_farm_for_new_user();

insert into public.farms (owner_id, name)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'farm_name'), ''), 'My Farm')
from auth.users
on conflict (owner_id) do nothing;

alter table public.farms enable row level security;
alter table public.animals enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;

grant select on public.farms, public.animals, public.sensor_readings, public.alerts to authenticated;
grant insert, update, delete on public.animals to authenticated;

drop policy if exists "Farm owners can read their farm" on public.farms;
create policy "Farm owners can read their farm" on public.farms
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Farm owners can read their animals" on public.animals;
create policy "Farm owners can read their animals" on public.animals
for select to authenticated using (
  exists (select 1 from public.farms where farms.id = animals.farm_id and farms.owner_id = (select auth.uid()))
);

drop policy if exists "Farm owners can add their animals" on public.animals;
create policy "Farm owners can add their animals" on public.animals
for insert to authenticated with check (
  exists (select 1 from public.farms where farms.id = animals.farm_id and farms.owner_id = (select auth.uid()))
);

drop policy if exists "Farm owners can update their animals" on public.animals;
create policy "Farm owners can update their animals" on public.animals
for update to authenticated
using (exists (select 1 from public.farms where farms.id = animals.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = animals.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "Farm owners can delete their animals" on public.animals;
create policy "Farm owners can delete their animals" on public.animals
for delete to authenticated using (
  exists (select 1 from public.farms where farms.id = animals.farm_id and farms.owner_id = (select auth.uid()))
);

drop policy if exists "Farm owners can read their sensor history" on public.sensor_readings;
create policy "Farm owners can read their sensor history" on public.sensor_readings
for select to authenticated using (
  exists (
    select 1 from public.animals
    join public.farms on farms.id = animals.farm_id
    where animals.id = sensor_readings.animal_id and farms.owner_id = (select auth.uid())
  )
);

drop policy if exists "Farm owners can read their alerts" on public.alerts;
create policy "Farm owners can read their alerts" on public.alerts
for select to authenticated using (
  exists (select 1 from public.farms where farms.id = alerts.farm_id and farms.owner_id = (select auth.uid()))
);

-- Telemetry is intentionally read-only to browser clients. Sensor ingestion must use
-- a trusted backend or Edge Function with a service-role secret, never an anon key.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sensor_readings'
  ) then
    alter publication supabase_realtime add table public.sensor_readings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;
end;
$$;

-- Self-serve farm provisioning for any authenticated user. Works even when the
-- insert-on-auth-user trigger missed an account (e.g. user created before
-- this migration was applied, or trigger disabled during provider sync).
-- Any authenticated caller can ONLY create/lookup their own farm.
create or replace function public.ensure_own_farm(p_farm_name text default 'My Farm')
returns public.farms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.farms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.farms
  where owner_id = v_uid
  limit 1;

  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.farms (owner_id, name)
  values (v_uid, coalesce(nullif(trim(p_farm_name), ''), 'My Farm'))
  on conflict (owner_id) do nothing;

  select * into v_row
  from public.farms
  where owner_id = v_uid
  limit 1;

  return v_row;
end;
$$;

revoke all on function public.ensure_own_farm(text) from public;
grant execute on function public.ensure_own_farm(text) to authenticated, service_role;

notify pgrst, 'reload schema';
