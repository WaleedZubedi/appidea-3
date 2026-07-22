# Bixi — Complete Lifecycle & Behaviour Spec

The single, exhaustive description of how Bixi behaves from first launch → full bloom →
leaving, for **solo** and **paired** keepers, and **every** in-between state. It reconciles
three sources of truth:

- `docs/DECISIONS.md` — the product decisions we made, area by area.
- `mobile/src/game/engine.ts` — the client mood/streak engine (offline sim + display).
- The **live Supabase RPCs** (`_bixi_const`, `apply_care`, `revive`, `recompute_pair`,
  `create_bixi`, `create_invite`, `claim_invite`) — the server-authoritative truth in online mode.

Where the **shipped code** differs from the **design intent**, it's flagged:
🟢 built · 🟡 partial / needs wiring · 🔴 designed, not built yet.

---

## 0. Core model (read this first)

Bixi has **three independent progress systems**. Don't conflate them.

| System | Range | Speed | Purpose | Resets? |
|---|---|---|---|---|
| **Mood** | 0–100% | fast (days) | short-term wellbeing; drives face/voice/art | yes — decays & penalties |
| **Streak** | 0…∞ days | 1/day | consistency; gates growth; the retention engine | **yes — one miss → 0** |
| **Growth stage** | Egg→Full Bloom | very slow | visible maturation; permanent trophies | **no — never demotes** |

Plus two **modes** and one **permanent flag**:

- **Mode** = `solo` (1 keeper) or `paired` (2 keepers). Derived from `pair_members` count.
- **`ever_reached_100`** = the "graduation" flag. Once a *paired* Bixi hits a 100-day streak,
  this latches **true forever** and the full 100% ceiling stays even if the pair later breaks.

**Server is authoritative in online mode.** The device clock is never trusted for mood/streak.
The client `engine.ts` is a mirror used for the offline demo and for optimistic display.

---

## 1. The exact numbers (from `_bixi_const()`, live)

```
Mood start:        25 (solo)              → 50 on bloom (co-parent joins)
Ceilings:          70 (solo) · 100 (paired, or graduated-solo)
Reward thresholds: secret @ 80 mood · dance @ 90 mood
Graduation:        100-day paired streak → permanent 100 ceiling

Gains (per action):    daily-interaction +2 · permanent (feed/pet/water) +1
Per-cycle budget:      solo +3 total / 24h · paired +2 per keeper / 24h
Decay (when ignored):  −5/day (solo) · −7/day (paired)   [only after 24h of neglect]
Neglect penalties:     Sad recovery −10 · Dormant revive −30   (one-time hits)

Absence timers:    Sad @ 24h (paired, one keeper) · Dormant @ 48h solo / 24h paired (both)
Streak window:     24h rolling · reminder @ 20h · MISS = reset to 0 (no grace, no freeze)

Growth streak gates:  Sprout 7 · Bud 30 · Bloom 60 (solo max) · Full Bloom 90 (paired only)
```

Design tone (Area 12): **slow to gain, unforgiving to neglect.** ~2 weeks of daily care to
reach the ceiling; a single missed day zeroes the streak. Bixi **never permanently dies** — he
goes dormant and is always revivable.

---

## 2. Onboarding — every path, screen by screen

Routing is decided by `mobile/src/app/index.tsx` on every launch:

```
ONLINE mode (Supabase configured):
  not signed in            → /onboarding/intro   (intro → auth)
  signed in, in a pair     → /(tabs)             (straight to Home)
  signed in, no pair yet   → /onboarding/gate    (choose solo/paired)
OFFLINE demo:
  onboarded + hatched      → /(tabs)
  else                     → /onboarding/intro
```

### 2.1 Intro (first-launch story) 🟢
- `onboarding/intro.tsx` — 3 full-bleed cards, swipe through, **not skippable**, first-run only.
  1. *Meet Bixi* — a tiny creature you keep alive.
  2. *Raise him together* — solo or with your person; blooms brightest with two.
  3. *Show up, he thrives* — care daily and he grows; drift and he wilts.
- Last card CTA → `auth` (online) or `gate` (offline demo).

### 2.2 Auth 🟢 (email + password)
- `onboarding/auth.tsx` — email + password, **Create account ⇄ Sign in** toggle.
- Sign-up calls `signUpWithPassword` → Supabase `signUp` → our `confirm_signup` RPC
  auto-confirms the address server-side (no email delivery needed) → auto sign-in.
