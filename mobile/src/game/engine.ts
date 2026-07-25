/**
 * Bixi mood/streak engine — pure functions + tuned constants (docs/DECISIONS.md Area 12).
 *
 * Tone: slow-to-gain + unforgiving. Gains are small; decay only bites when IGNORED
 * (not a constant drain), so a consistent keeper climbs while a neglectful one drifts.
 */
import type { BixiState, GrowthStage, Keeper, Mode, MoodState } from './types';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const MOOD = {
  soloStart: 25,
  bloomStart: 50,
  soloCeiling: 70,
  pairedCeiling: 100,
  secretAt: 80,
  danceAt: 90,
} as const;

/** slow gains — Area 12 */
export const GAIN = {
  daily: 2, // Interaction of the Day (the streak-keeper)
  permanent: 1, // Feed / Pet / Water each
  soloBudgetPerCycle: 3, // solo may add at most +3 mood / cycle
  pairedBudgetPerKeeper: 2, // each keeper may add at most +2 / cycle
  bothHereBonus: 3, // "both here now" live moment (once/cycle)
} as const;

/** decay applied per neglected day (only when ignored) */
export const DECAY = { solo: 5, paired: 7 } as const;

/** one-time mood cost to recover a neglect state */
export const PENALTY = { sad: 10, dormant: 30 } as const;

/** absence timers */
export const SAD_HOURS = 24; // one parent gone this long → Bixi is Sad (paired)
export const DORMANT_HOURS = { solo: 48, paired: 24 } as const;
export const STREAK_WINDOW_HOURS = 24; // rolling; miss it → streak resets (no grace)
export const REMIND_AT_HOURS = 20; // "Bixi misses you" nudge

export const GRADUATION_STREAK = 100; // the "I'm okay with only you" permanent unlock

/** vitals model (docs/FLOW.md v2) — mirrors the server _bixi_const() numbers. */
export const VITALS = {
  feedRefill: 1,
  waterRefill: 1,
  feedDecayPerDay: 2,
  waterDecayPerDay: 2,
  bondDaily: 5,
  bondPet: 1,
  bondDecayPerDay: 2,
  bondStart: 20,
  bondMax: 100,
  hatchVital: 60,
  bloomVital: 70,
  reviveVital: 25,
  bothHereBump: 5,
  starvedAt: 15,
} as const;

/** wellbeing weights: 0.30·feed + 0.30·water + 0.40·avg(bond). */
export const WEIGHTS = { feed: 0.3, water: 0.3, bond: 0.4 } as const;

export function avgBond(keepers: Keeper[]): number {
  if (!keepers.length) return 0;
  return keepers.reduce((a, k) => a + (k.bond ?? VITALS.bondStart), 0) / keepers.length;
}

/** the derived "Thriving" headline number (stored server-side as bixi_state.mood). */
export function computeWellbeing(
  feed: number,
  water: number,
  keepers: Keeper[],
  ceiling: number
): number {
  const w = Math.round(
    WEIGHTS.feed * feed + WEIGHTS.water * water + WEIGHTS.bond * avgBond(keepers)
  );
  return Math.max(0, Math.min(ceiling, w));
}

export type Band = { label: string; key: 'full' | 'good' | 'low' | 'empty' };
/** Feed/Water band → the card word (Full / Good / Low / Empty). */
export function vitalBand(v: number): Band {
  if (v > 75) return { label: 'Full', key: 'full' };
  if (v > 45) return { label: 'Good', key: 'good' };
  if (v > 20) return { label: 'Low', key: 'low' };
  return { label: 'Empty', key: 'empty' };
}
/** Bond band → the card word (Strong / Growing / New). */
export function bondBand(b: number): { label: string } {
  if (b >= 67) return { label: 'Strong' };
  if (b >= 34) return { label: 'Growing' };
  return { label: 'New' };
}

export const GROWTH_MILESTONES: {
  stage: GrowthStage;
  streak: number;
  pairedOnly?: boolean;
}[] = [
  { stage: 'egg', streak: 0 },
  { stage: 'sprout', streak: 7 },
  { stage: 'bud', streak: 30 },
  { stage: 'bloom', streak: 60 }, // solo maximum
  { stage: 'fullbloom', streak: 90, pairedOnly: true },
];

export const STAGE_META: Record<
  GrowthStage,
  { label: string; emoji: string; index: number }
> = {
  egg: { label: 'Egg', emoji: '🥚', index: 0 },
  sprout: { label: 'Sprout', emoji: '🌱', index: 1 },
  bud: { label: 'Bud', emoji: '🌿', index: 2 },
  bloom: { label: 'Bloom', emoji: '🌸', index: 3 },
  fullbloom: { label: 'Full Bloom', emoji: '🌼', index: 4 },
};

export function modeOf(keepers: Keeper[]): Mode {
  return keepers.length >= 2 ? 'paired' : 'solo';
}

export function isBloomed(state: BixiState): boolean {
  return state.bloomedAt != null;
}

/** current mood ceiling: 100 if paired or graduated, else the solo 70. */
export function ceilingFor(state: BixiState): number {
  if (modeOf(state.keepers) === 'paired') return MOOD.pairedCeiling;
  if (state.everReached100Streak) return MOOD.pairedCeiling; // graduated: keeps full ceiling solo
  return MOOD.soloCeiling;
}

export function clampMood(v: number, ceiling: number): number {
  return Math.max(0, Math.min(ceiling, v));
}

