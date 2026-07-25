# Bixi — Detailed Decisions Log

Running record of the small, concrete product/design decisions made step by step,
on top of the PRD (`docs/PRD.md`). When a decision changes something in the PRD,
it's noted. Newest section at the bottom.

Status legend: ✅ decided · 🕓 pending · 💤 deferred to later version

---

## Area 1 — Onboarding & Pairing

### First-launch structure
- ✅ **Intro cards first, then auth.** A brand-new user sees 3 story cards
  (meet Bixi → better with two → show up/thrive) *before* being asked to sign in.
  Sells the hook at zero commitment.
- ✅ **Auth methods at launch: Sign in with Apple + Google only.**
  - Email OTP / magic link: **deferred** (PRD listed it as must-have; we dropped it
    for v1 to keep auth simple — addable later with no migration).
  - Phone/SMS: not doing.
  - Implication: a user with neither an Apple nor Google identity can't sign in at
    launch. Accepted tradeoff (covers ~all of iOS/Android).

### Intro cards (3, first-launch only)
- ✅ **Not skippable, first-launch only.** User swipes through all 3 on first run;
  never shown again (no Settings replay for v1).
- ✅ **CTA on last card: "meet bixi"** (lowercase styling) → goes to auth.
- ✅ **Content (proposed copy, refine later):**
  1. *Meet Bixi.* — "Specimen Nº01 — a small living thing you keep alive. He's yours to look after." (visual: idle Bixi on plate)
  2. *Raise him your way.* — "On your own, or with your person. Bixi's happy either way — but he blooms brightest with two." (visual: brighter/blooming Bixi)
  3. *Show up, and he thrives.* — "Drift, and he wilts. But you can always bring him back. It only takes a moment a day." (visual: perky vs drooping)
- Voice: Victorian-naturalist frame, tender.

### Start gate ("Raise Bixi together, or on your own?")
- ✅ **One primary + secondary layout, "With someone" first.**
  - Primary CTA: **With someone** (invite your person to co-parent).
  - Secondary: **On my own** (start now, invite anytime) — kept a proper button
    with warm, non-apologetic copy so solo still feels first-class, NOT a tiny link.
  - Quiet link below both: **"Have an invite code? Join a Bixi →"** (manual fallback).
  - Deep-link invitees SKIP this gate — tapping an invite link (post-auth) goes
    straight to the confirm-and-join screen.
- Note: this is a stronger nudge toward pairing than the PRD's "fully symmetric
  solo" framing (PRD §12 Start gate). Intentional — pairing is the hero path.
  Guardrail: solo copy stays guilt-light and inviting.

### Naming
- ✅ **Species + optional nickname.** "Bixi" is the species/character (brand + all
  marketing/system copy stays "Bixi"). The pair may optionally set a personal
  **nickname** shown on Home. Default = "Bixi" (no forced naming step friction).
- Data: nickname stored on `pairs.bixi_name` (already in schema); species copy hard-coded.

### Relationship kind
- ✅ **Ask on the "With someone" path only.** After choosing to pair: "Who's your
  person?" → couple / best friend / family. **Cosmetic + copy tone + analytics only.**
  Skippable. Not asked for solo (keeps low-friction path clean).
- Data: `pairs.relationship_kind` (already in schema).

### Screen order recap
- Solo:        auth → gate(On my own) → name(optional) → **hatch** → Home (solo)
- With someone: auth → gate(With someone) → relationship kind → name(optional) →
                **hatch** (meet him solo first) → **invite screen** → Home (solo, waiting)
- Join:        auth (via deep link or code) → confirm whose Bixi → **bloom** → Home (paired)

### Hatch
- ✅ **Interactive: tap/hold to hatch**, with haptics. It's the user's first act of
  care and teaches "touching Bixi makes things happen." (Not a passive cinematic.)
- ✅ **Metaphor: a classic egg** that cracks open (keeps prototype's "🐣 First hatch"
  memory; instantly legible as "a pet is born"). Leaf-sprout is Bixi's own feature.
  Mild brand note: plant-creature from an egg — accepted, egg wins on legibility.
- Fires Rive `fireHatch`. Happens on both solo and with-someone paths (meet him solo
  first, then invite).