- On success: `actHydrate()` pulls server state, then routes to `/(tabs)` if already paired,
  else `/onboarding/gate`.
- **Design intent** (Area 1) was Apple + Google OAuth; those are wired in `session.ts` but
  need providers enabled in Supabase. Email/password is the working path today. 🟡

> ⚠️ **Operational note:** disable **Authentication → Email → "Confirm email"** in Supabase,
> or every signup tries to send a (bouncing) confirmation email → rate limits. Our flow does
> not need it.

### 2.3 Start gate 🟢
- `onboarding/gate.tsx` — "Raise Bixi together, or on your own?"
  - **With someone** (primary) → `kind`
  - **On my own** (secondary, first-class) → `name?mode=solo`
  - **"Have an invite code? Join a Bixi →"** (quiet link) → `join`
  - **Sign out** link (added for testing / account switching).

### 2.4 Relationship kind 🟢 (paired path only)
- `onboarding/kind.tsx` — couple / best friend / family. **Cosmetic + analytics only**,
  skippable. Stored on `pairs.relationship_kind`. Not asked on the solo path.

### 2.5 Name 🟢
- `onboarding/name.tsx` — optional nickname (default "Bixi"). Species/brand copy is always
  "Bixi"; this is just the personal name shown on Home. Stored on `pairs.bixi_name`.

### 2.6 Hatch 🟢
- `onboarding/hatch.tsx` — tap the egg **3×** to hatch (first act of care; haptics).
- Calls `actHatch(mode, name, kind)`:
  - ONLINE → `create_bixi(name, kind, paired)` → inserts `pairs` + `pair_members` (you as
    `keeper`) + a `hatch` milestone ("Day 001"). `bixi_state` starts at **mood 25, stage egg**.
  - Guard: `already_has_bixi` if you already belong to a pair (v1 = one Bixi per person).
- After hatch: **paired path** → `/onboarding/invite`; **solo path** → `/(tabs)`.
- Note (both paths): the creator always **meets Bixi solo first**, then invites.

### 2.7 Invite (paired creator) 🟢 (hardened)
- `onboarding/invite.tsx` — mints and shows the **unique** invite.
- On mount (online), if no valid code exists it calls `actInvite()` → `create_invite(pair)`:
  - generates `token` (32-hex) **and** a human code `BIXI-XXXX`, **7-day expiry**,
  - **deletes any prior unclaimed invite for this pair** (one active invite at a time),
  - returns `{token, code, expires_at}`; the screen shows the real `BIXI-XXXX`.
- Shows a spinner while minting and a **real error** ("You need to be signed in…") if it fails
  — never a dead `BIXI-…` placeholder anymore.
- **Share** = the code (recipient types it into Join).
- 🔴 **QR code + tappable deep link**: designed (Area 1), not usable in Expo Go — a real
  `bixi://` / `bixi.pet` link needs a custom EAS build + hosted `.well-known` files. Use the code.

### 2.8 Join (the second keeper) 🟢 (hardened)
- `onboarding/join.tsx` — type the `BIXI-XXXX` code → confirm card → **Join & bloom**.
- Calls `actClaim(code)` → `claim_invite(code)`:
  - accepts the code **or** the token (case-insensitive),
  - rejects: `already_has_bixi` (joiner already in a pair), `invite_used`, `invite_expired`,
    `pair_full` (respects `pairs.keeper_max = 2`), `not authenticated`,
  - on success: inserts the joiner into `pair_members`, sets `pairs.bloomed_at`, bumps
    `bixi_state.mood` to **≥ 50**, writes a `bloom` milestone, returns `pair_id`.
- Errors are surfaced to the user (friendly text) and it returns to the code screen to retry —
  no more silent "success" on a bad code.
- 🔴 Cosmetic gap: the confirm card shows a hardcoded "your person" rather than the real
  inviter's name (no pre-claim lookup RPC yet).

---

## 3. Bloom — the co-parent payoff (Area 1 / decisions)

The moment a valid `claim_invite` lands:

- **Joiner** sees the bloom **live** (immediate payoff; `REACTION_BLOOM` reaction + hydrate).
- **Creator**: 🟡 designed to get a push ("Your person joined — Bixi bloomed 🌸") and see the
  bloom on next open. Today the creator sees it via **realtime** (now enabled) or on next open;
  the dedicated queued "play-once" bloom sequence + push is not fully wired.