function hoursSince(t: number | null, now: number): number {
  if (t == null) return Infinity;
  return (now - t) / HOUR;
}

/** the most recent moment ANY keeper interacted (resets the dormant clock). */
export function lastAnySeen(state: BixiState): number | null {
  let last: number | null = null;
  for (const k of state.keepers) {
    if (k.lastSeenAt != null && (last == null || k.lastSeenAt > last))
      last = k.lastSeenAt;
  }
  return last;
}

/** is a specific keeper "present" (interacted within the sad window)? */
export function keeperPresent(k: Keeper, now: number): boolean {
  return hoursSince(k.lastSeenAt, now) < SAD_HOURS;
}

/** which keepers have drifted past the sad window */
export function driftedKeepers(state: BixiState, now: number): Keeper[] {
  return state.keepers.filter((k) => !keeperPresent(k, now));
}

/** derive the visual/mood state (Area 2 + Area 12). */
// Mood status is a straight band of the mood meter (0–100). Dormant is simply
// the lowest band — when the meter craters below 5 — so status always tracks
// the number. The one non-meter case kept is "sad" (paired, a keeper absent).
export function deriveMoodState(state: BixiState, _now: number): MoodState {
  // Mood follows the METERS only. A keeper being away no longer forces "sad" —
  // absence is conveyed by the miss banner + per-action dialog, not his mood.
  const m = state.mood; // 0.30·feed + 0.30·water + 0.40·avg bond
  if (m < 5) return 'dormant';
  if (m < 20) return 'wilting';
  if (m < 40) return 'drifting';
  if (m >= 65) return 'thriving';
  return 'content';
}

/** growth stage earned by a given (unbroken) streak, respecting pairing gates. */
export function stageForStreak(streak: number, paired: boolean): GrowthStage {
  let stage: GrowthStage = 'egg';
  for (const m of GROWTH_MILESTONES) {
    if (streak >= m.streak && (!m.pairedOnly || paired)) stage = m.stage;
  }
  return stage;
}

export function nextMilestone(streak: number) {
  return GROWTH_MILESTONES.find((m) => m.streak > streak) ?? null;
}

/** per-cycle mood budget for the whole pair/keeper (slow-gain cap). */
export function cycleBudgetPerKeeper(mode: Mode): number {
  return mode === 'paired'
    ? GAIN.pairedBudgetPerKeeper
    : GAIN.soloBudgetPerCycle;
}

/**
 * Lazily advance decay + neglect states based on wall-clock time.
 * Returns a partial patch to merge into state. Pure (no mutation).
 */
export function simulateElapsed(
  state: BixiState,
  now: number
): Partial<BixiState> {
  if (!state.createdAt) return {};
  const mode = modeOf(state.keepers);
  const patch: Partial<BixiState> = {};

  // --- vitals drain (continuous, IDEMPOTENT via vitalsUpdatedAt) — mirrors server ---
  const vFrom = state.vitalsUpdatedAt ?? state.createdAt;
  const vh = (now - vFrom) / HOUR;
  let feed = state.feed;
  let water = state.water;
  let keepers = state.keepers;
  if (vh > 0) {
    feed = Math.max(0, state.feed - (VITALS.feedDecayPerDay * vh) / 24);
    water = Math.max(0, state.water - (VITALS.waterDecayPerDay * vh) / 24);
    // bond decays only for a keeper who has drifted (>24h since seen)
    keepers = state.keepers.map((k) => {
      const inactive = k.lastSeenAt == null || now - k.lastSeenAt > 24 * HOUR;
      if (!inactive) return k;
      const bond = Math.max(0, (k.bond ?? VITALS.bondStart) - (VITALS.bondDecayPerDay * vh) / 24);
      return bond === k.bond ? k : { ...k, bond };
    });
    patch.feed = feed;
    patch.water = water;
    patch.vitalsUpdatedAt = now;
    if (keepers !== state.keepers) patch.keepers = keepers;
  }

  // --- derived wellbeing (the "mood"/Thriving number) ---
  const withVitals = { ...state, feed, water, keepers } as BixiState;
  const ceiling = ceilingFor(withVitals);
  const wellbeing = computeWellbeing(feed, water, keepers, ceiling);
  if (wellbeing !== state.mood) {
    patch.mood = wellbeing;
    patch.moodUpdatedAt = now;
  }

  // --- dormancy: STARVED (feed & water < 15) + neglect (solo >48h) / a keeper absent (paired) ---
  const lastSeen = lastAnySeen(withVitals) ?? state.createdAt;
  const neglectHours = hoursSince(lastSeen, now);
  const starved = feed < VITALS.starvedAt && water < VITALS.starvedAt;
  const drifted = driftedKeepers(withVitals, now);
  const dormantByTime =
    starved &&
    (mode === 'solo' ? neglectHours > DORMANT_HOURS.solo : drifted.length > 0);
  if (dormantByTime && !state.dormant) {
    patch.dormant = true;
    patch.revivePending = mode === 'paired' ? state.keepers.map((k) => k.id) : [];
  }

  // --- streak break: any keeper who hasn't acted (any action) in 30h → resets to 0 ---
  const anyStreakLapsed = state.keepers.some(
    (k) => hoursSince(k.lastSeenAt ?? state.createdAt, now) > 30
  );
  if (state.streak > 0 && anyStreakLapsed) {
    patch.streak = 0;
  }

  return patch;
}