### Invite mechanics
- ✅ **One opaque token → both a human code (`BIXI-7K3Q`) and a link
  (`https://bixi.app/join/<token>`).** One active invite per Bixi, single-use
  (consumed on join), regenerable (regenerating invalidates the old).
- ✅ **Expiry: 7 days**, regenerable anytime from Home chip / Settings.
- ✅ **QR code on the invite screen** (encodes the same join link) for in-person pairing.
- ✅ **Deferred deep-linking IS in v1:** link → App/Play Store if app absent →
  after install, app auto-resolves the pending invite and drops into join.
  Core to the solo→pair funnel. (Landing `/join/<token>` resolver + server claim token.)
- Invite screen reachable: after hatch (with-someone path), Home "invite" chip (solo),
  Settings (always).

### Join flow
- ✅ **Confirmation screen before committing:** shows creator's avatar + name, the
  Bixi's nickname, "caring since Day N", then "Join [name] & bloom Bixi" + a "Not you? ✕".
- ✅ **Edge case — already has a Bixi: BLOCK with explanation.** v1 = one Bixi per
  person. "You're already raising a Bixi. Leave or delete yours first to join Maya's."
  No surprise data loss. (Multiple-Bixi support is a later feature.)

### Bloom (co-parent join payoff)
- ✅ **Joiner sees the bloom live** (their immediate payoff). **Creator gets a push**
  ("Your person joined — Bixi bloomed! 🌸") **and sees the bloom sequence on next open.**
  Async-friendly / LDR-safe. Bloom queues server-side so it plays once for the creator.
- Fires Rive `fireBloom`; sets `pairs.bloomed_at`; unlocks paired ceiling (Spark/Bond).
- Upgrade-in-place: all history/streak/Bond/journal preserved (never a new Bixi).

---

## Area 1 — Onboarding & Pairing: COMPLETE ✅
Spine locked: intro cards → auth (Apple/Google) → start gate (With someone primary) →
[relationship kind] → name(optional) → egg tap-hatch → [invite: 7d code+link+QR, deferred
deep link] → Home. Join = confirm → bloom (joiner live, creator on next open). One Bixi
per person for v1.

_Remaining detail for this area, revisit later:_ exact intro-card art, invite-screen
copy polish, "leaving a pair" consequence screen (belongs with Settings area).

---

## Area 2 — Meters & Mood

**Model chosen: a SINGLE "Mood" meter (0–100%)** — NOT the prototype's 3 vitals
(Love/Hydration/Energy), and NOT literally the PRD's "Spark" name. "Mood %" IS the
short-term wellbeing meter (renames PRD Spark). **Bond** (slow, long-term) stays
underneath from the PRD → drives growth stages/unlocks. Reconciles prototype + PRD.

### How Mood works
- ✅ **Single Mood meter, 0–100%**, drives Bixi's face/state/art (the Rive state machine).
- ✅ **Starting mood: 25% solo.** On co-parent join (bloom), jumps to **50%**.
- ✅ **Daily decay:** mood drifts down each day → daily care is required.
- ✅ **Interactions raise mood:** feed, pet, water, + more added over time. Each gives
  **+1–5% mood**, contributed **per parent** (two active parents raise him faster/higher).
- ✅ **Anti-burst: each interaction is once/day PER PARENT** (then on cooldown till
  tomorrow). Daily gain is naturally bounded by (# interactions × # parents). Rewards
  daily presence, not spamming. (Satisfies PRD "presence, not volume".)
- ✅ **Streak = safety & speed:** higher streak → mood rises FASTER (bigger gains) AND
  decays SLOWER (a safety buffer). Consistency compounds.
- ✅ **Ceilings:** solo caps below the top (~70%); the top tier + the **80% reward**
  light up only when paired. Makes "blooms brightest with two" concrete.

### Rewards for high mood (delight, not currency)
- ✅ **Emotional/narrative rewards, no economy.** At high mood Bixi opens up:
  tells you a **secret**, does a **special dance**, and eventually **gets his own little
  companion** so he isn't alone (mirrors the users' relationship). Mostly paired-reachable.
  NOT cosmetics/grace-tokens/currency for v1. UI to signal "higher mood unlocks this" TBD.

