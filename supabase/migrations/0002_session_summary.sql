-- 0002_session_summary.sql — add per-session summary text column.
--
-- Each saved session gets an optional 1-2 sentence summary produced by
-- /api/summarize after archival. Injected into the first-turn prompt on
-- subsequent sessions so Bunny carries more emotional through-line than
-- the single last-closer fragment.
--
-- Idempotent. Safe to re-run.

alter table bunny_sessions
  add column if not exists summary text;
