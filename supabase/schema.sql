-- Bunny Companion — Supabase schema
-- Paste the entire file into Supabase Dashboard → SQL Editor → Run.

-- Family identifier. In v1 we use a single shared family id so every device
-- reads the same Bunny. No login needed for Yoyo. Parent can rotate the
-- family_id later if they want to hard-reset.
create table if not exists bunny_family (
  family_id text primary key,
  display_name text,
  created_at timestamptz not null default now()
);

insert into bunny_family (family_id, display_name)
values ('yoyo-family', 'Yoyo & Bunny')
on conflict (family_id) do nothing;

-- Distilled long-term memories Bunny carries between sessions.
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

-- Raw session archives (full transcript of every saved session).
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

-- One row per family: the tail of the last session, for "pick up where we left off".
create table if not exists bunny_last_closer (
  family_id text primary key references bunny_family(family_id) on delete cascade,
  ended_at timestamptz not null default now(),
  turns jsonb not null
);

-- Row-level security: keep tables open for anon in v1 (single-family deployment).
-- If you later add auth, tighten these policies.
alter table bunny_memories enable row level security;
alter table bunny_sessions enable row level security;
alter table bunny_last_closer enable row level security;

drop policy if exists memories_anon_rw on bunny_memories;
create policy memories_anon_rw on bunny_memories for all using (true) with check (true);

drop policy if exists sessions_anon_rw on bunny_sessions;
create policy sessions_anon_rw on bunny_sessions for all using (true) with check (true);

drop policy if exists closer_anon_rw on bunny_last_closer;
create policy closer_anon_rw on bunny_last_closer for all using (true) with check (true);
