# Supabase migrations

Versioned schema files. Each file is idempotent and applied in order.

## Current state

- `0001_init.sql` — baseline: `bunny_family`, `bunny_memories`,
  `bunny_sessions`, `bunny_last_closer`, + anon RLS policies.

## How to apply

**Option A — Supabase CLI (preferred going forward):**
```sh
supabase db push
```

**Option B — Supabase Studio:** paste each file in order into SQL Editor →
Run.

**Option C — MCP (what we've used so far):** call the
`mcp__supabase__apply_migration` tool with the file contents.

## Adding a new migration

1. Name it `NNNN_short_description.sql` (next number in sequence).
2. Write idempotent SQL (`create table if not exists`, `drop policy if
   exists`, etc.).
3. If the change would break older clients (removing a column, renaming),
   add a comment explaining the rollout plan.
4. Update the "Current state" list above.

The flat `supabase/schema.sql` file at the repo root is kept as a snapshot
of the current full schema — regenerate it by concatenating all applied
migrations in order, not by hand-editing.
