-- 0001_init.sql — Bunny Companion baseline schema
--
-- Tables: bunny_family, bunny_memories, bunny_sessions, bunny_last_closer.
-- RLS: anon read/write in v1 (single-family deployment). Tighten when auth
-- is added.
--
-- Apply via: `supabase db push` locally, or paste into Supabase Studio →
-- SQL Editor. Idempotent — safe to re-run.

create table if not exists bunny_family (
  family_id text primary key,
  display_name text,
  created_at timestamptz not null default now()
);

insert into bunny_family (family_id, display_name)
values ('yoyo-family', 'Yoyo & Bunny')
on conflict (family_id) do nothing;

create table if not exists bunny_memories (
  id text primary key,
  family_id text not null references bunny_family(family_id) on delete cascade,
  created_at timestamptz not null default now(),
  memory_type text not null,
  content text not null,
  importance numeric not null default 0.7,
  source text not null default 'session',
  session_date date not null default current_date
);

create index if not exists bunny_memories_family_created_idx
  on bunny_memories (family_id, created_at desc);

create table if not exists bunny_sessions (
  id text primary key,
  family_id text not null references bunny_family(family_id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  turns jsonb not null,
  distilled_ids text[] not null default '{}'::text[],
  session_date date not null default current_date
);

create index if not exists bunny_sessions_family_date_idx
  on bunny_sessions (family_id, session_date desc);

create table if not exists bunny_last_closer (
  family_id text primary key references bunny_family(family_id) on delete cascade,
  ended_at timestamptz not null default now(),
  turns jsonb not null
);

alter table bunny_memories enable row level security;
alter table bunny_sessions enable row level security;
alter table bunny_last_closer enable row level security;

drop policy if exists memories_anon_rw on bunny_memories;
create policy memories_anon_rw on bunny_memories for all using (true) with check (true);

drop policy if exists sessions_anon_rw on bunny_sessions;
create policy sessions_anon_rw on bunny_sessions for all using (true) with check (true);

drop policy if exists closer_anon_rw on bunny_last_closer;
create policy closer_anon_rw on bunny_last_closer for all using (true) with check (true);
