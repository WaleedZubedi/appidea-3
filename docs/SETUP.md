# Bixi — go-live setup checklist

The app + backend are **built and validated**. What's left is plugging in *your* accounts
and *your* designs. Everything below is a credential/config/asset step only you can do.

Legend: 🟢 done in code · 🔵 your action

---

## 1. Supabase (backend)
- 🟢 Schema, RLS, RPCs, triggers, notify function, cron template — in `supabase/migrations/*`
  and `supabase/functions/notify/`. All validated on a live Postgres.
- 🔵 Pick the project (the PRD's `ihqhofeubfqphzegiapl`, or the already-loaded
  **Development VeyroLabs** `zuhytsonhstekzalfuwy` where the schema is already applied for testing).
- 🔵 Apply migrations to your chosen project: `supabase db push` (or paste each `0001…0005`
  into the SQL Editor in order). `0005_cron.sql` is a template — enable `pg_cron` + `pg_net`
  first and fill `<PROJECT_REF>` / `<SERVICE_ROLE_KEY>`.
- 🔵 Deploy the Edge Function: `supabase functions deploy notify`.
- 🔵 Enable **Email** auth (on by default). For **Apple**/**Google**: Auth → Providers →
  add your Apple Service ID / Google OAuth client + secret, and add the redirect
  `bixi://auth-callback` (and `https://bixi.pet/auth-callback`).

## 2. App env (`mobile/.env`)
- 🔵 Copy `mobile/.env.example` → `mobile/.env` and set:
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Settings → API).
  - `EXPO_PUBLIC_EAS_PROJECT_ID` after `eas init`.
- Leaving these blank keeps the **offline demo** running (no auth/backend).

## 3. Run / build
- 🔵 **Rename the project folder** off `appidea#3` (Metro rejects `#` in paths).
- `cd mobile && npx expo start` (press i / a, or Expo Go). `eas build` for stores.

## 4. Push notifications
- 🟢 Registration + `notify` dispatcher + cron template are coded.
- 🔵 `eas init` (project id → env), then real push needs a dev/standalone build (not web).
  iOS also needs an APNs key in Expo; Android uses FCM via EAS credentials.

## 5. Deep links / domain (bixi.pet)
- 🟢 App is configured for `bixi://` + `applinks:bixi.pet` and has the `/join/[token]` route.
- 🔵 Buy `bixi.pet` (available, ~$20/yr — checked). Host `deeplinks/.well-known/*` +
  `join.html` there (see `deeplinks/README.md`); fill the team id / signing fingerprint /
  store URLs.

## 6. Name / legal
- 🔵 Run a **Class-9 trademark clearance** on "Bixi" before investing (Montreal bike-share
  holds it in the same class). See `docs/DECISIONS.md` §25-A.

## 7. Designs (yours to make — the last real gap)
- 🔵 Real Bixi clips (or a Rive `BixiMachine`) → drop into `mobile/assets/videos/`
  (same keys: idle/drift/dormant/feed/water/tap/revive) or swap `BixiScene.tsx` for Rive.
- 🔵 More interactions (Tickle/Tease/Pinch…): add videos + flip `available:true` in
  `mobile/src/game/content/interactions.ts`.
- 🔵 App icon + splash (currently Expo defaults) → `mobile/assets/`.

---

### Still-open product tuning (non-blocking)
Mood→state band thresholds, sad/dormant penalty vs decay double-count, exact daily/gain
values — all live in `mobile/src/game/engine.ts` and the SQL `_bixi_const()`, kept in sync.