- Bloom is an **upgrade in place** — same Bixi, all history/streak/growth preserved. Mood jumps
  to ≥ 50 and the ceiling unlocks to 100.

---

## 4. The daily loop (Home)

`app/(tabs)/index.tsx`. Every care action → `actCare(key)` / `actDaily()` → server `apply_care`.

### 4.1 Permanent interactions 🟢
- Core row **Feed / Pet / Water** + a **More** drawer (data-driven library; Tickle/Tease/…
  drop in as content). Tapping Bixi directly = **Pet**.
- Each gives **+1 mood**, subject to the per-cycle budget (below).
- Client marks each interaction "done" for ~24h (`usedThisCycle`) for the button state.

### 4.2 Interaction of the Day 🟢 (the streak-keeper)
- A rotating daily interaction shown as a **hero card** above the row. **Always available**
  (not locked). Gives **+2 mood** and is the **only** thing that advances/holds the streak.

### 4.3 How mood actually accrues (`apply_care`, authoritative)
Per keeper, over a **rolling 24h window**:
- Budget = **3 (solo)** or **2 per keeper (paired)**.
- The server sums this keeper's care-event gains in the last 24h; each new action grants
  `min(action_gain, budget − already_spent)`. So:
  - **Solo:** Feed+Pet+Water = +3 (budget hit); the daily's +2 also draws from the same +3.
  - **Paired:** each keeper can add at most **+2/day**; two active keepers ⇒ up to **+4/day**.
- **Idempotency:** every action carries a `client_action_id`; a duplicate insert is ignored →
  **no double gain** (safe against retaps / retries).
- Mood is clamped to the current ceiling (70 solo / 100 paired-or-graduated).
- Unlock side-effects on every apply: mood ≥ 80 → `secret1`; mood ≥ 90 → `dance`.

### 4.4 How the streak advances (`apply_care`, only on the daily)
When `p_is_daily = true`:
- **Solo:** advances if it's a new cycle (`last_streak_day_at` is null or > 20h ago).
- **Paired:** advances **only if BOTH keepers are current** (`bool_and(last_daily_at within 24h)`)
  **and** it's a new cycle. So the pair-streak holds only while **both** show up. Each keeper
  taps their own daily; neither is blocked by the other.
- On advance: `streak += 1`, `best_streak` updated, `total_care_days += 1`, `last_streak_day_at = now`.
- Then growth is re-evaluated (§6).

### 4.5 "Both here now" live moment 🔴
- Design (Area 13 §25-E): both keepers open within a short window → shared animation + **+3
  mood once/day** + double haptic. Constant `bothHereBonus: 3` exists; **presence-based trigger
  not built.** Realtime channel exists (`subscribeToPair`) but only re-hydrates state.

---

## 5. Mood decay & the two neglect states

### 5.1 Decay (`recompute_pair`) 🟡
- Only bites **after 24h** of nobody interacting (a one-cycle grace). Then mood drops
  **−5/day (solo)** or **−7/day (paired)**, proportional to elapsed neglected time.
- ⚠️ **Wiring gap:** server decay/dormancy live in `recompute_pair`, intended to run on a
  **pg_cron schedule** — but `0005_cron.sql` is still a placeholder template (not applied).
  **So in online mode, server mood does not currently decay on its own** between interactions.
  The client `engine.simulateElapsed` shows decay for the **offline** sim only. → To make
  online neglect real, wire the cron (or call `recompute_pair` on app open). See §11.

### 5.2 Sad — paired, ONE keeper absent ≥ 24h 🟢
- `deriveMoodState` returns **`sad`** when exactly one keeper has drifted past 24h.
- The **present** keeper's care still lands normally.
- When the **absent** keeper returns and interacts, `apply_care` charges a one-time
  **−10 mood** "sad recovery" penalty (they were gone > `sad_hours`), then applies their gain.
- Bixi's voice goes tender/longing and uses the absent keeper's name ("I miss Maya").

### 5.3 Dormant — deep neglect 🟢
- **Solo:** nobody interacts for **48h** → dormant.
- **Paired:** **both** keepers absent ≥ 24h → dormant. (If *either* keeper interacts, the
  dormant clock resets — dormancy means *joint* abandonment.)
- On dormant: `dormant = true`; paired sets `revive_pending = [both keeper ids]`.
- Bixi shows a **Revive banner**; voice goes quiet/wistful (never blaming).

---

