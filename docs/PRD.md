# Bixi — Product Requirements Document (PRD)

> **App name (working):** Sprout · **Character / hook:** Bixi
> **One line:** *One pet. Two of you. Keep Bixi alive, together.*
> **Version:** 0.2 (pre-build planning) · **Date:** 2026-07-18 · **Status:** Draft for approval
> **Owner:** Saud (WaleedZubedi) · **Platforms:** iOS + Android (React Native / Expo)

This document is the single source of truth for Bixi before a line of app code is written. It is intentionally exhaustive: naming, art, mechanics, screens, data model, backend, monetization, notifications, privacy, roadmap, and risks. If it isn't decided here, it's flagged in **§25 Open Decisions**.

> **Changelog — v0.2 (2026-07-18):** Bixi can now be **raised solo or as a pair**, chosen at onboarding. Solo is fully supported but Bixi *blooms brightest with two* — full spark, the final growth stages, and some cosmetics unlock when a co-parent joins. A shareable **co-parent invite link is available anytime** (onboarding, Home, Settings); accepting it **upgrades the existing Bixi in place**, preserving all history/streak/progress. Affected: §0-D1, §1, §7, §8, §9, §11, §12, §13, §17, §20, §22, §23.

---

## 0. Four foundational decisions (locked, overridable)

These four forks were chosen as defaults. Everything downstream assumes them. Change any one and tell me which — the affected sections are cross-referenced.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | **Who raises Bixi** | **Solo _or_ a pair (max 2), chosen at onboarding.** Solo is fully supported; Bixi **blooms brightest with two** (full spark, final growth stages, some cosmetics unlock on co-parent join). Max 2 keepers for MVP; DB modeled so 3+ groups can come later. | Lower signup friction + no dead-end if a partner won't join, while preserving the "better with two" hook as an *aspiration*, not a wall. Co-parent link is available anytime and upgrades the existing Bixi in place. |
| D2 | **Monetization** | **Free at launch**, monetize later (cosmetics + optional premium tier via RevenueCat). | Grow the paired-network and prove retention before charging. Two-person virality dies behind a paywall. |
| D3 | **Stakes on a broken streak** | **Gentle & always recoverable** — Bixi wilts, dims, and speaks his loneliness but never permanently dies. A slow persistent **Bond** level makes consistency still matter. | Sustainable for real relationships; guilt-light. Optional "hardcore mode" (Bixi can die) is a later toggle, not the default. |
| D4 | **Character animation** | **Rive** (state-machine vector). | Many moods/reactions from one file, tiny size, first-class React Native support, blends states fluidly. |

---

## 1. TL;DR / Executive summary

Bixi is a **virtual pet you can raise on your own or, better, with one other person**. A couple (or any two-person relationship — best friends, long-distance partners, siblings, a parent and child) adopt one creature named **Bixi** and keep him alive *together*. You choose at onboarding: raise Bixi **solo**, or **invite your person** to co-parent. Solo Bixi is happy and fully playable — but he **blooms brightest with two**: his full spark, later growth stages, and some cosmetics only light up once a co-parent joins. When two are raising him, Bixi thrives when **both** keep showing up: feeding, watering, petting, being present. If one drifts — misses a day, breaks the streak — Bixi visibly wilts, dims, and tells you he misses his other parent. He can always be revived, together.

The emotional core is **mutual accountability made adorable**: a tiny living thing whose wellbeing is a shared, visible barometer of "are we both still showing up for each other?" It turns "we should stay in touch" into a daily, delightful, low-effort ritual with a face.

The brand world is a **Victorian naturalist's field journal**: Bixi is *Specimen Nº01, "Cubus sproutii,"* a mint-teal cube creature with a leaf sprout, kept on warm paper and logged in field notes. This voice is already established on the landing page and is a real differentiator versus generic cute-pet apps.

