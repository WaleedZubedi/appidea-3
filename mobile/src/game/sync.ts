/**
 * Online sync layer. Maps server state → the Zustand store and runs the RPC-backed
 * actions. Only invoked when IS_ONLINE. Offline mode never touches this file.
 */
import * as api from '@/lib/api';
import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';

import { interactionByKey } from './content/interactions';
import { REACTION_BLOOM, REACTION_HATCH, REACTION_REVIVE } from './content/dialogue';
import { useBixi } from './store';
import type { GrowthStage, RelationshipKind } from './types';

const toMs = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

let _c = 0;
const newActionId = () => `${Date.now().toString(36)}-${(_c++).toString(36)}`;

function applyBundle(b: api.PairBundle, uid: string | null) {
  const self = b.members.find((m) => m.profile_id === uid);
  const usedThisCycle: Record<string, Record<string, number>> = {};
  if (self?.last_daily_at) {
    usedThisCycle[self.profile_id] = { __daily__: toMs(self.last_daily_at)! };
  }
  // creator-side bloom payoff: if THIS pair just went from unbloomed → bloomed
  // (partner claimed the invite), fire the bloom reaction on next sight (Area 1).
  const prev = useBixi.getState();
  const justBloomed =
    prev.pairId === b.pairId && prev.bloomedAt == null && b.bloomedAt != null &&
    b.members.length >= 2;
  useBixi.setState({
    pairId: b.pairId,
    bixiName: b.bixiName,
    bixiNameChangedAt: toMs(b.bixiNameChangedAt),
    relationshipKind: (b.relationshipKind as RelationshipKind) ?? null,
    createdAt: toMs(b.hatchedAt),
    bloomedAt: toMs(b.bloomedAt),
    ...(justBloomed
      ? { reaction: { line: REACTION_BLOOM, at: Date.now() }, inviteCode: null, inviteToken: null }
      : {}),
    keepers: b.members.map((m) => ({
      id: m.profile_id,
      // keep the REAL display name (email prefix for password signups) so the
      // Home greeting can show the user's name, not "You"/the Bixi's nickname
      name: m.display_name ?? (m.profile_id === uid ? 'You' : 'Your person'),
      isSelf: m.profile_id === uid,
      bond: Number(m.bond ?? 20),
      lastDailyAt: toMs(m.last_daily_at),
      lastSeenAt: toMs(m.last_seen_at),
      lastFeedAt: toMs(m.last_feed_at),
      lastWaterAt: toMs(m.last_water_at),
      lastPetAt: toMs(m.last_pet_at),
      leaveRequestedAt: toMs(m.leave_requested_at),
      muted: m.muted ?? false,
    })),
    mood: Number(b.state.mood),
    feed: Number(b.state.feed),
    water: Number(b.state.water),
    vitalsUpdatedAt: toMs(b.state.vitals_updated_at) ?? Date.now(),
    growthStage: b.state.growth_stage as GrowthStage,
    streak: b.state.streak,
    bestStreak: b.state.best_streak,
    totalCareDays: b.state.total_care_days,
    everReached100Streak: b.state.ever_reached_100,
    dormant: b.state.dormant,
    revivePending: b.state.revive_pending,
    hasCompanion: b.state.has_companion,
    unlockedSecrets: b.state.unlocked_secrets,
    onboarded: true,
    usedThisCycle,
  });
}

/**
 * Pull the full authoritative state for my pair (or clear if I have none yet).
 * PURE READ — never writes, so a realtime-triggered hydrate can't re-trigger
 * realtime (that infinite loop was the source of the lag). Decay is settled
 * separately by `settle()` on app-open + the 15-min cron.
 */
export async function hydrate(): Promise<string | null> {
  if (!IS_ONLINE) return null;
  const uid = useAuth.getState().userId;
  let pairId: string | null;
  try {
    pairId = await api.getMyPairId();
  } catch {
    // transient read failure (network / token refresh): keep the persisted pair
    // so the routing Gate doesn't bounce a real user to onboarding.
    return useBixi.getState().pairId;
  }
  if (!pairId) {
    useBixi.setState({ pairId: null }); // authoritative: no pair → onboarding is correct
    return null;
  }
  const b = await api.getPairBundle(pairId);
  if (b) applyBundle(b, uid);
  return pairId;
}