## 6. Growth ladder (`_stage_for`, permanent)

```
Egg (0) → Sprout (7) → Bud (30) → Bloom (60, solo max) → Full Bloom (90, paired only)
```

- Advanced by the **current unbroken streak**; re-checked on every daily advance in `apply_care`.
- **Permanent once earned** — a later broken streak (or going dormant) **never demotes** Bixi;
  you just rebuild streak toward the next gate.
- **Solo caps at Bloom (60).** Full Bloom (90) requires `paired = true` at the moment the
  streak crosses 90.
- Reaching Full Bloom sets `has_companion = true` and adds `companion` to `unlocked_secrets`
  (the companion **is** the Full Bloom reward — Bixi gets his own little friend).
- ⚠️ **Unbroken is brutal by design:** a miss at day 89 zeroes the streak; Full Bloom must be
  re-earned from a fresh 90-day run. Top content is intentionally rare.

### Rewards gallery (Growth tab)
- `secret1` @ mood 80 · `dance` @ mood 90 · `companion` @ Full Bloom. Collected + replayable;
  locked ones show as teasers. Mood rewards are mostly **paired-reachable** (solo ceiling 70 <
  80), so a solo keeper generally can't unlock the secret/dance — by design ("brightest with two").

---

## 7. Revive (`revive`) 🟢

Only works while `dormant = true`. The keeper(s) who **drifted** must return and pet.

- **Solo:** the keeper pets → immediate revive, **−30 mood**, `dormant = false`.
- **Paired, one drifted:** `revive_pending` holds the drifted ids; each pet removes that keeper.
  The returning keeper revives; if others are still pending it **waits**.
- **Paired, both drifted:** `revive_pending = [both]`. The **first** to pet is recorded but
  Bixi stays dormant; only when the **last** pending keeper pets does he revive (**true reunion**),
  **−30 mood**.
- After revive: **streak stays 0**, mood is knocked down −30, but **all growth stages +
  companion are kept**. A `revive` milestone is logged.
- 🟡 Async: the reviver sees it live; the other keeper is designed to see it on next open (same
  pattern as bloom). Realtime now propagates the state change.
- **Escape hatch:** if both drifted and only one ever returns, the Area-9 auto-revert-to-solo
  (churned partner) eventually makes it a solo unit, which then lets the lone keeper revive
  alone — Bixi is never stuck waiting on a ghost. 🔴 (auto-revert timer not built yet.)

---

## 8. Leaving a pair / breakup (Area 9) 🔴 (mostly designed, `leave_pair` exists)

- `leave_pair(pair)` RPC exists (removes your membership; a `cleanup_empty_pair` trigger tidies
  an emptied pair). The **You tab** UX around it is not fully built.
- **Design:**
  - **24h cooling-off with undo** + a consequence screen (Bixi stays with the remaining keeper
    as a solo unit; you start fresh; undoable for 24h).
  - **Immediate mute/block** toggle (safety carve-out) that stops partner notes/notifications
    instantly, independent of the 24h timer.
  - **Creator has no special custody** — whoever remains keeps Bixi + all history.
  - On revert to solo: **keep everything earned** (Full Bloom, companion stay). The live mood
    **ceiling drops back to 70** — *unless* graduated (§9).

---

## 9. Graduation — "I'm okay with only you" (the thesis) 🟢 (flag) / 🔴 (breakup UX)

- If a **paired** Bixi ever reaches a **100-day streak**, `apply_care` latches
  **`ever_reached_100 = true`**.
- From then on, the **full 100% ceiling is permanent even solo** (`ceilingFor` /
  `recompute_pair` / `apply_care` all honor `ever_reached_100`). 100 days together permanently
  secures Bixi.
- This state is **only reachable through the paired journey** — a pure solo keeper (ceiling 70)
  can never unlock the secret/dance/graduation. That's the intended emotional asymmetry.

---

## 10. Notifications (Area 6) 🟡

- Design: all 7 types (daily ready, streak at risk, partner's turn, bloom, dormant, milestone,
  mood reward). Core nudge = **activity-anchored** "Bixi misses you" fired at **~20h** since
  that keeper's last daily (per keeper, LDR-fair). Cap ≤ 2/day, quiet hours, per-type opt-out.
  Permission asked **after the first pet**.
- Built: `nudge_targets()` RPC selects keepers 20–24h since last daily (with a push token, not
  dormant) — the query the dispatcher needs. `push.ts` registers tokens. 🟡 The Edge
  Function + **cron dispatch** (`0005_cron.sql`) is a placeholder — pushes don't fire until it's wired.

