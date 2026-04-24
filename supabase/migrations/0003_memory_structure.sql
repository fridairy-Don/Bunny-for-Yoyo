-- 0003_memory_structure.sql — structural support for preset memories.
--
-- Adds trigger_scope so that prompt assembly can filter preset rows into
-- situation-specific subsets (e.g. only inject "bedtime" presets when the
-- session appears to be at bedtime). 'source' gains 'preset' as a valid
-- value to distinguish parent-curated rows from session-distilled ones.
--
-- Idempotent. Safe to re-run.

alter table bunny_memories
  add column if not exists trigger_scope text not null default 'global';

-- Optional metadata: whether a parent can edit this row. Preset rows default
-- to true; session-distilled rows default to false (they should be deleted,
-- not rewritten — lossless trace of what Yoyo actually said).
alter table bunny_memories
  add column if not exists editable boolean not null default true;

-- Index supports scope-filtered reads on the prompt path.
create index if not exists bunny_memories_family_scope_idx
  on bunny_memories (family_id, trigger_scope);
