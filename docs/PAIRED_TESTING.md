# Bixi — Two-Phone Paired-Mode Test Playbook

Test every paired-mode feature on two phones, using **time manipulation in the Supabase
SQL editor** to fast-forward hours/days instantly.

**How time manipulation works:** we can't move the real clock, so we *age the stored
timestamps backwards* (e.g. set `last_seen_at = now() - interval '30 hours'`), then call
`recompute_pair()` so the server applies decay / sad / dormant / streak as if that time
passed. Writes to `bixi_state` / `pair_members` also fire **realtime**, so the phones
refresh within ~2s (reopen the app if one doesn't).

Run SQL in **Supabase Dashboard → SQL Editor**. Every snippet targets *your most recent
pair* via `(select id from pairs order by created_at desc limit 1)`, and identifies the two
keepers by join order: **A = creator** (joined first), **B = joiner** (second).

---

## 0 · Setup

1. **Both phones** in Expo Go. Phone **A**: sign up → create a **paired** Bixi → get the
   `BIXI-XXXX` code. Phone **B**: sign up (different email) → "Have an invite code? Join a
   Bixi" → enter the code → **bloom**. You're now co-parenting one Bixi.
2. Keep this **inspect query** handy — run it any time to see the live state:

```sql
select p.bixi_name,
       s.mood as thriving, s.feed, s.water, s.streak, s.growth_stage,
       s.dormant, s.revive_pending, s.ever_reached_100, s.unlocked_secrets,
       pr.display_name, m.bond, m.last_seen_at, m.last_daily_at, m.muted, m.leave_requested_at
from pairs p
join bixi_state s   on s.pair_id = p.id
join pair_members m on m.pair_id = p.id
join profiles pr    on pr.id = m.profile_id
where p.id = (select id from pairs order by created_at desc limit 1)
order by m.joined_at;
```

3. **Reset to a clean baseline** between tests (repeatable):

```sql
with pair as (select id from pairs order by created_at desc limit 1)
update bixi_state set feed=60, water=60, streak=0, growth_stage='egg', dormant=false,
  revive_pending='{}', ever_reached_100=false, unlocked_secrets='{}', has_companion=false,
  last_both_here_at=null, last_streak_day_at=null, vitals_updated_at=now()
where pair_id=(select id from pair);

update pair_members set bond=20, last_seen_at=now(), last_daily_at=null,
  last_feed_at=null, last_water_at=null, last_pet_at=null, leave_requested_at=null, muted=false
where pair_id=(select id from pairs order by created_at desc limit 1);

select public.recompute_pair((select id from pairs order by created_at desc limit 1));
```

**Reference numbers:** feed/water refill **+45**, decay **−40 / −45 per day**, cooldown **8h**.
Pet **+3 bond** (4h cd), daily **+8 bond** + streak. Bond decays **−3/day** when drifted.
Sad = a keeper absent **24h** (return costs **−10 bond**). Dormant = feed & water **< 15**
+ a keeper absent → revive needs **both** pet, returns at feed/water **25**. Both-here **+5**
each, once **20h**. Growth **7 / 30 / 60 / 90**, graduation **100**. Wellbeing =
`0.30·feed + 0.30·water + 0.40·avg(bond)`, capped **70 solo / 100 paired**.

---

## T1 · Pairing & bloom (phones only)
- Already done in setup. Verify: inspect query shows **2 keepers**, `bloomed_at` set, feed/water
  bumped to ≥70. On a 3rd fresh account, entering the same code → **"already used"**; a brand-new
  invite from a full pair → **"pair full"**. A joiner who already has a Bixi → **"already have one."**

## T2 · Feed & Water (refill + cooldown)
- **Phone A** tap **Feed** → Feed bar jumps up (+45). Tap again immediately → **no change**
  (8h cooldown). **Phone B** tap Feed → it *does* rise (per-keeper cooldown → paired keeps him fuller).
- **Reset the cooldown** to feed again now:
```sql
update pair_members set last_feed_at = now() - interval '9 hours', last_water_at = now() - interval '9 hours'
where pair_id = (select id from pairs order by created_at desc limit 1);
```
Now the tap refills again.

## T3 · Vitals decay
- Fast-forward one day of neglect:
```sql
update bixi_state set vitals_updated_at = now() - interval '24 hours'
where pair_id = (select id from pairs order by created_at desc limit 1);
select public.recompute_pair((select id from pairs order by created_at desc limit 1));
```
- Expect: **Feed −40, Water −45** on both phones. Run the `recompute` twice → numbers **don't
  change the second time** (decay is idempotent — this was the old lag bug, now fixed).

## T4 · Bond (per-keeper, daily + pet)
- **Phone A**: tap Bixi (pet) → **A's** "You" bar +3; do the daily (Bixi card) → **A's** bar +8.
  **Phone B**: same → only **B's** "Your person" bar moves. The two bars move **independently**.
- Bond decay when drifted:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update pair_members set last_seen_at = now() - interval '48 hours', vitals_updated_at = vitals_updated_at
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc offset 1 limit 1);
update bixi_state set vitals_updated_at = now() - interval '24 hours'
where pair_id=(select id from pairs order by created_at desc limit 1);
select public.recompute_pair((select id from pairs order by created_at desc limit 1));
```
- Expect: **B's** bond drops (−3/day while gone); A's untouched.

## T5 · Wellbeing / "Thriving"
- With high feed/water and both bonds high → the Bixi card reads **Thriving** (paired only, and
  only while a **streak is live** — see T6). Drop feed/water (T3) → it slides to **Content →
  Drifting → Wilting**. Recompute after any change.

## T6 · Streak (needs BOTH current)
- **Phone A** do the daily → streak stays **0** (B hasn't). **Phone B** do the daily → streak **1**.
- Advance to a growth milestone instantly — set streak to 6, both "current", then one daily → **7 = Sprout**:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update bixi_state set streak=6, last_streak_day_at = now() - interval '21 hours'
where pair_id=(select id from pair);
update pair_members set last_daily_at = now() - interval '2 hours'
where pair_id=(select id from pairs order by created_at desc limit 1);
```
Now **either phone** taps the daily → streak **7**, `growth_stage = sprout`.
Repeat with `streak=29 → 30 Bud`, `59 → 60 Bloom` (solo max), `89 → 90 Full Bloom + companion`.

