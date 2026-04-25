-- 0004_polaroids.sql — polaroid wall data + storage.
--
-- Each saved session can spawn one polaroid. Image bytes live in Supabase
-- Storage (bucket `polaroids`, public read), metadata + layout state live
-- in `bunny_polaroids` so we can render the wall without downloading every
-- image to inspect it. Layout (tilt, x/y offset, pin colour) is computed
-- once on insert and persisted — never recomputed at render time, so the
-- wall stays visually stable across reloads.
--
-- Idempotent. Safe to re-run.

create table if not exists bunny_polaroids (
  id text primary key,
  family_id text not null references bunny_family(family_id) on delete cascade,
  -- Optional FK to bunny_sessions; nullable because the polaroid record
  -- may exist briefly in 'pending' state before the session row is committed
  -- (we don't actually rely on this ordering today, but keep room for it).
  session_id text,
  session_date date not null default current_date,
  prompt text,
  image_url text,            -- final hosted URL on Supabase Storage
  status text not null default 'pending',  -- pending | ready | failed
  pin_color text not null default 'rose',  -- rose | sun | sky | mint | lilac
  tilt_deg numeric not null default 0,     -- -6 .. +6
  x_offset_px numeric not null default 0,  -- -28 .. +28 px casual scatter
  y_offset_px numeric not null default 0,  -- -16 .. +16 px casual scatter
  liked boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists bunny_polaroids_family_date_idx
  on bunny_polaroids (family_id, session_date desc, created_at desc);

create index if not exists bunny_polaroids_session_idx
  on bunny_polaroids (family_id, session_id);

alter table bunny_polaroids enable row level security;
drop policy if exists polaroids_anon_rw on bunny_polaroids;
create policy polaroids_anon_rw on bunny_polaroids for all using (true) with check (true);

-- Storage bucket for the actual JPGs. Public read so <img src=...> works
-- without a signed URL dance, anon write so the API route can upload using
-- the same anon key the rest of the app already uses.
insert into storage.buckets (id, name, public)
values ('polaroids', 'polaroids', true)
on conflict (id) do update set public = excluded.public;

-- Storage RLS: allow anon select + insert into the polaroids bucket only.
-- Other buckets remain locked down.
drop policy if exists polaroid_storage_read on storage.objects;
create policy polaroid_storage_read on storage.objects
  for select to anon
  using (bucket_id = 'polaroids');

drop policy if exists polaroid_storage_write on storage.objects;
create policy polaroid_storage_write on storage.objects
  for insert to anon
  with check (bucket_id = 'polaroids');