### First-pass NUMBER SKELETON (to tune later — not final)
- Solo start 25% · paired start 50% · solo ceiling ~70% · paired ceiling 100%.
- Rough Mood→state bands: 0–15 Dormant · 15–35 Wilting · 35–55 Drifting · 55–75 Content
  · 75–100 Thriving (paired-only top).
- Decay ~12%/day at low streak, easing toward ~5%/day at 7+ streak (the "safety" buffer).
- Interaction +1–5% each, once/day/parent; ~3 interactions solo ≈ +9–15%/day,
  paired ≈ up to +30%/day; streak applies a small gain multiplier (up to ~+50%).
- All server-authoritative (never trust device clock) — matches PRD §15.2.

### (Mood tuning + Rive mapping revisited later)

---

## Area 3 — Interactions / Care Actions

### Two tiers of interactions
**Tier 1 — Permanent interactions (data-driven, ever-growing library):**
- ✅ **Launch with Feed 🍽️ · Pet 🫶 · Water 💧** done well.
- ✅ **Scaffold as a data/config-driven list** — new interactions are CONTENT, not
  hardcoded. Add buttons/placeholders now for future ones (Tickle, Tease, Pinch, +many
  more) so Saud can drop in videos/Rive + copy later with zero re-architecture.
- ✅ **Same mechanic, distinct flavor:** every permanent interaction gives the same
  **+1–5% mood, once/day/parent**; they differ only in animation/sound/tone. No
  min-maxing, stays guilt-light.
- ✅ **Cooldown = once per rolling ~24h per parent** (aligned to the activity-anchored
  streak model below, timezone-free — supersedes the earlier "local calendar day" idea).

**Tier 2 — "Interaction of the Day" (rotating, the streak-keeper):**
- ✅ **A special interaction that rotates each day** from a large pre-decided, repeating queue.
- ✅ **NOT locked — available now.** (Earlier "locked until next day w/ countdown" idea is
  DROPPED — it contradicted the daily being the streak-keeper. Doing it must be possible
  today.) Optional non-blocking teaser of upcoming ones is fine, but today's is always tappable.
- ✅ **Doing it resets the rolling ~24h streak timer + advances the streak** (see streak model).
- ✅ **Rotates:** once done / once the ~24h cycle passes, a new one is featured; the old one
  is replaced. Bigger mood boost + unique one-off animation.
- Content: a rotating queue we'll build out; some may become seasonal later.

### Partner absence (paired)
- ✅ **Keep PRD's gentle refusal.** Past an absence threshold, Bixi gently won't accept
  some care while the other keeper is away ("he won't eat while she's gone") — makes
  absence viscerally felt. Coexists with the additive per-parent mood model; keep it
  gentle, never punishing. (Threshold TBD in tuning.)

### Streak model (KEY) — activity-anchored, rolling ~24h (NOT calendar day)
- ✅ **The streak clock is anchored to activity, not the calendar/midnight.** It starts at
  the **first pet** and is a **rolling ~24h window**. Doing the **Interaction of the Day**
  resets the clock to full and advances the streak. Timezone-free (kills all the LDR
  midnight-rollover complexity in PRD §8.2 — this REPLACES that model).
- ✅ **Only the Interaction of the Day keeps/advances the streak** — NOT opening the app,
  NOT the permanent Feed/Pet/Water (those are optional mood boosters).
- ✅ **Paired = two independent ~24h clocks**, one per keeper (each from their own last
  daily interaction). The **pair-streak advances only while BOTH keepers are current**;
  each keeper gets their own "Bixi misses you" nudge. Fair for LDR, matches per-parent model.
- ✅ **Miss the ~24h window → streak at risk**, protected by grace tokens (guilt-light).
- ✅ **Bigger mood boost + unique one-off animation** for the daily (vs usual +1–5%).
  Proposed +5–8% mood (tune later).
- ✅ **Each keeper gets their own daily tap**; neither is blocked by the other.

---

