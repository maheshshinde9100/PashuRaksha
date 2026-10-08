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
  device_tag text,
  temperature_c numeric(4, 1) check (temperature_c is null or temperature_c between 25 and 50),
  humidity_pct numeric(4, 1) check (humidity_pct is null or humidity_pct between 0 and 100),
  heart_rate_bpm integer check (heart_rate_bpm is null or heart_rate_bpm between 0 and 250),
  motion_pct numeric(5, 2) check (motion_pct is null or motion_pct between 0 and 100),
  activity_level numeric(5, 2) check (activity_level is null or activity_level between 0 and 100),
  accel_x_g numeric(5, 2),
  accel_y_g numeric(5, 2),
  accel_z_g numeric(5, 2),
  gyro_x_dps numeric(6, 2),
  gyro_y_dps numeric(6, 2),
  gyro_z_dps numeric(6, 2),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    temperature_c is not null
    or heart_rate_bpm is not null
    or activity_level is not null
    or motion_pct is not null
  )
);

do $$
begin
  alter table public.sensor_readings add column if not exists device_tag text;
  alter table public.sensor_readings add column if not exists humidity_pct numeric(4, 1)
    check (humidity_pct is null or humidity_pct between 0 and 100);
  alter table public.sensor_readings add column if not exists motion_pct numeric(5, 2)
    check (motion_pct is null or motion_pct between 0 and 100);
  alter table public.sensor_readings add column if not exists accel_x_g numeric(5, 2);
  alter table public.sensor_readings add column if not exists accel_y_g numeric(5, 2);
  alter table public.sensor_readings add column if not exists accel_z_g numeric(5, 2);
  alter table public.sensor_readings add column if not exists gyro_x_dps numeric(6, 2);
  alter table public.sensor_readings add column if not exists gyro_y_dps numeric(6, 2);
  alter table public.sensor_readings add column if not exists gyro_z_dps numeric(6, 2);
exception when others then null;
end $$;

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

create or replace function public.insert_telemetry(
  p_device_tag text,
  p_animal_tag text,
  p_temperature_c numeric,
  p_humidity_pct numeric default null,
  p_heart_rate_bpm integer default null,
  p_motion_pct numeric default null,
  p_accel_x_g numeric default null,
  p_accel_y_g numeric default null,
  p_accel_z_g numeric default null,
  p_gyro_x_dps numeric default null,
  p_gyro_y_dps numeric default null,
  p_gyro_z_dps numeric default null,
  p_recorded_at timestamptz default null
)
returns public.sensor_readings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal public.animals%rowtype;
  v_row public.sensor_readings%rowtype;