**MVP goal:** a person can start Bixi solo *or* pair up, care for him daily, watch his mood respond (to their care, and — when paired — to both keepers' combined presence), send a co-parent invite link at any time that upgrades their existing Bixi in place, get nudged when the streak is at risk, and revive Bixi. Everything else is later.

---

## 2. Vision, positioning & "why now"

### 2.1 The problem
Modern relationships — especially long-distance, busy couples, and drifting friendships — lack a **lightweight, shared, daily ritual** that both people feel accountable to. Texting is unstructured; "good morning" streaks are shallow; calendar reminders feel like chores. There's no shared object that *visibly reacts* to both people's consistency.

### 2.2 The insight
People will do for a cute dependent creature what they won't do for an abstract goal. Tamagotchi proved solo guilt-driven care works. **The unlock is making the creature depend on _two_ people at once** — so caring for Bixi is caring for the relationship, and neglect is legible to both parties without anyone having to nag.

### 2.3 Positioning statement
> For **two people who want to stay close** (you can also start on your own), Bixi is a **shared virtual pet** that **blooms brightest when both of you keep showing up** — turning staying-in-touch into a daily ritual you can both see. Unlike solo pet games (Finch, Tamagotchi) or couple-chat apps (Paired, Cupla), Bixi's wellbeing *is* the shared signal, and his full spark takes two.

### 2.4 Why now
- Cross-platform (Expo + Rive) makes a polished reactive pet cheap to ship to both stores.
- Loneliness / long-distance is a large, durable market; "digital ritual" products (BeReal, Locket, Finch) have proven appetite.
- The brand and a validated landing page already exist — de-risked identity.

### 2.5 Non-goals (what Bixi is *not*)
- Not a messenger / chat app (no open-ended text; interactions are structured).
- Not a social network (no feeds, no strangers, no public profiles).
- Not a hardcore game with grinding, combat, or leaderboards.
- Not a productivity/habit tracker aimed at solo self-improvement.
- Not a dating app.

---

## 3. Naming & brand architecture

### 3.1 Current structure
- **Sprout** — the app / brand / "publisher" (the field-journal house that catalogs specimens).
- **Bixi** — the star character, *Specimen Nº01 (Cubus sproutii)*. The emotional hook and what users will name-search.

### 3.2 Recommendation & a real risk to resolve
"Sprout" is charming and on-brand, but **"Sprout" is heavily used** (Sprout Social, Sprout period/pregnancy trackers, plant apps) — a trademark and App-Store-search liability. "Bixi" is distinctive, ownable, and is what people will actually remember and search.

**Recommended App Store title:** **`Bixi: Grow a Pet Together`** (or `Bixi — a pet for two`).
- Keep **Sprout** as the in-app world/lore name and possibly the developer/publisher name.
- Lead with **Bixi** everywhere users search and share.

> **Open decision (§25-A):** confirm the public app name is "Bixi" with "Sprout" as the world, and run a trademark + App Store / Play Store name-availability check + domain check (bixi.app, getbixi.com, etc.) before finalizing. *Note: "BIXI" is also a Montreal bike-share brand — different category, but worth a quick trademark-class check.*

### 3.3 Taglines (approved voice)
- Primary: **"One pet. Two of you."**
- Support: "Keep Bixi alive, together." · "It takes two." · "A specimen you keep alive together." · "He blooms when you both show up."

### 3.4 Brand voice
A **warm, wry Victorian naturalist** cataloging a living specimen — precise, tender, a little theatrical. Field-note diction ("Specimen," "Fig. 01," "Est. MMXXVI," "Day 001"). Never cutesy-baby-talk; the cuteness comes from Bixi himself, the *frame* stays composed and literary. Bixi's own dialogue is simple, first-person, and emotionally direct ("I miss my other parent…").

---

## 4. Visual & art direction (already established)

Locked from the existing landing page — the app must match so brand feels continuous from web → store → app.

### 4.1 Palette
| Token | Hex | Use |
|-------|-----|-----|
| Paper | `#faf7f1` | App background |
| Tint | `#f1ebdf` | Secondary surfaces |
| Card | `#ffffff` | Raised cards |
| Ink | `#1e1913` | Primary text, hard shadows |
| Body | `#4a4335` | Body text |
| Muted | `#696055` | Captions, meta |
| Rule | `#e3dbcb` | Hairlines, borders |
| **Clay** | `#c8502e` / press `#a93f22` | Primary action / accent |
| **Pine** | `#1f7a54` | "Thriving" / positive |
| Amber | `#8f6218` | "Drifting" / caution |
| Brick | `#a83b2a` | Errors |
| Sage | `#dfede4` | Soft positive fills |
| Bixi mint | `#6fe0c6` | Bixi's body |

### 4.2 Type
- **Fraunces** (serif, optical) — headlines, Bixi's spoken lines, specimen labels.
- **Hanken Grotesk** (sans) — UI, buttons, body.
- **IBM Plex Mono** — eyebrows, meta, "field-note" labels, stats.

### 4.3 Motifs
Warm paper grain · specimen "plate" frame (dark inset with a cream inner rule) · hard offset shadows (`4px 4px 0` ink) on interactive cards · dashed "coupon/intake" edges · leaf glyph `❦` · botanical/field-journal captions.

### 4.4 Bixi's design
A rounded mint-teal **cube** (two stacked rounded rectangles, body + base), two black dot eyes, a soft smile, and a single **leaf sprout** with a small bud on top (his "spark" indicator). The sprout perks/wilts with mood. See **§16** for the full art bible and animation states.

---

## 5. Audience & personas

**Primary:** two-person relationships that want a shared daily ritual.

| Persona | Who | Core motivation | Why Bixi |
|---------|-----|-----------------|----------|
| **Maya & Jordan — Long-distance couple** | 22–30, different cities/timezones | "I want to feel him thinking of me daily without nagging." | Bixi's mood is proof they both showed up. Async-friendly. |
| **Sam & Alex — Busy live-in couple** | 25–35 | "We coexist but drift; want a tiny shared thing." | 20-second daily ritual, a shared object that's *ours*. |
| **Best friends apart** | 18–28 | "We swore we'd stay close after moving." | Two-person accountability without romance framing. |
| **Parent ↔ young-adult child / siblings** | mixed | "A gentle daily 'I'm here.'" | Low-pressure, wholesome check-in. |

**Secondary (later):** friend groups / families (D1 group phase), teens (needs age-gating review, see §21).

**Anti-persona:** hardcore gamers seeking depth; people wanting an open social network; anyone under the app's minimum age (see privacy).

---

## 6. Competitive landscape

| Product | What it is | What Bixi does differently |
|---------|-----------|----------------------------|
| **Finch** | Solo self-care pet | Bixi is inherently *two-player*; wellbeing is a shared signal, not personal. |
| **Tamagotchi (Uni/app)** | Solo pet, can die | Shared care + gentle (no permadeath by default); relationship framing. |
| **Paired / Cupla / Lovewick** | Couple prompts, shared calendar/chat | Bixi is a *character with stakes*, not a Q&A/organizer; emotional not utilitarian. |
| **Locket / BeReal** | Shared photo widgets/feed | Bixi needs *sustained mutual action*, not a one-tap post; it's a pet, not a feed. |
| **Between** | Couple private space | Bixi centers a living dependent, not a shared inbox. |
| **Neko Atsume / Pou** | Idle cute pets | Bixi's whole hook is the *second person* and drift consequences. |

**Defensible wedge:** the two-person dependency + the literary specimen brand. Neither is easy to copy convincingly.

---

## 7. Core concept & world lore

Bixi is *Specimen Nº01, Cubus sproutii* — a small living cube-plant creature catalogued by the **Sprout** field society, which has found that a Bixi *can* be tended by a single keeper, but only **truly blooms under two** ("parents"/"tenders") whose combined presence brightens his **spark** (the glow in his leaf-bud). The app is your field station: a plate where Bixi lives, a journal of your days, and the instruments (water, food, touch) that keep him alive.

- **Hatching:** every Bixi hatches from a seed/egg **when you first start caring for him** — solo or paired. A solo Bixi is alive and content from day one; he simply hasn't reached his full bloom yet.
- **The spark (solo):** one keeper can keep Bixi happy and healthy, but his leaf-bud tops out at a warm, steady glow — with a visible, gentle hint that "there's a brighter bloom in him, with two."
- **The bloom (co-parent joins):** the moment a second keeper accepts the invite, Bixi recognizes them in a special **bloom** sequence — his full spark, the final growth stages, and extra cosmetics open up. This is the pairing aha-moment (parallel to what "hatch" was in earlier drafts).
- **The spark (paired):** Bixi's bud glows brightest when both keepers are present and consistent; it dims as they drift.
- **Revival:** he can always be brought back — by you, or (when paired) together. Coming back together is a designed emotional peak (the "revive" moment).

---

## 8. The core loop

### 8.1 Daily loop (per keeper)
1. **Nudge** → push notification ("Bixi's leaf is drooping — he's waiting on you two").
2. **Open** → see Bixi's current mood + whether your partner has shown up today.
3. **Care** → do at least one care action (water / feed / pet). Optionally leave a tiny note.
4. **See presence** → know if partner already came, or that Bixi's now waiting on them.
5. **Streak/Spark updates** → satisfying feedback; leave.

Target session: **20–40 seconds.** Frequency: **1–2×/day.**

### 8.2 What counts as "showing up"
A keeper **"shows up" for a day** = opens the app and performs **≥1 care action** within that day. (Just opening isn't enough — must interact.)

- **Day definition:** each keeper's own **local calendar day** (their timezone). This is the fairest model for long-distance across timezones.
- **Care-day complete — the unit adapts to how many keepers there are:**
  - **Solo:** the day completes when **that one keeper** shows up. Streak = consecutive solo care-days.
  - **Paired:** the day completes only when **both** keepers show up on the same shared day. The shared "Bixi day" rolls over at the *later* of the two local midnights, with a generous window so nobody is punished for a timezone gap. Streak = consecutive pair-days.
  - When a solo Bixi gains a co-parent, the streak **carries over** and simply switches to the "both must show up" rule going forward (never resets to zero on pairing).
- **Grace / streak-freeze:** a keeper/pair banks a small number of **grace tokens** (e.g. 1 earned per 7-day streak, cap 2). A single missed day auto-spends a token instead of resetting the streak (Duolingo-style, guilt-light). Tokens are visible so it feels earned, not free.

### 8.3 Long-term loop
Sustained care raises **Bond** (slow, persistent, mostly monotonic) and advances Bixi's **growth stage**, unlocking cosmetics, journal milestones, and new expressions — the reason to keep going for months, not days. **Solo Bond climbs to a soft cap** (Bixi reaches, say, the mid growth stages and a steady glow); the **top of the Bond track and the final "full bloom" stages open only once a co-parent joins** — the concrete, visible payoff of the "better with two" promise.

---

## 9. Mechanics & systems (the "game")

### 9.1 Two meters — the heart of the design

| Meter | Timescale | Behavior | Meaning |
|-------|-----------|----------|---------|
| **Spark** (0–100) | Short-term (hours→days), **volatile** | Rises when a keeper cares; decays when care lapses. **Solo:** driven by the one keeper's care, but **caps below the top** (Bixi glows warm, not radiant). **Paired:** holds *full/radiant* only when both are current; decays faster if both lapse. | "How are we doing *right now*?" Drives Bixi's live mood + art. |
| **Bond** (level 1→N) | Long-term (weeks→months), **slow & sticky** | Gains from completed care-days & streaks; large absences chip it slowly but it never zeroes. **Solo caps at a soft mid-ceiling; the top track + final bloom stages unlock on co-parent join.** | "How deep is this, over time?" Drives growth stage + cosmetics unlocks. |

This split delivers all three chosen values: **gentle & recoverable** (Spark bounces back instantly), **consistency matters** (Bond is earned slowly and remembered), and **better with two** (the Spark ceiling + Bond top are reserved for pairs).

### 9.2 Mood / state machine (drives Rive)
Derived primarily from **Spark** + who's present. Some states are pair-only:

| State | Trigger | Bixi |
|-------|---------|------|
| **Thriving** (paired only) | Spark radiant, both current | Brightest bud, bouncy, playful; can be petted. The full-bloom look. |
| **Content** | Spark good — solo keeper current, or paired & both present-but-not-peak | Calm, warm, gentle idle. **This is a solo Bixi's normal happy ceiling.** |
| **Drifting** | A keeper lapsing (~1 day). *Solo:* "I miss you…". *Paired:* "I miss my other parent…". | Slight droop, dimmer bud. |
| **Wilting** | Keeper(s) gone longer / Spark low | Visibly wilted, muted colors, refuses play ("annoyed" lines). |
| **Dormant** | Fully neglected / Spark ~0 | Curled, dim, asleep. Revivable. |
| **Reviving** | Keeper(s) return after Dormant/Wilting | Springs-back-to-life sequence (emotional peak; a bigger version when a pair reunites). |
| **Blooming** (transition) | A co-parent accepts the invite | One-time full-bloom sequence that unlocks the paired ceiling. |

Reaction one-shots (overlay any state): **Petted, Fed, Watered, Happy-bounce, Both-here-now** (pair-only), **Bloom** (co-parent join).

### 9.3 Care actions (MVP verbs)
- **Water** 💧 — refresh; leaf perks.
- **Feed** 🍽️ — nourish; happy chomp.
- **Pet / Boop** 👆 — affection; only fully accepted when he's not too sad (matches the landing's "he's too sad to be petted" behavior).
- **Revive** ↺ — appears when Dormant; requires the returning keeper(s) — the reunion beat.
- (Later) **Play** mini-moments, **gift** cosmetics.

Rules (**paired mode only**): care is muted / gently refused if the *other* keeper has been absent past a threshold ("he won't eat while she's away") — the mechanic that makes one person's absence *felt* by the present one, motivating a nudge. Keep it gentle, not punishing. **In solo mode there is no absent "other," so care is never refused** — a solo keeper's actions always land (Bixi just can't exceed the solo ceiling).

### 9.4 Presence & togetherness
- **Async by default** (LDR-critical): each keeper cares on their own time; state syncs.
- **Live bonus:** if both are in-app within a short window ("both here now"), trigger a special shared animation + a small Spark/Bond bonus + optional haptic "heartbeat." A designed magic moment, not required.
- **Shared journal:** each care action can auto-log a field-note entry; keepers can add a one-line note or pick a stamp/sticker for each other (structured, not open chat — keeps it safe & simple).

### 9.5 Growth stages (long-term goal)
Bixi visibly grows with sustained Bond: **Seed → Sprout → Bloom → …** (3–5 stages for MVP, more later). Each stage = new silhouette details, a milestone journal page, and a cosmetic unlock. Growth is **slow and mostly one-way** so months of care produce a visibly "older together" Bixi — the retention engine. **A solo Bixi can grow into the mid stages; the final "full bloom" stage(s) are reserved for pairs** and open with the co-parent bloom sequence (§9.2).

### 9.6 Anti-cheese / fairness guardrails
- **In paired mode, one keeper can't "carry" the day — both must act** for a pair-day to complete. (In solo mode the one keeper's action completes the day, by definition.)
- No stockpiling infinite care in one burst — daily requirement is presence, not volume.
- Grace tokens are capped and earned.
- Timezone edge cases resolved by local-day model + generous rollover window (§8.2).
- Solo → paired transition preserves streak/Bond (§8.2); pairing is always an upgrade, never a reset.

---

## 10. Emotional design & tone

**Design principle: guilt-light, love-forward.** Bixi expresses *longing*, never *blame*. He says "I miss my other parent," not "you failed me." Absence is surfaced to the *present* partner as an invitation to reach out, never as a scold. Reunions are celebrated disproportionately (the revive beat) so the emotional memory skews positive.

- **Copy tone:** tender, first-person for Bixi; wry-naturalist for the UI frame.
- **No dark patterns:** no manipulative loss-aversion timers, no "your partner will be sad" shaming, no purchasable guilt relief.
- **Break-glass empathy:** if a pair goes fully dormant for a long time, soften messaging ("Bixi's resting. He'll be here when you're both ready.") rather than escalate pressure.

---

## 11. Feature scope — MoSCoW

### MVP — Must have (v1.0)
- Auth (Apple, Google, email OTP) + account.
- **Onboarding mode choice:** "Raise Bixi together, or on your own?" — solo starts immediately; "together" generates the invite link. Either way, teaches the "better with two" hook.
- **Solo mode:** create + raise Bixi alone (hatches on creation), with a persistent, non-pushy "invite your person" affordance and the solo Spark/Bond ceilings.
- **Co-parent invite (anytime):** generate a share link + short code from onboarding, Home, or Settings; recipient joins → **bloom** sequence → Bixi **upgraded in place** (streak/Bond/history preserved), switches to paired rules.
- **Home / room:** Bixi rendered in Rive, reacting to mood in real time; shows an "invite co-parent" chip while solo, a presence strip while paired.
- **Care actions:** Water, Feed, Pet, Revive.
- **Spark + mood state machine**; **Bond + streak** with grace tokens; solo vs paired ceilings.
- **Presence sync** between the two keepers when paired (async).
- **Shared journal:** auto field-notes per care + one-line note/stamp (notes are pair-only).
- **Push notifications:** care/streak-risk nudge, "your co-parent is waiting" (paired), "your person joined — Bixi bloomed!", revive prompt.
- **Settings:** notifications, timezone display, invite/leave co-parent, account deletion.
- Analytics + crash reporting.

### Should have (fast-follow v1.1–1.2)
- Growth stages (Seed→Bloom) + milestone journal pages.
- "Both here now" live moment + haptic heartbeat.
- Basic cosmetics (2–3 room/skin options, all free at first).
- Widget (iOS/Android home-screen Bixi mood widget) — strong retention lever.
- Anniversary / "Day 100" celebrations.

### Could have (later)
- Cosmetic store + RevenueCat monetization (D2 phase 2).
- Groups (3+ keepers) — D1 phase 2.
- Multiple Bixis / specimen archive.
- Apple Watch complication; Live Activities.
- Mini-games; seasonal events.
- Optional "hardcore mode" (Bixi can die).

### Won't have (v1)
- Open text chat, social feed, friends-of-friends, public profiles, in-app purchases at launch, Android/iOS-only exclusives.

---

## 12. Information architecture & screens

```
Launch
 ├─ Onboarding (first run only)  ── teaches "solo is fine, better with two"
 ├─ Auth (Apple / Google / Email OTP)
 └─ Start gate  ── "Raise Bixi together, or on your own?"
      ├─ On my own   → name Bixi → hatch → Home (solo)   [invite link still offered]
      ├─ With someone → name Bixi → Invite screen (code + share link) → Home (solo until they join)
      └─ Join a Bixi  → enter code / open deep link → confirm whose Bixi → Bloom sequence → Home (paired)
Main app (tab-less, single-home-centric)
 ├─ HOME / ROOM  (default)   ── Bixi (Rive) + mood + care actions
 │     ├─ (solo)   "＋ Invite your co-parent" chip
 │     ├─ (paired) presence strip ("You ✓ today · [Partner] waiting")
 │     ├─ Care action sheet (water/feed/pet) + leave-a-note (pair-only)
 │     └─ Revive flow (when dormant)
 ├─ JOURNAL  (field notes / days / milestones / streak calendar)
 ├─ BIXI / SPECIMEN CARD  (stats: Spark, Bond, growth stage, Day count, cosmetics)
 └─ SETTINGS  (profile, co-parent/invite, notifications, timezone, privacy, leave/delete)
```

### 12.1 Screen specs (MVP)

**Onboarding (3 cards, skippable after auth):** ①"This is Bixi — a little specimen you keep alive." ②"Raise him on your own… or with your person. He *blooms brightest with two*." ③"Show up, and he thrives. Drift, and he wilts — but you can always bring him back." CTA → Auth.

**Auth:** Sign in with Apple (required on iOS), Google, email magic-link/OTP. Minimal fields. No password stored by us.

**Start gate:** "Raise Bixi **together**, or **on your own**?" Two clear buttons. Under "on your own," a soft line: *"You can invite your person anytime — Bixi blooms brightest with two."* No hard sell.

**Create — solo:** name your Bixi (optional; default "Bixi") → Bixi **hatches** and lands you on Home. An "＋ Invite your co-parent" chip is present but never nags.

**Create — with someone:** name your Bixi, optionally pick who your person is to you (couple / friend / family — cosmetic + copy only), generate **invite code + share link** to send. Bixi still **hatches now** and you begin caring solo; when they join, he **blooms**. (No dead "waiting egg" — Bixi is alive from the start either way.)

**Join (co-parent):** open invite link (deep link) or type code → confirm you're joining X's Bixi → **bloom animation** (the emotional payoff; Bixi recognizes his second keeper) → land on Home (paired), all of X's history intact.

**Home / Room:** center stage = Bixi (Rive) on his plate; top = specimen caption (Fig.01, Day NNN, state); **solo:** an "＋ Invite your co-parent" chip; **paired:** a **presence strip** ("You ✓ today · [Partner] waiting"); bottom = **Water / Feed** primary actions, tap-Bixi to pet; **Spark** meter (shows the solo ceiling with a faint "bloom with two" marker); Revive button when dormant; entry point to leave a note (paired).

**Care sheet:** confirm action, play reaction, optional one-line note + stamp for partner (paired), haptic.

**Journal:** reverse-chronological field notes (each care/day), a **streak calendar** heatmap, milestone pages (hatch, bloom/co-parent-join, Day 7/30/100, growth stages).

**Specimen card:** Bixi portrait, Spark, Bond level + progress, growth stage, total days, grace tokens, keeper(s), cosmetics owned/equipped (later). Solo view shows the locked "bloom with two" tier.

**Settings:** account, **co-parent status + invite / leave** (with clear consequences — leaving reverts Bixi to solo, §22), **notification preferences** (types + quiet hours), timezone display, privacy/data export + **account & data deletion**, about/credits, restore purchases (later).

---

## 13. Onboarding & pairing flow (detail)

- **Solo start:** picking "on your own" creates the Bixi and hatches him immediately — no second person required. The invite affordance stays available forever (Home chip + Settings), so solo is a first-class path *and* a frictionless on-ramp to pairing.
- **Invite mechanics:** short human code (e.g. `BIXI-7K3Q`) **and** a Universal Link / App Link (`https://bixi.app/join/<token>`). One active invite token per Bixi at a time; expiring, revocable/regenerable, single-use (consumed when the co-parent joins).
- **Deep linking:** Expo Router + Universal Links (iOS) / App Links (Android). If the app isn't installed, link → store, then resolve the pending invite post-install (deferred deep link via a claim token stored server-side).
- **Co-parent join = "bloom," and it upgrades in place:** when the second account accepts, we **attach them to the existing Bixi** — never create a new one. All history, streak, Bond, growth, and journal carry over; rules switch to paired; play the one-time **bloom** sequence. This is the pairing aha-moment.
- **Guardrails:** a Bixi holds **max 2 keepers** (MVP). Joining requires confirming *whose* Bixi it is. The inviter can revoke/regenerate a code. A person can't join a Bixi that's already paired.
- **Leaving / co-parent swap:** if a keeper leaves, Bixi **reverts cleanly to solo** for whoever remains (not a broken "waiting" state); the remaining keeper can invite a new co-parent later. Bond handling on re-pair: **adopt-over** (kept, slightly softened) rather than reset — see §22. Deliberate friction on leaving to protect emotional integrity.

---

## 14. Notifications strategy

Push is the retention engine. Keep it kind and useful, never spammy.

| Trigger | Audience | Example copy | Notes |
|---------|----------|--------------|-------|
| Co-parent joined / Bixi bloomed | Inviter | "Your person joined — Bixi just bloomed! 🌸" | High-priority, immediate. The pairing payoff. |
| Daily reminder (personalized time) | Any keeper who hasn't shown up (solo or paired) | "Bixi's leaf is drooping — he's waiting on you." | Sent around each keeper's usual active time; respects quiet hours. |
| Partner cared / streak alive (paired) | Other keeper | "[Partner] just watered Bixi. Your turn to keep the streak. 🔥" | Only if that keeper hasn't acted today. |
| Streak at risk | Both (staggered) | "2 hours left to keep your 14-day streak alive." | Uses grace-token awareness; never fires if a token will auto-cover. |
| Went dormant | Both | "Bixi's resting. Come back together when you're ready. 💚" | Soft, no pressure. |
| Milestone | Both | "Day 100 together. Bixi's never looked better." | Celebrate. |

- **Infra:** Expo Push Notifications; scheduling via **Supabase `pg_cron` + Edge Function** that computes who needs nudging and dispatches. Per-user send-time personalization (based on historic active hour), quiet-hours, and a hard daily cap (≤2 nudges/day/keeper).
- **Controls:** granular opt-outs per type in Settings; comply with OS-level permission best practice (ask *after* the value is shown, not on first launch).

---

## 15. Technical architecture

### 15.1 Stack
| Layer | Choice | Notes |
|-------|--------|------|
| App | **React Native via Expo (managed)** | One codebase, iOS+Android. EAS Build/Submit/Update (OTA). |
| Language | **TypeScript** (strict) | |
| Navigation | **Expo Router** | File-based; handles deep links/Universal Links well. |
| Animation | **Rive** (`rive-react-native`) + Reanimated for UI | Bixi = one Rive file, state-machine driven (see §16). |
| Client state | **Zustand** | Local/UI + optimistic care actions. |
| Server state | **TanStack Query** | Fetch/cache/sync Supabase data. |
| Backend | **Supabase** (existing project `ihqhofeubfqphzegiapl`) | Postgres, Auth, Realtime, Edge Functions, Storage, `pg_cron`. |
| Auth | **Supabase Auth** | Apple, Google, email OTP. |
| Realtime | **Supabase Realtime** | Live presence + state sync between the two keepers. |
| Payments | **RevenueCat** (MCP already wired) | Phase-2 cosmetics/premium. |
| Push | **Expo Notifications** + Supabase cron/Edge dispatch | See §14. |
| Product analytics | **PostHog** | Funnels, retention, events (§17). |
| Crash/error | **Sentry** | RN + Edge Functions. |
| Web/landing | **Vercel** (existing) | Landing + `/join` deep-link resolver + marketing. |

### 15.2 Sync & offline
- Care actions are **optimistic** locally, queued, and reconciled server-side (server is source of truth for Spark/Bond/streak to prevent clock-tampering).
- **Spark/Bond/streak are computed server-side** on a schedule + on write (never trust device clock for streak integrity).
- Offline: last-known state cached; actions queue and flush on reconnect (idempotent via client-generated action IDs).

### 15.3 Security
- **Row-Level Security** on every table (pattern already used for `waitlist`/`download_clicks`): a keeper can only read/write rows for a pair they belong to.
- Publishable/anon key in client; service-role only in Edge Functions.
- Invite tokens are opaque, expiring, server-validated.

### 15.4 Repo shape (proposed)
Keep the RN app separate from the existing web landing to avoid a mess:
```
/app            ← Expo React Native app (new)
/landing        ← existing index.html/app.html/videos  (move here)
/supabase       ← SQL migrations, Edge Functions (extend existing)
/docs           ← this PRD + specs
```
> **Open decision (§25-B):** monorepo (move landing into `/landing`) vs. a new dedicated repo for the app. Recommend **monorepo** so brand/assets/SQL stay in one place.

---

## 16. Art bible & Rive animation spec

### 16.1 Bixi construction
Rounded mint (`#6fe0c6`) stacked-cube body + base, two black dot eyes, soft mouth, one leaf sprout + bud on top. Bud brightness = **spark indicator**. Soft contact shadow. Lives on a dark "specimen plate" with a cream inner rule, on paper.

### 16.2 Rive state machine — **`BixiMachine`**
**Inputs (driven by app):**
- `spark` (number 0–100)
- `mood` (enum/number: 0 dormant · 1 wilting · 2 drifting · 3 content · 4 thriving)
- `isPaired` (bool) — gates the radiant/full-bloom look; when false, the `spark` blend and mood are clamped to the solo ceiling (Content, warm glow)
- `bothPresent` (bool) — paired only
- `growthStage` (number 0–4) — final stage(s) only reachable when `isPaired`
- Triggers: `fireWater`, `fireFeed`, `firePet`, `fireRevive`, `fireBothHere` (paired), `fireHatch` (creation), `fireBloom` (co-parent joins)

**Looping states:** Egg/Dormant, Wilting, Drifting, Content (solo happy ceiling), Thriving (paired-only radiant).
**One-shot overlays:** Water, Feed, Pet, Revive, Both-here (paired), Hatch, **Bloom** (co-parent join), Happy-bounce.
**Blends:** droop/perk of leaf and color saturation blend continuously along `spark`, with the top of the range unlocked only when `isPaired`.

### 16.3 Asset checklist (MVP)
- 1 Rive file with the state machine above (5 idles + 6 one-shots + leaf/color blend).
- App icon set (see §18).
- Onboarding illustrations (3).
- Journal stamps/stickers (6–10) for notes.
- Egg + **hatch** sequence (Bixi's day-one arrival, solo or paired).
- **Bloom** sequence (co-parent join) + the faint locked "bloom with two" marker on the Spark meter.
- Growth-stage silhouettes (Seed/Sprout/Bloom for v1.1).

> Existing `videos/*.mp4` (idle/drift/dormant/feed/water/revive/tap) are the **visual reference** for the Rive artist and can back a fallback if Rive slips. Rive is the target.

### 16.4 Sound & haptics
- Tiny, warm, optional SFX per action (water trickle, soft chomp, happy chirp, revive shimmer). Muted by default option; respect silent switch.
- Haptics: light tap on care; a double "heartbeat" on **both-here-now** and on revive. (Landing already uses `navigator.vibrate` patterns — mirror those feelings.)

---

## 17. Analytics, metrics & instrumentation

### 17.1 North Star
**Weekly Active Pairs (WAP)** — pairs where **both** keepers were active in the last 7 days. This stays the north star because paired is where the product's value and virality live. **Guardrail / on-ramp metric: Weekly Active Bixis** (solo + paired) so we don't optimize pairs at the expense of the solo funnel that feeds them.

### 17.2 Key metrics
- **Activation:** % of installs that create a Bixi and complete first care (solo counts). *First make-or-break.*
- **Solo → pair conversion:** % of solo Bixis that add a co-parent, and median time-to-pair. *Second make-or-break — the whole "better with two" bet.*
- **Invite → join conversion**; time from invite sent → bloom.
- **D1/D7/D30 retention**, split by **solo** vs **paired** (paired should retain far better — validates the thesis).
- Median **streak length**; % reaching a 7+ / 30+ streak (solo vs paired).
- **Revive rate** (dormant → revived) — resilience.
- Care actions per keeper per day.
- (Later) cosmetic conversion, ARPPU.

### 17.3 Event taxonomy (PostHog)
`onboarding_viewed`, `auth_completed`, `mode_chosen{solo|paired}`, `bixi_created`, `bixi_hatched`, `invite_sent`, `invite_opened`, `coparent_joined` (bloom), `care_action{type}`, `note_left`, `spark_changed`, `mood_changed{state}`, `streak_incremented`, `streak_grace_used`, `went_dormant`, `revived`, `growth_stage_up`, `reverted_to_solo`, `coparent_left`, `notification_received/opened{type}`, `settings_changed`, `purchase_*` (later).

---

## 18. App icon & store presence

### 18.1 Icon concept (recommended)
**Bixi's smiling face + leaf sprout, centered, on a warm clay→cream ground**, with a faint specimen-plate inner rule. Reads at 1024px and at 48px. Variant B: just the **leaf-bud "spark"** as a minimalist mark. Recommend the face for recognizability at launch.
- Deliver iOS 1024², Android adaptive (foreground Bixi + clay background layer), monochrome/tinted variant (iOS 18 / Android themed icons).

### 18.2 Store listing
- **Title:** `Bixi: Grow a Pet Together` (§3.2).
- **Subtitle:** "One pet. Two of you."
- **Screens (5–6):** hatch moment · thriving Bixi + both-present · wilting + "he misses your person" · streak/journal · revive reunion · widget.
- **Description** in the naturalist voice; keywords: shared pet, couples, long distance, friendship, virtual pet, together, streak.
- **Preview video:** 15–20s: hatch → thrive → one drifts, wilt → both return, revive.
- **Age rating:** target 4+/Everyone (no objectionable content); verify data-collection disclosures (§21).

---

## 19. Monetization plan (phased — D2)

- **Phase 1 (launch): free.** No IAP. Goal = activation + retention + WAP growth.
- **Phase 2 (post-retention proof): cosmetics.** RevenueCat-managed non-consumables/consumables: Bixi outfits/skins, room décor/wallpapers, journal stamp packs, "revive shimmer" effects, maybe grace-token packs (careful — must not become pay-to-skip-guilt; keep purely cosmetic/comfort).
- **Phase 3 (optional): "Sprout Society" premium** (subscription, one keeper can gift to the pair): full journal history/export, extra Bixis / specimen archive, exclusive seasonal cosmetics, widgets/complications. **Never gate the core two-person loop.**
- **Ethics guardrail:** monetize *delight and expression*, never *relief from guilt* or the ability to fake a partner's presence.

RevenueCat is already connected via MCP, so offerings/entitlements/paywalls can be configured when Phase 2 begins.

---

## 20. Data model (Supabase / Postgres)

All tables under `public`, **RLS on**, membership-scoped. Illustrative schema (final columns during build):

```sql
-- a person (mirrors auth.users)
profiles (
  id uuid primary key references auth.users,
  display_name text,
  avatar text,
  timezone text,               -- IANA tz, for local-day logic
  push_token text,
  active_hour smallint,        -- learned best nudge hour
  created_at timestamptz default now()
)

-- the keeping unit: 1 member = solo, 2 = paired (keeper_max lets us grow to groups later — D1)
pairs (                        -- name kept generic; a one-member row is a valid solo unit
  id uuid primary key default gen_random_uuid(),
  bixi_name text default 'Bixi',
  relationship_kind text,      -- couple|friends|family (cosmetic)
  keeper_max smallint default 2,
  created_at timestamptz default now(),
  hatched_at timestamptz,      -- set on creation — Bixi is alive from day one, solo or paired
  bloomed_at timestamptz       -- null until a co-parent joins (the pairing upgrade / "bloom")
)
-- "mode" is derived, not stored: solo if 1 active member, paired if 2 (count pair_members)

-- membership (one row = solo, two = paired)
pair_members (
  pair_id uuid references pairs,
  profile_id uuid references profiles,
  role text default 'keeper',
  joined_at timestamptz default now(),
  last_active_day date,        -- their local day of last care
  primary key (pair_id, profile_id)
)

-- invites
invites (
  token text primary key,      -- opaque, in link + short code
  pair_id uuid references pairs,
  created_by uuid references profiles,
  expires_at timestamptz,
  claimed_by uuid,             -- null until used
  created_at timestamptz default now()
)

-- Bixi live state (one per pair) — server-authoritative
bixi_state (
  pair_id uuid primary key references pairs,
  spark int default 100,       -- 0..100
  bond_level int default 1,
  bond_xp int default 0,
  growth_stage smallint default 0,
  mood smallint default 4,      -- computed
  streak_days int default 0,
  grace_tokens smallint default 0,
  last_pair_day_complete date,
  updated_at timestamptz default now()
)

-- every care action (audit + journal + streak source of truth)
care_events (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid references pairs,
  profile_id uuid references profiles,
  kind text,                   -- water|feed|pet|revive
  client_action_id text,       -- idempotency
  local_day date,              -- actor's local day
  note text,                   -- optional one-line
  stamp text,                  -- optional sticker
  created_at timestamptz default now()
)

-- milestones / journal highlights
milestones (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid references pairs,
  kind text,                   -- hatch|day7|day30|day100|growth|revive
  created_at timestamptz default now()
)
```

- **Existing tables** `waitlist` and `download_clicks` stay (landing).
- **Compute jobs:** `pg_cron` daily (per-tz windows) + on-write triggers recompute Spark decay, streak, grace, mood, Bond.
- **RLS pattern:** `exists (select 1 from pair_members m where m.pair_id = X and m.profile_id = auth.uid())`.

---

## 21. Privacy, safety, legal & compliance

- **Minimal PII:** email (auth) + optional display name + timezone + push token. No location, no contacts scraping.
- **Two-person data:** notes/stamps are visible only to the two keepers. No open text that could be abused; structured stamps + short notes reduce harassment surface. Provide **unpair/block** and reporting for the note field.
- **Account & data deletion:** in-app, honoring App Store / Play requirements + GDPR/CCPA. Deleting one keeper doesn't expose the other's data; deleting the pair removes shared state.
- **Data export:** journal/history export (Phase 3 premium ok, but basic deletion/export always free).
- **Minors:** decide minimum age (recommend **13+**, or 16+ to sidestep COPPA/GDPR-K entirely). If 13+, add age gate + parental considerations. *→ §25-C.*
- **Store disclosures:** complete Apple **Privacy Nutrition Labels** and Google **Data Safety** accurately (analytics = PostHog, crash = Sentry, payments later = RevenueCat).
- **Notifications:** OS permission requested contextually; easy full opt-out.
- **No dark patterns / no selling data.** Sub-processors (Supabase, Expo, PostHog, Sentry, RevenueCat) listed in a privacy policy on bixi.app.
- **Terms & Privacy Policy** live before launch; link in app + stores.

---

## 22. Edge cases & failure modes

| Case | Handling |
|------|----------|
| **Breakup / falling out** | Either keeper can **leave** from Settings with a clear consequence screen. Bixi **reverts to solo** for whoever remains (their history/Bond preserved, softened to the solo ceiling) — no archived limbo. The leaver can start a fresh Bixi. Never trap someone with a person they've cut off. Who keeps the Bixi if the *creator* leaves → §25-G. |
| **One keeper churns permanently** | After a long absence the pair **auto-reverts to solo** for the active keeper — Bixi stays happy at the solo ceiling, no "waiting on a ghost." The active keeper can invite a **new** co-parent anytime (**adopt-over**: Bond kept, slightly softened — not reset). |
| **Timezone gap (LDR)** | Local-day model + generous shared-day rollover (§8.2). Never punish a pair for living in different zones. |
| **Clock tampering** | Streak/Spark computed server-side; device clock untrusted. |
| **Invite abuse / wrong person joins** | Invites expire + are single-pair; creator can revoke/regenerate; joining requires confirmation of *who* they're pairing with. |
| **Reinstall / new device** | State is server-side; re-auth restores everything. |
| **Both dormant for months** | Soft "resting" messaging, reduced nudges, one-tap revive on return. No shaming. |
| **Notification fatigue** | Hard cap ≤2/day, quiet hours, per-type opt-out, personalized send time. |
| **Rive fails to load** | Fallback to a static Bixi + (optionally) the existing video clips; never a blank plate. |

---

## 23. Success criteria / launch bar

**MVP is "done" when a person can:**
1. Sign in and start Bixi **solo** — hatched and cared for from day one.
2. Send a **co-parent invite link anytime**; a second person joins → **bloom** → Bixi upgraded in place (history/streak/Bond preserved), rules switch to paired.
3. Care daily; see Spark/mood react (solo ceiling; radiant when paired & both present).
4. Build and (with grace) protect a streak; grow Bond over days.
5. Get timely, kind nudges; **revive** after dormancy.
6. Leave a co-parent (reverts to solo cleanly) + delete account/data cleanly.

**Early success signals (first 4–8 weeks post-launch):**
- **Activation ≥ 60%** of installs create a Bixi + complete first care (solo counts).
- **Solo → pair conversion ≥ 25%** within 14 days (the core "better with two" bet).
- **D7 retention:** solo ≥ 15%; **paired (both-active) ≥ 25%**, D30 paired ≥ 12% (tune vs. benchmarks). Paired should clearly beat solo.
- Median streak ≥ 5 days; ≥ 20% reach a 7-day streak.
- Qualitative: paired users describe Bixi as "ours" / emotionally meaningful.

---

## 24. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Second-keeper activation is the whole funnel** — many create, few pair | High | Critical | Obsess over invite/hatch UX; deferred deep links; dormant-egg intrigue; strong "hatch" payoff; nudge creators to invite. |
| Notifications feel naggy → guilt/uninstall | Med | High | Guilt-light copy, caps, quiet hours, personalized timing, "resting" soft mode. |
| Name/trademark conflict ("Sprout") | Med | Med | Lead with **Bixi**; run TM + store-availability checks (§3.2, §25-A). |
| Rive art production slips | Med | Med | Video-clip fallback exists; start Rive early; scope 5 idles + 6 one-shots for v1. |
| Churn when a relationship ends | Med | Med | Replace-keeper flow; multiple Bixis later; frame around *any* two-person bond, not only romance. |
| Low long-term depth → boredom | Med | Med | Growth stages, milestones, cosmetics, seasonal events on the roadmap. |
| Server-side streak logic complexity (tz, cron) | Med | Med | Nail the local-day model + tests early; server-authoritative from day one. |
| App Store rejection (privacy, sign-in) | Low | High | Sign in with Apple, accurate privacy labels, deletion flow — all in MVP. |

---

## 25. Open decisions (need your call, non-blocking to start)

- **§25-A — Public name:** confirm **"Bixi"** as the App Store name (Sprout = world/publisher), and I'll (a) draft the store metadata and (b) list trademark/domain checks to run. *Default I'm assuming: yes, lead with Bixi.*
- **§25-B — Repo layout:** monorepo (`/app`, `/landing`, `/supabase`, `/docs`) vs. separate app repo. *Default: monorepo.*
- **§25-C — Minimum age:** 13+ vs 16+ (COPPA/GDPR-K exposure). *Default: 13+ with age gate — confirm.*
- **§25-D — Relationship framing on the store:** lead romantic ("for couples") vs. broad ("for two people who want to stay close"). Solo is the on-ramp, not the headline. *Default: broad, with couples as the hero use case; solo mentioned as "start on your own."*
- **§25-E — "Both here now" live feature:** MVP or v1.1? *Default: v1.1 (nice-to-have).*
- **§25-F — Sound at launch:** ship SFX in v1 or add later? *Default: minimal SFX + haptics in v1.*
- **§25-G — Bixi custody when the *creator* leaves a pair:** does the Bixi (and its history) stay with the remaining co-parent, or does leaving require the creator to hand it off / archive? *Default: whoever remains keeps the Bixi as a solo unit; the leaver starts fresh. Confirm this feels fair.*
- **§25-H — Solo "bloom with two" visibility:** how overt should the locked paired tier be (a faint marker on the Spark meter + one onboarding line) vs. more prominent prompting? *Default: subtle — present but never naggy.*

---

## 26. Suggested build sequence (once PRD is approved)

Not a commitment, just the natural order — each phase is independently demoable.

1. **Phase 0 — Foundations:** Expo app scaffold (TS, Expo Router, Zustand, TanStack Query), Supabase schema + RLS migrations, auth (Apple/Google/OTP), Sentry + PostHog. *Outcome: sign in, empty home.*
2. **Phase 1 — Pairing & hatch:** create Bixi, invite (code + Universal/App Links + deferred deep link), join, hatch sequence. *Outcome: two devices → one shared Bixi.*
3. **Phase 2 — Care & mood:** Rive integration + `BixiMachine`, Water/Feed/Pet, Spark meter, mood states, optimistic actions + server reconcile. *Outcome: Bixi visibly reacts to both keepers.*
4. **Phase 3 — Streak, Bond, presence:** server-side streak/Spark/Bond compute (cron + triggers), grace tokens, presence strip, realtime sync. *Outcome: consistency matters, drift wilts, revive works.*
5. **Phase 4 — Journal & notifications:** field-note journal + streak calendar, Expo push + cron dispatch, settings (notif prefs, unpair, delete). *Outcome: retention loop closed.*
6. **Phase 5 — Polish & store:** onboarding, icon, store assets, privacy labels, TestFlight/Play internal test, fix, submit.
7. **Phase 6+ — Growth:** growth stages, widget, "both here now," cosmetics + RevenueCat (D2 phase 2), groups (D1 phase 2).

---

## Appendix A — Glossary
- **Keeper / parent / tender** — one of the (one or two) people raising Bixi.
- **Solo mode / Paired mode** — raising Bixi with one keeper vs two; the mode a Bixi is currently in (derived from member count).
- **Pair** — the keeping unit; **solo** (1 member) or **paired** (2). Extensible to groups later.
- **Spark** — Bixi's short-term, volatile wellbeing meter (0–100); drives live mood. Caps below full in solo; radiant only when paired.
- **Bond** — the keeper(s)' long-term, sticky level; drives growth/unlocks. Solo caps mid-track; top opens on co-parent join.
- **Care-day** — a completed care day; the streak unit. Solo: the one keeper showed up. Paired: both did (a "pair-day").
- **Grace token** — an earned streak-freeze that covers one missed day.
- **Growth stage** — Bixi's visible long-term maturation (Seed→Sprout→Bloom→…); final stage(s) paired-only.
- **Hatch** — Bixi first coming alive, on creation (solo or paired).
- **Bloom** — the one-time sequence when a co-parent joins an existing Bixi, unlocking the paired ceiling. The pairing aha-moment.
- **Revive** — bringing a dormant Bixi back (solo: by you; paired: together).

## Appendix B — Reused assets from the landing
- Palette, type, and specimen/field-journal voice — **carry into the app verbatim** (§4).
- `videos/*.mp4` — reference + fallback for Rive (§16.3).
- Supabase project `ihqhofeubfqphzegiapl` + RLS pattern — extend for app tables (§20).
- RevenueCat (MCP-connected) — for Phase-2 monetization (§19).
- Vercel landing — extend with `/join/<token>` deep-link resolver (§13).

---

*End of PRD v0.1. Change any of the four foundational decisions (§0) or open decisions (§25) and I'll revise the affected sections.*