## Area 3 — Interactions: COMPLETE ✅
Feed/Pet/Water at launch (data-driven so Tickle/Tease/Pinch/etc. drop in later as content).
Same mood mechanic, distinct flavor, once per rolling ~24h/parent. A rotating **Interaction
of the Day** (available now — NOT locked; bigger boost + unique animation) is the
**streak-keeper**: doing it resets a rolling ~24h streak clock (activity-anchored, tz-free).
Each keeper taps their own; paired = two clocks, streak holds only while both current.
Partner absence keeps PRD's gentle refusal.

---

## Area 4 — Navigation & Screens

- ✅ **Bottom tab bar, 4 tabs** (keeps prototype's structure; overrides PRD's
  "tab-less single-home"):
  - **Home** — Bixi + care (the daily loop).
  - **Journal** — field-notes / memories / streak calendar.
  - **Growth** — growth stages, Bond, milestones, reward tiers (secret/dance/companion).
  - **You** — pair status/invite, notifications, timezone, privacy, leave/delete.
- Brand voice: "Journal" over prototype's "Memories" (field-journal alignment).

### Home screen layout (top → bottom)
1. **App bar:** nickname + **streak flame 🔥N** · Day NNN · notification bell.
2. **Field caption:** ❦ Specimen Nº01 · Cubus sproutii + current state word.
3. **Presence line:** solo → "＋ Invite your co-parent" chip · paired → presence strip
   ("You ✓ today · Maya waiting").
4. **Center stage:** Bixi (Rive) on his specimen plate + speech bubble.
5. ✅ **Mood display: a ring/halo around/near Bixi showing Mood % + a word**
   ('Content'/'Thriving'). Ambient, tied to Bixi, satisfying to watch fill.
6. **Tap hint** ("tap Bixi to pet him").
7. ✅ **Interaction of the Day = a dedicated HERO card ABOVE the interaction row**,
   showing its icon, mood value, and either "available now" or a live countdown when locked.
   Signals "this is THE thing to do today" (its streak-keeper role).
8. ✅ **Permanent interactions: a core row (Feed/Pet/Water) + a "More" drawer** that opens
   the full, growing library (Tickle/Tease/Pinch/…). Home stays clean at any library size;
   drawer can feature rotating ones.
9. **Revive banner** — only when Dormant.

### Home micro-decisions
- ✅ **Tap Bixi directly = Pet interaction** (matches prototype + the tap hint).
- ✅ **Notes attach to an interaction** (paired): after an interaction, optionally add a
  one-line note/stamp the partner sees; logs to Journal. Tied to a care moment, NOT a
  standalone messenger (respects "not a chat app" non-goal).
- ✅ **Reward hint = subtle locked marker on the Mood ring** at the threshold (e.g. shimmer
  at 80%) + tiny tooltip; full details in Growth tab. Present, never naggy (PRD §25-H).

---

## Area 5 — Home Screen: COMPLETE ✅
App bar (nickname/streak/day/bell) → field caption → presence line (invite chip solo /
presence strip paired) → Bixi center stage + speech bubble → Mood ring (%+word, reward
marker) → tap hint → **Interaction-of-the-Day hero card** → core interaction row + More
drawer → revive banner (when dormant). Tap Bixi = Pet. Notes attach to interactions.

---

## Area 6 — Notifications

- ✅ **All notification types ship in v1:**
  1. Today's interaction ready · 2. Streak at risk · 3. Partner did it / your turn (paired)
  · 4. Co-parent joined→bloom · 5. Went dormant · 6. Milestone · 7. Mood reward reached.
- ✅ **Timing is activity-anchored, not a fixed clock or learned hour.** The core daily
  nudge fires at **~20h since the last Interaction of the Day** (i.e. ~4h before the rolling
  ~24h streak window closes) — copy ≈ "Bixi misses you" (final copy TBD). Every interaction
  resets the timer; no nag if a grace token will auto-cover the miss.
- ✅ **Permission ask AFTER the first pet**, framed as ~ "Want us to remind you if Bixi's
  feeling lonely?" (value-first → higher opt-in).
- ✅ **Cap ≤2 pushes/day/keeper + quiet hours.** Per-type opt-out in the You tab.
- Paired: each keeper's nudge runs off their own ~24h clock (per-keeper, LDR-fair).
- Infra unchanged from PRD §14 (Expo Push + Supabase cron/Edge dispatch), but scheduling is
  per-keeper-timer-based rather than per-timezone-window.