## T7 · Graduation (100-day → permanent full ceiling)
- Set `streak=99`, both current (as T6), tap the daily → streak **100**, `ever_reached_100=true`.
  From then on the ceiling stays **100 even solo** (leave a keeper in T11 and confirm it doesn't drop).

## T8 · Streak break (unforgiving)
- Fast-forward past a missed day:
```sql
update pair_members set last_daily_at = now() - interval '25 hours'
where pair_id = (select id from pairs order by created_at desc limit 1);
select public.recompute_pair((select id from pairs order by created_at desc limit 1));
```
- Expect: **streak → 0**. (Growth stage already earned is **kept** — never demotes.)

## T9 · "Both here now"
- Have **both phones open on Home at the same time** → shared moment fires, **+5 feed & water**
  once. To re-arm it (it's once/20h):
```sql
update bixi_state set last_both_here_at = now() - interval '21 hours'
where pair_id = (select id from pairs order by created_at desc limit 1);
```
Foreground both phones again → it fires again.

## T10 · Sad (one parent absent 24h)
- Make **B** absent for 30h:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update pair_members set last_seen_at = now() - interval '30 hours'
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc offset 1 limit 1);
```
- Expect: both phones show **"Missing you"** (Sad). Now on **Phone B**, tap anything → apply the
  **−10 bond** return penalty (B's bar drops once), and Sad clears.

## T11 · Dormant + revive (both must pet)
- Starve him **and** keep B away:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update bixi_state set feed=10, water=10, vitals_updated_at=now() where pair_id=(select id from pair);
update pair_members set last_seen_at = now() - interval '30 hours'
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc offset 1 limit 1);
select public.recompute_pair((select id from pairs order by created_at desc limit 1));
```
- Expect: **Dormant**, `revive_pending` has **both** ids; both phones show **"Tap to wake him."**
- **Phone A** taps → still dormant (waiting for B). **Phone B** taps → **revives**, feed/water = **25**.

## T12 · Leave flow (24h cooling-off, undo, mute, ghost-revert)
- **Phone B → You tab → Leave co-parent → "Start leaving"** → card shows **"Leaving in ~24h — tap to undo."**
- **Undo**: tap it → back to normal (`leave_requested_at` cleared).
- **Execute the cooled-off leave now**:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update pair_members set leave_requested_at = now() - interval '25 hours'
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc offset 1 limit 1);
select public.process_leaves();
```
Expect: **B removed**, A's Bixi becomes a **solo** unit (history kept; ceiling drops to 70 unless graduated in T7).
- **Mute** (safety): re-pair, then Phone B → **Mute partner** toggle → `muted = true` in the inspect query, instantly.
- **Ghost auto-revert** (a lone keeper is never trapped): dormant + B gone 31 days + A recent →
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update bixi_state set dormant=true where pair_id=(select id from pair);
update pair_members set last_seen_at = now() - interval '31 days'
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc offset 1 limit 1);
update pair_members set last_seen_at = now() - interval '1 day'
where pair_id=(select id from pair) and profile_id =
  (select profile_id from pair_members where pair_id=(select id from pair) order by joined_at asc limit 1);
select public.process_leaves();
```
Expect: **B removed automatically**; **A can now revive alone**.

## T13 · Realtime sync
- Both phones on Home. **Phone A** taps Feed → **Phone B's** Feed bar rises within ~1–2s, no reload.
  Same for pet/daily/bond and "Today's moments."

## T14 · Push nudge targeting (delivery needs a build)
- Real pushes need a dev/prod build (Expo Go/SDK 54 can't receive them). But verify the **targeting**:
```sql
with pair as (select id from pairs order by created_at desc limit 1)
update pair_members set last_daily_at = now() - interval '21 hours' where pair_id=(select id from pair);
update profiles set push_token = 'ExponentPushToken[test]'
where id = (select profile_id from pair_members where pair_id=(select id from pairs order by created_at desc limit 1) order by joined_at asc limit 1);
select * from public.nudge_targets();
```
Expect: the keeper appears (they're **20–24h** since their last daily → "Bixi misses you" would fire).

---

### Tips
- After any SQL, if a phone looks stale, **background + reopen** it (that runs `settle` → recompute + refresh).
- The 15-min cron (`bixi-recompute`) also settles decay on its own — these snippets just make it instant.
- Always **reset (§0.3)** before the next test so numbers are predictable.