---

## 11. Realtime sync between two phones 🟢 (now) 

- `subscribeToPair(pairId)` opens a channel on `bixi_state` + `pair_members` (filtered by pair);
  any change → the other phone re-hydrates the authoritative bundle.
- Both tables are now in the `supabase_realtime` publication with `replica identity full`
  (migration `0006`), and the client re-subscribes when `pairId` loads. So **phone B sees phone
  A's feed/water/pet/mood within ~1–2s.** Before this fix it only updated on reopen.
- Everyday actions are still **optimistic locally + hydrate after the RPC** on the acting phone.

---

## 12. Every scenario (the matrix)

**Solo keeper**

| Situation | What happens |
|---|---|
| Fresh hatch | mood 25, stage Egg, ceiling 70. No decay for first 24h. |
| Cares daily | +up to 3 mood/day; daily advances streak; climbs toward 70 in ~15 days. |
| Hits streak 7 / 30 / 60 | Sprout / Bud / **Bloom (solo max)**. |
| Reaches mood 70 | Capped. Cannot reach secret (80) or dance (90) solo. |
| Misses one daily (>24h) | **Streak → 0.** Growth stage kept. |
| Ignored 24–48h | Mood decays −5/day (once cron/recompute runs). |
| Ignored ≥ 48h | **Dormant.** Revive = pet, −30 mood, streak already 0. |
| Invites later & someone joins | Bloom: mood ≥ 50, ceiling → 100, becomes paired. |

**Paired keepers (A & B)**

| Situation | What happens |
|---|---|
| Just bloomed | mood ≥ 50, ceiling 100, two 24h streak clocks. |
| Both care daily | each +2/day (≈ +4 combined); pair-streak advances **only when both are current**. |
| Only A does the daily | streak does **not** advance (needs both); A's mood gain still lands. |
| A absent ≥ 24h (B active) | **Sad.** B's care lands. A's return costs **−10** one-time. |
| A absent, then returns | −10 sad-recovery, then normal gains; Sad clears. |
| **Both** absent ≥ 24h | **Dormant.** `revive_pending = [A,B]`. |
| Revive after both drifted | **both** must pet; last one triggers revive, **−30**, streak 0. |
| Revive after one drifted | the drifted keeper pets → revive (other sees it next open). |
| Either misses the daily window | **pair-streak → 0** (unforgiving). |
| Streak reaches 90 (paired) | **Full Bloom + companion** (permanent). |
| Streak reaches 100 (paired) | **Graduation** — 100 ceiling locked forever, even if solo later. |
| A leaves the pair | B keeps Bixi + history as solo; ceiling → 70 (unless graduated); A starts fresh (24h undo). |
| A deletes account | reverts B to solo; B's data never exposed. |
| One drifts forever after both dormant | auto-revert-to-solo eventually lets B revive alone (🔴 not built). |

**Invite / join edge cases**

| Situation | Result |
|---|---|
| Joiner already has a Bixi | `already_has_bixi` — must leave/delete theirs first. |
| Invite already claimed | `invite_used`. |
| Invite older than 7 days | `invite_expired`. |
| Pair already has 2 keepers | `pair_full`. |
| Creator regenerates invite | old unclaimed invite deleted; new `BIXI-XXXX` issued. |
| Joiner not signed in | `not authenticated` (surfaced on Join screen). |

---

## 13. Implementation status summary (updated 2026-07-20 — production pass)

🟢 **Built, deployed & E2E-verified against the live DB** (suite S00–S21, all passing,
self-cleaning — see below): onboarding spine, email/password auth + auto-confirm,
create/invite/claim (unique code per pair, single-use enforced on BOTH token and code paths),
`invite_preview` (real inviter name/Bixi/day on the Join confirm card), mood/streak/growth math
in `apply_care` (budgets, idempotency, both-current streak rule), sad −10 / dormant −30,
both-drifted reunion revive, **server-side decay/dormancy via pg_cron** (`bixi-recompute`
*/15 min + on-app-open recompute; decay made idempotent), unforgiving per-keeper daily streak
break, Full Bloom + companion @90, **graduation @100 (ceiling kept solo — verified)**,
"both here now" (+3, once/20h, presence-triggered), leave flow (request/undo 24h cooling-off,
immediate partner mute, cron-processed leaves, **ghost auto-revert** so a lone keeper can
always revive), membership-delete consistency trigger, push dispatch (notify Edge Function
deployed + secret-guarded + `bixi-notify` cron; nudge window 20–24h verified), account
deletion Edge Function (`delete-account`, cascade verified), invite-screen QR, creator bloom
reaction on next sight, realtime sync, RLS + grant hygiene (advisor warnings resolved or
intentional).