/** settle server-side decay/dormancy ONCE (app open / foreground), then hydrate. */
export async function settle(): Promise<void> {
  if (!IS_ONLINE) return;
  const pairId = await api.getMyPairId();
  if (!pairId) return;
  await api.recomputePair(pairId).catch(() => {});
  await hydrate();
}

export async function onlineHatch(
  paired: boolean,
  name: string,
  kind: string | null
): Promise<string> {
  const pairId = await api.createBixi(name, kind && kind.length ? kind : null, paired);
  useBixi.setState({ reaction: { line: REACTION_HATCH, at: Date.now() } });
  await hydrate();
  if (paired) {
    const inv = await api.createInvite(pairId);
    useBixi.setState({ inviteCode: inv.code, inviteToken: inv.token });
  }
  return pairId;
}

export async function onlineCare(key: string) {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  const def = interactionByKey(key);
  useBixi.setState({ reaction: { video: def?.video, line: def?.line, at: Date.now() } });
  await api.applyCare(pid, key, false, newActionId());
  await hydrate();
}

export async function onlineDaily() {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  await api.applyCare(pid, 'daily', true, newActionId());
  await hydrate();
}

export async function onlineRevive() {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  const st = await api.revive(pid);
  if (!st.dormant) useBixi.setState({ reaction: { video: 'revive', line: REACTION_REVIVE, at: Date.now() } });
  await hydrate();
}

export async function onlineInvite(): Promise<string> {
  const pid = useBixi.getState().pairId;
  if (!pid) throw new Error('no pair');
  const inv = await api.createInvite(pid);
  useBixi.setState({ inviteCode: inv.code, inviteToken: inv.token });
  return inv.code;
}

/** "both here now" — server enforces the once-per-20h bonus; fire the moment only when granted. */
export async function onlineBothHere(): Promise<void> {
  const s = useBixi.getState();
  if (!s.pairId) return;
  const before = s.mood;
  const st = await api.bothHere(s.pairId);
  const granted =
    st.last_both_here_at != null &&
    Date.now() - new Date(st.last_both_here_at).getTime() < 15_000;
  await hydrate();
  if (granted && Number(st.mood) >= before) {
    useBixi.setState({
      reaction: { line: 'You’re both here. Right now. Best day 🌟', at: Date.now() },
    });
  }
}

export async function onlineRequestLeave(): Promise<string | null> {
  const pid = useBixi.getState().pairId;
  if (!pid) return null;
  const effective = await api.requestLeave(pid);
  await hydrate();
  return effective;
}

export async function onlineUndoLeave(): Promise<void> {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  await api.undoLeave(pid);
  await hydrate();
}

export async function onlineSetMute(muted: boolean): Promise<void> {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  await api.setPartnerMute(pid, muted);
  await hydrate();
}

export async function onlineClaim(token: string): Promise<void> {
  await api.claimInvite(token);
  useBixi.setState({ reaction: { line: REACTION_BLOOM, at: Date.now() } });
  await hydrate();
}

export async function onlineLeave() {
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  await api.leavePair(pid);
  await hydrate();
}

export async function onlineSetBixiName(name: string): Promise<void> {
  const pid = useBixi.getState().pairId;
  if (!pid) throw new Error('no pair');
  await api.setBixiName(pid, name);
  await hydrate();
}

/** dev/admin-only: patch shared state on the server, then hydrate (realtime does the rest). */
export async function onlineDevSetState(p: api.DevPatch): Promise<void> {
  if (!IS_ONLINE) return;
  const pid = useBixi.getState().pairId;
  if (!pid) return;
  await api.devSetState(pid, p);
  await hydrate();
}

export function subscribe(): (() => void) | undefined {
  if (!IS_ONLINE) return undefined;
  const pid = useBixi.getState().pairId;
  if (!pid) return undefined;
  // a single action writes bixi_state AND pair_members → a burst of change
  // events. Coalesce them into ONE hydrate so both phones re-render once, not
  // three times (that thrash was part of the "everything freezes" report).
  let t: ReturnType<typeof setTimeout> | null = null;
  const ch = api.subscribeToPair(pid, () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; void hydrate(); }, 250);
  });
  return () => {
    if (t) clearTimeout(t);
    void ch.unsubscribe();
  };
}