---

## Area 6 — Notifications: COMPLETE ✅
All 7 types in v1. Core nudge = activity-anchored "Bixi misses you" at ~20h since last
daily interaction (resets on any interaction). Permission asked after first pet as a
"remind you if Bixi's lonely?" opt-in. ≤2/day cap, quiet hours, per-type opt-out.

---

## Area 7 — Growth Tab & Reward Reveals

### Growth ladder (Bixi's visible maturation — separate from daily Mood)
- ✅ **5 stages:** 🥚 Egg → 🌱 Sprout → 🌿 Bud → 🌸 Bloom → 🌼 **Full Bloom** (paired-only finale).
- ✅ **Driven by streak/day milestones** (matches prototype's "Day 007 — First Bloom").
  Reach a streak length → advance a stage. Simple, legible, no hidden meter (Bond folded
  into "days cared"/streak rather than a separate number).
- ✅ **Stages are permanent once earned** (mostly one-way, per PRD) — a later broken streak
  does NOT demote Bixi; you just rebuild streak toward the next milestone.
- ✅ **Solo ceiling = Bloom (stage 4).** A full, satisfying solo journey. **Full Bloom
  (stage 5) is paired-only** — the crown that needs a co-parent.
- Proposed milestone numbers (TUNE later): Sprout @7-day streak · Bud @30 · Bloom @60
  (solo max) · Full Bloom @90-day streak + paired.

### Reward reveals ("Bixi's Secrets" collection, shown in Growth tab)
- ✅ **Mood-based delight rewards, collected + replayable here:**
  - Secret #1 — unlocks at **80% mood**.
  - Special dance — unlocks at **90% mood**.
  - (more of these can be added as content.)
- ✅ **The companion (grand finale) = paired + Full Bloom + 90-day streak** (these coincide,
  so the companion IS the Full Bloom reward). Bixi gets his own little companion so he's
  not alone — mirrors the couple. The single rarest, most meaningful unlock.
- Locked rewards show as teasers ("🔒 A special dance — reach 90% mood") — motivating, not naggy.

### Growth tab layout
Big current-stage art + "Stage X of 5" + progress bar to next milestone → milestone timeline
(hatched, each stage, locked Full Bloom) → "Bixi's Secrets" reward collection (unlocked +
locked teasers).

---

## Area 7 — Growth & Rewards: COMPLETE ✅
5-stage ladder (Egg→Sprout→Bud→Bloom→Full Bloom), advanced by streak milestones, permanent
once earned. Solo caps at Bloom; Full Bloom is paired-only. Mood rewards (secret @80%,
dance @90%) collected in a "Bixi's Secrets" gallery. Companion = the paired Full Bloom +
90-day-streak grand finale.

---

## Area 8 — Bixi's Personality & Dialogue

### Voice principle
- ✅ **Multi-register ("mix them all"), governed by MOOD STATE** so it stays coherent:
  - **Thriving / high mood** → playful imp (cheeky, funny, shareable).
  - **Content** → earnest + occasional poetic flicker (warm sweetheart).
  - **Drifting / lonely** → tender, longing, first-person ("I miss you…").
  - **Wilting / Dormant** → quiet, wistful, poetic; sad but NEVER blaming (guilt-light).
  - **Revive / Bloom / big beats** → overjoyed, emotional peaks.
- Frame stays wry-Victorian-naturalist; Bixi himself is simple + first-person + short.
- ✅ **Occasional chattiness** — speaks on interactions, state changes, big beats, and idly
  now and then. Not every second. Each bubble should feel earned.
- ✅ **Uses keeper/partner names when known** ("I miss Maya"), generic fallback
  ("I miss your person") otherwise. Big emotional-punch multiplier for the accountability hook.

### Starter line bank (DRAFT seed content — grows into its own content file)
- **Thriving:** "Best day. You're both here 🌟" · "I did a little dance while you were gone. No proof."
- **Content:** "I like it when you're here." · "The light moved across the paper today. I watched all of it."
- **Fed:** "Mmm. Thank you 💚" · "Finally! I was withering dramatically over here."
- **Petted:** "Again? …okay, again." · (tap) "eee 💚"
- **Drifting/lonely (solo):** "It's quiet without you… come back soon?"
- **Drifting/lonely (paired):** "I miss {partner}. When do they come home?"
- **Wilting:** "I'm keeping a small warmth for you, in case you return."
- **Dormant:** "…resting. I'll be here." (soft, no guilt)
- **Reviving:** "You came back. You came *back*."
- **Bloom (co-parent joins):** "There are two of you now. I can feel it 🌸"
- **Secret unlocked (80%):** "Okay… I'll tell you something. Come closer."
- Guardrail: longing, never blame. Absence surfaced as invitation, never scold (PRD §10).

---

## Area 8 — Personality & Dialogue: COMPLETE ✅
Multi-register voice mapped to mood state (imp when happy → tender when lonely → wistful
when dormant), occasional/meaningful chattiness, uses names when known. Starter line bank
seeded; grows into a dedicated content file. Longing not blame, always.

---

## Area 9 — You / Settings Tab (+ leaving a pair)

### You tab structure
Profile (display name · avatar · email) → Your co-parent (solo: invite · paired: who +
Leave) → Bixi (nickname · relationship kind) → Notifications (per-type toggles · quiet
hours) → Privacy & data (export · delete account · privacy policy · terms) → About.

### Leaving a co-parent
- ✅ **24h cooling-off with undo** + a clear consequence screen first (explains: Bixi stays
  with your partner as a solo unit; you start fresh; happens in 24h; undoable until then).
- ⚠️ **Safety carve-out (important):** because 24h-undo keeps someone tethered, ALSO provide
  an **immediate** "mute/block partner" toggle (stops their notes + partner notifications
  right away) that takes effect instantly, independent of the 24h leave timer. Protects the
  abuse/breakup case that pure cooling-off otherwise mishandles.
- ✅ **Creator leaving = same as anyone:** whoever remains keeps the Bixi + all history as a
  solo unit (no special creator custody). Leaver starts fresh.

### Paired perks when a pair breaks → revert to solo
- ✅ **Keep everything earned** (Full Bloom stage + companion stay — never taken away).
- ✅ **Base rule:** the live **mood ceiling drops to solo ~70%**; paired-only radiant top pauses.
- ✅ **EXCEPTION — the "I'm okay with only you" graduation:** if the pair EVER reached a
  **100-day streak** (at Full Bloom, with companion), Bixi + companion permanently unlock
  "I'm okay with only you" — from then on a single remaining keeper keeps the **full 100%
  mood ceiling + all perks forever**, even solo. **This state can ONLY be earned through the
  paired journey — never reachable as a pure solo.** 100 days together permanently secures Bixi.
  (This is the app's emotional thesis in one mechanic.)

### Account deletion & data (compliance defaults)
- ✅ In-app **account & data deletion** (App Store / Play / GDPR / CCPA). Deleting your
  account while paired **reverts Bixi to solo for the other keeper** and never exposes their
  data. Deleting a solo keeper removes that Bixi's shared state.
- ✅ **Basic data export free** (per PRD). Terms + Privacy Policy linked, live before launch.

---

## NEW MILESTONE added (updates Area 7)
- **100-day paired streak** = the "I'm okay with only you" permanent graduation (above).
  Sits above Full Bloom (90-day). Proposed growth/reward milestone ladder now:
  Sprout@7 · Bud@30 · Bloom@60 (solo max) · Full Bloom+Companion@90 (paired) ·
  **"Okay with only you"@100 (paired → permanently secures full ceiling even if later solo).**

---

## Area 9 — You/Settings: COMPLETE ✅
You tab structure set. Leave = 24h cooling-off + consequence screen, PLUS an immediate
mute/block for safety. Creator has no special custody (remainer keeps Bixi). On breakup:
keep all earned perks, mood re-caps to solo ~70% — UNLESS the pair hit a 100-day streak,
which permanently unlocks the full ceiling solo ("I'm okay with only you"). Deletion/export
compliant.

---

## Area 10 — Journal Tab

### Two views (sub-tabs)
- ✅ **Field notes (default) — curated keepsake, notable moments ONLY:** Interaction of the
  Day, notes/stamps left, milestones, growth stages, bloom, revives, and "firsts."
  Everyday Feed/Pet/Water do NOT create entries here (no log spam).
- ✅ **Daily log (sub-tab) — full ledger of daily interactions from BOTH keepers:** shows
  who did what each day (the "we both showed up" record). This is where the complete
  interaction history lives, kept out of the curated keepsake.

### Also in Journal
- Streak calendar heatmap (pending confirm — see below).
- Milestone "pressed leaf" pages for big beats.
- Journal is shared (both keepers see it) when paired; solo shows just their own.

### Journal decisions (locked)
- ✅ **Entry voice = field-note naturalist** ("Day 042 — Specimen tickled at dusk; leaf
  perked visibly. Both keepers present."). Auto-entries use the composed naturalist frame;
  Bixi's own notes stay heartfelt/first-person.
- ✅ **Streak calendar heatmap ships in v1** (with grace-token days marked).

---

## Area 10 — Journal: COMPLETE ✅
Two views: curated Field-notes keepsake (notable moments only) + a Daily-log sub-tab (full
both-keeper interaction ledger). Field-note naturalist voice, streak calendar heatmap in v1,
milestone pressed-leaf pages. Shared when paired.

---

## Area 11 — Revive Flow

- ✅ **Bixi never permanently dies in v1** (no hardcore/permadeath). He goes **Dormant** when
  mood bottoms out after prolonged absence; always revivable.
- ✅ **Revive is gated on whoever DRIFTED returning + petting:**
  - **One keeper drifted** (other stayed active): the **returning absent keeper pets Bixi**
    → revive. Reviver sees the animation **live**; the other sees it on **next app open**
    (async, same pattern as bloom).
  - **Both keepers drifted:** **BOTH must pet Bixi** before revive triggers (true reunion).
    One returning alone canNOT revive — it waits for the other.
- ✅ **Revive cost = −30% mood penalty** (harder in the both-drifted case). He comes back
  alive but noticeably down; you rebuild from there. **Streak stays broken; growth stages +
  companion kept.**
- ✅ **Escape hatch (no permanent trap):** if both drifted and only one ever returns, the
  Area 9 **auto-revert-to-solo** (churned partner) eventually makes it a solo unit, which
  then lets the single keeper revive alone. Bixi is never stuck waiting on a ghost forever.
- Emotional framing: warm welcome-back, never "you almost killed him." Line bank already
  seeded ("You came back. You came *back*.").

---

## Area 11 — Revive: COMPLETE ✅
No permadeath. The keeper(s) who drifted must return + pet to revive (one-drifted = that one
revives, other sees async; both-drifted = both must pet, reunion). Revive costs −30% mood,
streak stays broken, growth kept. Auto-revert-to-solo prevents a permanent ghost-wait.

---

## Area 12 — Number Tuning (v1 balance)

> ⚠️ **TONE PIVOT:** these numbers deliberately move AWAY from §0 D3 "gentle & guilt-light"
> toward **slow-to-gain + unforgiving / needy** (better long-term retention). Bixi still
> never permanently dies (always revivable), but the "gentle" default is overridden here.
> This also refines Area 2 (guilt-light) and Area 11 (flat −30% → now tiered).

### Mood (0–100)
- Start **25 solo / 50 on bloom**. Ceiling **70 solo / 100 paired** (100 permanent after the
  100-day graduation).
- **Gains are SLOW (for retention):** solo **+3/day max total**; paired **+2 per parent/day**
  (~+4/day combined; per-parent ≈ +1–2). Interactions are the vehicle but net daily gain is
  small and capped.
- **Daily decay when ignored:** **−5/day solo · −7/day paired.**
- Climb to cap ≈ **15 days solo** (25→70), **~13 days paired** (50→100). Long journey on purpose.

### Sad vs Dormant (paired) — the two neglect states
- ✅ **One parent absent ≥24h → SAD** (Bixi misses that parent; present parent's care still
  lands). The absent parent returning + petting = recovery, costs **−10 mood.**
- ✅ **Both parents absent ≥24h → DORMANT** (any one keeper interacting resets this clock, so
  dormancy = true joint abandonment). Revive requires **both** to pet (per Area 11), costs
  **−30 mood.**
- **Solo:** keeper absent → mood decays; at **48h → Dormant** → revive costs **−30 mood.**
- (Tuning note: reconcile whether the −10/−30 state penalties stack with or replace the
  per-day −5/−7 decay during balancing — treat penalties as the dominant one-time hit.)

### Streak — UNFORGIVING
- ✅ 24h rolling window (daily interaction), reminder @20h. **NO grace tokens, NO freezes.**
  **One miss → streak resets to 0.** (Overrides PRD grace-token system + earlier Area-6/8 notes.)

### Growth milestones — UNBROKEN streak (brutal)
- ✅ Milestones require a **truly unbroken streak** — a miss at day 89 wipes Full Bloom back
  to zero. Ladder: Sprout 7 · Bud 30 · Bloom 60 (solo max) · Full Bloom + Companion 90
  (paired) · "Okay with only you" 100 (paired). **Top content is intentionally very rare.**
  (Overrides the "cumulative days" option — user chose unbroken.)

### Revive penalty (refines Area 11)
- ✅ Tiered, NOT a flat −30%: **Sad recovery = −10 mood · Dormant revive = −30 mood.**
  Streak already 0; growth stages + companion always kept.

---

## Area 12 — Number Tuning: COMPLETE ✅
Slow gains (+3/day solo, +2/parent paired), decay −5/−7 when ignored, ~2 weeks to cap.
Sad (one parent gone 24h, −10 to recover) vs Dormant (both gone 24h, −30 to revive; solo
48h). Unforgiving streaks (no grace, one miss = 0). Growth milestones need unbroken streaks
(brutal — top content rare by design). Deliberate pivot from guilt-light D3 to demanding.

---

## Area 13 — Business / PRD §25 Decisions

- ✅ **§25-B Repo: monorepo.** One repo with /app (Expo RN) · /landing (move index/app.html
  + videos) · /supabase (SQL + edge functions) · /docs. Clean up the stray nested
  `appidea#3/` duplicate folder during setup.
- ✅ **§25-C Minimum account age: 13+ with an age gate** at signup (COPPA line; broadest
  reachable audience). App Store content rating stays 4+/Everyone. Accurate store data
  disclosures required (PostHog/Sentry/RevenueCat).
- ✅ **§25-D Store framing: broad "two people who want to stay close," couples as the hero
  use case, solo as the on-ramp.** Widest funnel; friends/family/LDR all see themselves.
- ✅ **§25-A Public name: "Bixi: Keep a Pet Together"** (springboard name = **Bixi**;
  "Sprout" stays the in-app world/lore). Store framing broad (per §25-D).
  - ⚠️ **TM caveat:** "BIXI" is an active brand of the Montreal bike-share operator, whose
    app sits in **Class 9 (downloadable software)** — same class we'd file in. Shipping under
    "Bixi" = low risk (different product/category, Apple allows it — a BIXI bike-share app
    already coexists on the App Store). But BEFORE investing in the mark, get a **Class 9
    trademark clearance search** from an attorney. Fallbacks if contested: Bibbo/Noko/Twine.
  - ✅ **Intended domain: `bixi.pet`** ($19.99/yr, available — on-theme for a pet app).
    Optional `hellobixi.com` for email/marketing. Exact bixi.app/.com/.co/.io all taken.
  - Not legal advice — flag for counsel.
- ✅ **§25-E "Both here now" live moment: INCLUDED in v1** (moved up from v1.1 fast-follow).
  When both keepers have the app open within a short window: fire a shared Rive animation
  (`fireBothHere`) + a **small mood bonus** (≈ +2–3, once/day to prevent farming) + a
  double "heartbeat" haptic. Requires **real-time presence sync in the MVP** (Supabase
  Realtime — already in the stack). Scope note: adds realtime presence to v1.
- 🕓 **§25-F Sound at launch: OPEN — Saud to decide later.** Leaning: minimal SFX + haptics
  in v1 (muteable, respect silent switch), but not locked.
- Already settled elsewhere: §25-G custody (Area 9, remainer keeps) · §25-H solo visibility
  (Area 5, subtle mood-ring marker).