**E2E suite:** a single SQL transaction simulating 3 authenticated users through the entire
lifecycle — signup trigger → hatch (25/egg) → invite mint → preview → self-claim block →
claim-by-code (bloom 50, single-use) → reuse/full guards → budget caps → idempotency →
both-current streak → sad penalty → idempotent decay + dormant → reunion revive → both-here
→ 99→100 graduation → secrets → 24h leave + undo → graduated-solo-100 → ghost escape hatch →
nudge window → delete cascade. It ends with a deliberate abort so the live DB keeps ZERO
test residue. (It caught two real production bugs on the way: `create_invite` couldn't
resolve pgcrypto under its pinned search_path, and the code-path single-use regression.)

🟡 **Config-gated (needs your accounts, not code):** OAuth providers (Apple/Google dev
accounts), push tokens on devices (needs an EAS project id — server side is fully live),
"Confirm email" dashboard toggle (keep OFF until real SMTP).

🔴 **Deferred by platform (needs an EAS build + bixi.pet hosting):** tappable `bixi://` /
universal invite links and camera-scan QR routing (the QR already encodes the production
join URL, so it lights up the moment the domain + build ship). Expo Go cannot register
custom schemes — the typed BIXI-XXXX code is the working path until then.

---

## 14. Vitals engine v2 (2026-07-20 — supersedes the single-Mood model in §0–§6)

Owner decision: the Home is now backed by **real, separate vitals**. This replaces the
single mood-accrual engine; **streak, growth, graduation, invite/join/leave, realtime are
unchanged.** Deployed as migration `0009`, E2E-verified (SQL suite V01–V12 + REST smoke).

**The meters**
- **Feed** & **Water** — consumable, 0–100, on `bixi_state`. Tap refills **+45**; drain
  continuously (**Feed −40/day, Water −45/day**), idempotent. A per-keeper **8h cooldown** per
  vital (so two keepers keep him fuller — a real paired advantage).
- **Bond** — **per keeper** (0–100), on `pair_members`. Daily **+8**, pet **+3** (4h cooldown),
  decays **−3/day** while that keeper is drifted (>24h). Returning after 24h absence costs
  that keeper **−10 bond** (the "sad" dent). Bands: New <34 · Growing <67 · Strong ≥67.
- **Wellbeing** (the "Thriving" headline + Bixi's face) = **derived**, stored in
  `bixi_state.mood` = `round(0.30·feed + 0.30·water + 0.40·avg(bond))`, clamped to the
  ceiling (**70 solo / 100 paired-or-graduated**). Reward unlocks (secret 80 / dance 90) fire
  off wellbeing. Radiant **Thriving** needs paired + wellbeing ≥70 **+ a live streak**
  (consistency), per the owner's "how consistently that meter stays high."

**Start / bloom / revive vitals:** hatch feed=water=**60**, keeper bond=**20** (wellbeing ~44);
bloom bumps feed/water to **≥70**; revive returns him **starving** (feed=water=**25**).

**Sad / Dormant (owner spec):** Sad = paired, one keeper absent ≥24h. **Dormant = STARVED**
(feed & water both <15) **combined with** neglect — solo >48h, paired when a keeper is also
absent. Revive = the drifted keeper(s) pet (paired = both), and he wakes starving.

**Home screen (matches the mockup):** full-bleed hero (`home-hero.png`), header (greeting +
name + bell/calendar + **streak flame chip**), glass **Bixi status card** (Thriving pill +
last-cared + doubles as the daily-ritual / wake-him CTA), a 2×2 grid of **tap-to-act** cards
(**You**/**Your person** Bond, **Water**, **Feed** — tapping Water/Feed refills, tapping Bixi
pets), and a **Today's moments** strip from real care events. Solo shows an **Invite** card in
place of "Your person." Tabs kept (Home/Journal/Growth/You), restyled dark.

**Server constants live in `_bixi_const()`**; client mirrors them in `engine.ts` `VITALS` +
`WEIGHTS` so online and the offline demo agree.
