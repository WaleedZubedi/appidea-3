/**
 * Bixi domain model. Mirrors docs/DECISIONS.md.
 * NOTE: for this build the whole simulation runs client-side (Zustand + AsyncStorage).
 * Supabase/server-authoritative logic is stubbed for later (see src/lib/supabase.ts).
 */

export type Mode = 'solo' | 'paired';

/** Mood → visual state bands (Area 2). "sad" is the paired one-parent-absent case. */
export type MoodState =
  | 'dormant'
  | 'wilting'
  | 'drifting'
  | 'sad'
  | 'content'
  | 'thriving';

/** Growth ladder (Area 7). */
export type GrowthStage = 'egg' | 'sprout' | 'bud' | 'bloom' | 'fullbloom';

export type RelationshipKind = 'couple' | 'friends' | 'family' | null;

export interface Keeper {
  id: string;
  name: string; // display name / what Bixi calls them
  isSelf: boolean;
  /** epoch ms of this keeper's last streak-qualifying (daily) interaction */
  lastDailyAt: number | null;
  /** epoch ms of this keeper's last interaction of ANY kind (resets dormant clock) */
  lastSeenAt: number | null;
  /** this keeper's Bond (0–100) — their own relationship with Bixi (per-keeper) */
  bond: number;
  /** epoch ms of this keeper's last feed / water / pet — drives the 1h action cooldowns */
  lastFeedAt?: number | null;
  lastWaterAt?: number | null;
  lastPetAt?: number | null;
  /** epoch ms this keeper requested to leave (24h cooling-off); null = not leaving */
  leaveRequestedAt?: number | null;
  /** this keeper muted their partner (safety carve-out, immediate) */
  muted?: boolean;
}

/** A permanent interaction (Feed/Pet/Water + the growing library). */
export interface InteractionDef {
  key: string;
  label: string;
  emoji: string;
  /** reaction video key in assets/videos, if any */
  video?: 'feed' | 'water' | 'tap' | 'revive';
  /** Bixi's line on doing it */
  line: string;
  /** false = stubbed button, awaiting art/video (shows "soon") */
  available: boolean;
  /** shown in the core Home row (true) vs the "More" drawer (false) */
  isCore: boolean;
}

/** A rotating Interaction of the Day (Area 3) — the streak-keeper. */
export interface DailyInteractionDef {
  key: string;
  label: string;
  emoji: string;
  description: string; // "what it does" teaser
  line: string;
}

export interface JournalEntry {
  id: string;
  at: number;
  kind:
    | 'hatch'
    | 'bloom'
    | 'daily'
    | 'note'
    | 'milestone'
    | 'growth'
    | 'revive'
    | 'first';
  /** which keeper triggered it (id) */
  by?: string;
  /** field-note styled text */
  text: string;
  /** optional keeper note */
  note?: string;
  /** true = curated keepsake (Field notes); false = only in the Daily-log sub-tab */
  keepsake: boolean;
}

export interface BixiState {
  // identity
  pairId: string | null; // server pair id (online mode); null offline
  bixiName: string; // nickname, default "Bixi"
  bixiNameChangedAt: number | null; // last rename (epoch) — renameable once / 30 days
  relationshipKind: RelationshipKind;
  createdAt: number | null; // hatch time
  bloomedAt: number | null; // co-parent join time

  // keepers (1 = solo, 2 = paired)
  keepers: Keeper[];

  // meters
  mood: number; // 0..100 — DERIVED wellbeing (the "Thriving" headline) = f(feed,water,bond)
  moodUpdatedAt: number;
  feed: number; // 0..100 consumable vital
  water: number; // 0..100 consumable vital
  vitalsUpdatedAt: number; // last time vitals decay was settled
  growthStage: GrowthStage;

  // streak (rolling ~24h, activity-anchored, unforgiving)
  streak: number;
  bestStreak: number;
  totalCareDays: number;
  everReached100Streak: boolean; // "I'm okay with only you" permanent unlock

  // per-cycle interaction ledger (which interactions each keeper used this cycle)
  /** map keeperId -> { interactionKey -> epochMs used } */
  usedThisCycle: Record<string, Record<string, number>>;

  // life state
  dormant: boolean;
  revivePending: string[]; // keeper ids who still must pet to complete a both-drifted revive

  // rewards
  unlockedSecrets: string[]; // e.g. ['secret1' @80, 'dance' @90, 'companion']
  hasCompanion: boolean;

  // journal
  journal: JournalEntry[];

  // invite (co-parent)
  inviteCode: string | null;
  /** opaque server token backing the code — used for the QR / join link */
  inviteToken: string | null;
  inviteCreatedAt: number | null;

  // onboarding / meta
  onboarded: boolean;
  notificationsAsked: boolean;
}
