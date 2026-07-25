# Bixi app — build notes (v0.1 scaffold)

The React Native (Expo, SDK 57, TypeScript) app lives in **`/mobile`**. It implements the
whole decided experience (`docs/DECISIONS.md`) as a **client-side simulation** — no backend
wired yet. The existing landing page (`index.html`, `app.html`, `videos/`) is untouched.

## ⚠️ One thing you must do before running
Metro (RN's bundler) can't run `expo start` from a path containing `#`. **Rename the project
folder** `appidea#3` → e.g. `appidea3` (or move `/mobile` anywhere `#`-free). Building/bundling
already works (verified via `expo export`); only the live dev server needs the rename.

## Run it
```bash
cd mobile
npm install          # if node_modules is missing
npx expo start       # then press i (iOS sim), a (Android), or scan the QR in Expo Go
```

## What's built & verified
- **Onboarding**: 3 intro cards → auth-less start gate (With someone / On my own / Join) →
  relationship kind → optional nickname → tap-to-hatch egg. (Verified rendering.)
- **Home**: Bixi video scene + mood ring (%+state) + speech bubble + "Interaction of the Day"
  hero card (streak-keeper) + Feed/Pet/Water + More drawer + presence/invite + revive banner.
- **Journal**: streak-calendar heatmap + Field-notes / Daily-log sub-tabs.
- **Growth**: 5-stage ladder, milestone timeline (Full Bloom + 100-day graduation paired-locked),
  "Bixi's Secrets" reward collection.
- **You**: co-parent/invite/leave, Bixi info, notifications, privacy, + a **Dev·Simulate** panel
  (toggle partner presence, simulate bloom/return, reset) so you can explore paired states on ONE
  device.
- **Mood engine** (`src/game/engine.ts`): all Area-12 numbers — slow gains, −5/−7 decay,
  Sad(−10)/Dormant(−30), rolling-24h unforgiving streak, growth milestones. Verified live:
  doing the daily raised mood 25→27 and streak 0→1.

## Backend — BUILT (validated on a live Postgres)
- **Schema + RLS + RPCs + triggers**: `supabase/migrations/0001…0005`. Membership-scoped RLS,
  server-authoritative `create_bixi` / `create_invite` / `claim_invite` / `apply_care` /
  `revive` / `leave_pair`, decay/dormant/streak `recompute_*` for cron, and `nudge_targets`.
  Functionally tested (daily → mood 25→28 with budget cap + idempotency; solo capped at Bloom).
- **notify Edge Function** (`supabase/functions/notify`) — Expo push "Bixi misses you" at 20–24h.
- **Online app layer**: `src/lib/{config,supabase,api,session,push}.ts` + `src/game/{sync,actions}.ts`.
  Auth (email OTP live; Apple/Google via OAuth), realtime presence, deep-link `/join/[token]`.
  **Env-gated**: with `EXPO_PUBLIC_SUPABASE_*` set → online; unset → the offline demo (unchanged).
  Online path is typechecked + bundle-clean but NOT runtime-verified (needs your keys + a device).
- See `docs/SETUP.md` for the go-live checklist.

## What's placeholder / needs YOU (see docs/SETUP.md)
- **Videos** (designs): your `videos/*.mp4` stand in for Bixi's states. Swap for real clips / Rive.
- **Interaction library**: Feed/Pet/Water live; Tickle/Tease/Pinch render as "soon" until you add
  videos + flip `available:true` in `src/game/content/interactions.ts`.
- **Icon/splash**: still Expo defaults.
- **Credentials**: Supabase URL/keys, Apple/Google providers, EAS push, bixi.pet domain + `.well-known`.
- **RevenueCat** (Phase-2 monetization) — not started (intentional, post-retention).

## Known tuning TODOs (flagged, not blocking)
- Mood→state band thresholds are placeholders; revisit in the numbers pass.
- Sad/Dormant penalties vs per-day decay may double-count — reconcile when tuning.
- Real streak/day rollover currently approximated client-side; server owns it later.

## Structure
```
mobile/src/
  theme/            colors, fonts (Fraunces/Hanken/IBM Plex Mono), spacing
  game/             types · engine (tuned numbers) · store (Zustand+AsyncStorage) · content/
  ui/               BixiScene (video) · MoodRing (svg) · primitives · home-widgets
  app/              expo-router routes: onboarding/* and (tabs)/*
```
