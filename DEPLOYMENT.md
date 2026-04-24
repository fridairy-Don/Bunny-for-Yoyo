# Bunny Companion Deployment Notes

## Secret Handling

- Keep all provider secrets in server-side environment variables only.
- Never expose provider keys with `NEXT_PUBLIC_` prefixes.
- Keep local secrets in `.env.local`.
- Keep committed placeholders only in `.env.example`.
- For Vercel, add the same variables in Project Settings -> Environment Variables.
- Keep all third-party access behind app-owned routes: `/api/stt`, `/api/chat`, `/api/tts`.
- Treat any key pasted into chat, screenshots, or tickets as exposed and rotate it before production launch.

## Phase 1 Provider Variables

- `APP_PUBLIC_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `GROQ_API_KEY`
- `GROQ_STT_MODEL`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`

## Recommended Model Direction

### STT

- Preview / Development default: `whisper-large-v3-turbo`
- Production default: `whisper-large-v3`
- Reason: use Turbo while iterating fast, then bias production slightly toward accuracy because a child voice companion is more error-sensitive than a generic demo.

### LLM

- Preview / Development default: `google/gemini-2.5-flash-lite`
- Production default: `google/gemini-2.5-flash`
- Reason: Flash-Lite keeps preview latency and cost low while we iterate; full Flash is the stronger production default when emotional nuance matters more.

### TTS

- Default across environments: `eleven_multilingual_v2`
- Faster fallback option: `eleven_flash_v2_5`
- Reason: for Bunny this step now prioritizes warmth and emotional richness over the absolute lowest latency.
- Current default voice: `ocZQ262SsZb9RIxcQBOj` (`Lulu Lolipop - High-Pitched and Bubbly`)
- Current speed tuning: `speed=0.9` for a slightly slower, easier-to-follow delivery.

## Deployment Defaults In Code

- `production`
  - `OPENROUTER_MODEL=google/gemini-2.5-flash`
  - `GROQ_STT_MODEL=whisper-large-v3`
  - `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`
- `preview` / `development`
  - `OPENROUTER_MODEL=google/gemini-2.5-flash-lite`
  - `GROQ_STT_MODEL=whisper-large-v3-turbo`
  - `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`
- Any explicit environment variable still overrides the defaults.

## Vercel Deployment Rules

- Put secrets in Vercel Environment Variables for `Development`, `Preview`, and `Production` separately
- Do not commit `.env.local`
- Prefer branch-specific Preview variables if you need to test alternate models safely
- Use `vercel env pull` locally instead of copying secrets around manually once the Vercel project exists
- Set `APP_PUBLIC_URL` to the canonical deployed domain so provider headers do not stay pinned to localhost.
- Keep Production secrets only on the production environment and lighter-cost model overrides in Preview.
- Vercel stores environment variables encrypted at rest, but visibility still depends on project permissions, so keep project access tight.

## Current Architecture

- Browser calls app-owned routes: `/api/stt`, `/api/chat`, `/api/tts`
- App-owned routes call third-party providers on the server
- If secrets are missing, routes fall back to mock mode instead of breaking the child-facing UI
- Provider configuration is kept in server-only modules to reduce accidental client import risk