begin
  if p_animal_tag is null or length(trim(p_animal_tag)) = 0 then
    raise exception 'Animal tag is required (p_animal_tag)';
  end if;

  select * into v_animal
  from public.animals
  where tag = trim(p_animal_tag)
  limit 1;

  if v_animal.id is null then
    raise exception 'Animal tag "%" is not registered on any farm', p_animal_tag;
  end if;

  insert into public.sensor_readings (
    animal_id, device_tag, temperature_c, humidity_pct, heart_rate_bpm,
    motion_pct, accel_x_g, accel_y_g, accel_z_g,
    gyro_x_dps, gyro_y_dps, gyro_z_dps, recorded_at
  ) values (
    v_animal.id,
    nullif(trim(p_device_tag), ''),
    case when p_temperature_c is not null then round(p_temperature_c, 1) end,
    case when p_humidity_pct is not null then round(p_humidity_pct, 1) end,
    p_heart_rate_bpm,
    case when p_motion_pct is not null then round(p_motion_pct, 2) end,
    case when p_accel_x_g is not null then round(p_accel_x_g, 2) end,
    case when p_accel_y_g is not null then round(p_accel_y_g, 2) end,
    case when p_accel_z_g is not null then round(p_accel_z_g, 2) end,
    case when p_gyro_x_dps is not null then round(p_gyro_x_dps, 2) end,
    case when p_gyro_y_dps is not null then round(p_gyro_y_dps, 2) end,
    case when p_gyro_z_dps is not null then round(p_gyro_z_dps, 2) end,
    coalesce(p_recorded_at, now())
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_telemetry(text, text, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, timestamptz) from public;
grant execute on function public.insert_telemetry(text, text, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, timestamptz) to service_role;

create or replace function public.evaluate_alert_thresholds()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_farm_id uuid;
  v_title text;
  v_message text;
  v_severity text;
  v_temp_f numeric;
  v_motion_f numeric;
  v_hr_f integer;
  v_hum_f numeric;
  v_now timestamptz := now();
  v_recent boolean;
begin
  select a.farm_id into v_farm_id
  from public.animals a
  where a.id = new.animal_id;

  if v_farm_id is null then
    return new;
  end if;

  v_temp_f := new.temperature_c;
  v_motion_f := new.motion_pct;
  v_hr_f := new.heart_rate_bpm;
  v_hum_f := new.humidity_pct;

  if v_temp_f is not null and v_temp_f >= 39.6 then
    v_severity := case when v_temp_f >= 40.5 then 'critical' else 'warning' end;
    v_title := 'High body temperature';
    v_message := 'Latest reading ' || v_temp_f::text || ' °C exceeds the healthy reference range (38.0–39.5 °C).';
  elsif v_temp_f is not null and v_temp_f < 37.0 then
    v_severity := 'warning';
    v_title := 'Low body temperature';
    v_message := 'Latest reading ' || v_temp_f::text || ' °C is below the healthy reference range (38.0–39.5 °C).';
  elsif v_hum_f is not null and v_hum_f >= 85 then
    v_severity := case when v_hum_f >= 95 then 'critical' else 'warning' end;
    v_title := 'Extreme humidity stress';
    v_message := 'Humidity is very high (' || v_hum_f::text || '%). Combined with body temperature this risks heat stress — ensure shade and ventilation.';
  elsif v_motion_f is not null and v_motion_f >= 80 then
    v_severity := 'warning';
    v_title := 'Unusual restlessness';
    v_message := 'Motion index is elevated (' || v_motion_f::text || '%). The animal may be in distress, rumbling, or moving unusually.';
  elsif v_motion_f is not null and v_motion_f <= 1.5 then
    perform 1
    from public.sensor_readings r
    where r.animal_id = new.animal_id
      and r.recorded_at >= (v_now - interval '15 minutes')
      and coalesce(r.motion_pct, 0) <= 2
    having count(*) >= 4;
    if found then
      v_severity := 'info';
      v_title := 'Sustained low movement';
      v_message := 'Motion readings have stayed very low for the last 15 minutes. Verify the animal and device placement.';
    end if;
  elsif v_hr_f is not null and v_hr_f >= 90 then
    v_severity := case when v_hr_f >= 110 then 'critical' else 'warning' end;
    v_title := 'Elevated heart rate';
    v_message := 'Heart rate ' || v_hr_f::text || ' bpm is above the typical resting range (48–84 bpm for adult cattle).';
  elsif v_hr_f is not null and v_hr_f > 0 and v_hr_f < 40 then
    v_severity := 'warning';
    v_title := 'Low heart rate';
    v_message := 'Heart rate ' || v_hr_f::text || ' bpm is below the typical resting range (48–84 bpm for adult cattle).';
  end if;

  if v_title is null then
    return new;
  end if;

  select true into v_recent
  from public.alerts a
  where a.farm_id = v_farm_id
    and (a.animal_id = new.animal_id or a.animal_id is null)
    and a.title = v_title
    and a.resolved_at is null
    and a.created_at >= (v_now - interval '60 minutes')
  limit 1;

  if v_recent is null then
    insert into public.alerts (farm_id, animal_id, severity, title, message, created_at)
    values (v_farm_id, new.animal_id, v_severity, v_title, v_message, v_now);
  end if;

  return new;
end;
$$;

drop trigger if exists evaluate_alert_thresholds_trg on public.sensor_readings;
create trigger evaluate_alert_thresholds_trg
after insert on public.sensor_readings
for each row execute function public.evaluate_alert_thresholds();

notify pgrst, 'reload schema';
