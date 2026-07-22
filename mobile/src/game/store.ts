/**
 * Bixi store (Zustand + AsyncStorage). Client-side simulation for this build.
 * A single device can still experience "paired" via dev partner-simulation actions
 * (setPartnerPresence / simulatePartnerReturn) — there's no real 2nd device yet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dailyForIndex } from './content/daily';
import { interactionByKey } from './content/interactions';
import {
  ceilingFor,
  computeWellbeing,
  DAY,
  driftedKeepers,
  GRADUATION_STREAK,
  HOUR,
  MOOD,
  modeOf,
  PENALTY,
  simulateElapsed,
  STAGE_META,
  stageForStreak,
  STREAK_WINDOW_HOURS,
  VITALS,
} from './engine';
import type {
  BixiState,
  GrowthStage,
  JournalEntry,
  Mode,
  RelationshipKind,
} from './types';

let _idc = 0;
const newId = () => `${Date.now().toString(36)}-${(_idc++).toString(36)}`;

interface Reaction {
  video?: 'feed' | 'water' | 'tap' | 'revive';
  line?: string;
  at: number;
}

interface Store extends BixiState {
  _hydrated: boolean;
  reaction: Reaction | null;
  lastStreakDayAt: number;
  /** this device's last-use epoch per action kind → drives the 60-min button cooldowns */
  actionAt: Record<string, number>;
  /** epoch this device last read the shared notes → drives the "left you a note" hint */
  notesReadAt: number;

  // lifecycle
  createBixi: (mode: Mode, name: string, kind: RelationshipKind) => void;
  hatch: () => void;
  reset: () => void;

  // care
  _applyGain: (
    keeperId: string,
    baseGain: number,
    usedKey: string,
    video?: 'feed' | 'water' | 'tap' | 'revive',
    line?: string,
    isDaily?: boolean
  ) => void;
  doInteraction: (key: string) => { ok: boolean; message?: string };
  doDaily: () => { ok: boolean; message?: string };
  leaveNote: (note: string) => void;
  revive: (keeperId?: string) => { ok: boolean; message?: string };

  // pairing (simulated)
  generateInvite: () => string;
  acceptCoParent: (partnerName: string) => void; // simulate the join → bloom

  // dev / presence simulation (single-device demo)
  setPartnerPresence: (present: boolean) => void;
  simulatePartnerReturn: () => void;

  // housekeeping
  tick: () => void;
  clearReaction: () => void;
  setNotificationsAsked: () => void;
  /** record that this device just used `kind` (starts its 60-min cooldown) */
  noteAction: (kind: string) => void;
  /** mark the shared notes as seen (clears the homepage hint) */
  markNotesRead: () => void;
  setBixiName: (name: string) => void;
}

function initialState(): BixiState {
  return {
    pairId: null,
    bixiName: 'Bixi',
    bixiNameChangedAt: null,
    relationshipKind: null,
    createdAt: null,
    bloomedAt: null,
    keepers: [],
    mood: MOOD.soloStart,
    moodUpdatedAt: Date.now(),
    feed: VITALS.hatchVital,
    water: VITALS.hatchVital,
    vitalsUpdatedAt: Date.now(),
    growthStage: 'egg',
    streak: 0,
    bestStreak: 0,
    totalCareDays: 0,
    everReached100Streak: false,
    usedThisCycle: {},
    dormant: false,
    revivePending: [],
    unlockedSecrets: [],
    hasCompanion: false,
    journal: [],
    inviteCode: null,
    inviteToken: null,
    inviteCreatedAt: null,
    onboarded: false,
    notificationsAsked: false,
  };
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++)
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `BIXI-${s}`;
}

function usedRecently(
  state: BixiState,
  keeperId: string,
  key: string,
  now: number
): boolean {
  const used = state.usedThisCycle[keeperId]?.[key];
  return used != null && now - used < STREAK_WINDOW_HOURS * HOUR;
}

function pushJournal(list: JournalEntry[], e: JournalEntry): JournalEntry[] {
  return [e, ...list].slice(0, 200);
}

export const useBixi = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),
      _hydrated: false,
      reaction: null,
      lastStreakDayAt: 0,
      actionAt: {},
      notesReadAt: 0,

      createBixi: (mode, name, kind) => {
        const now = Date.now();
        set({
          ...initialState(),
          bixiName: name?.trim() ? name.trim() : 'Bixi',
          relationshipKind: kind,
          keepers: [
            {
              id: 'self',
              name: 'You',
              isSelf: true,
              lastDailyAt: null,
              lastSeenAt: null,
              bond: VITALS.bondStart,
            },
          ],
          feed: VITALS.hatchVital,
          water: VITALS.hatchVital,
          vitalsUpdatedAt: now,
          mood: computeWellbeing(VITALS.hatchVital, VITALS.hatchVital, [
            { id: 'self', name: 'You', isSelf: true, lastDailyAt: null, lastSeenAt: null, bond: VITALS.bondStart },
          ], MOOD.soloCeiling),
          moodUpdatedAt: now,
          onboarded: true,
          inviteCode: mode === 'paired' ? makeCode() : null,
          inviteCreatedAt: mode === 'paired' ? now : null,
        });
      },

      hatch: () => {
        const now = Date.now();
        const s = get();
        if (s.createdAt) return;
        set({
          createdAt: now,
          moodUpdatedAt: now,
          keepers: s.keepers.map((k) => (k.isSelf ? { ...k, lastSeenAt: now } : k)),
          reaction: { video: undefined, line: 'Oh! …hello. You\'re my person.', at: now },
          journal: pushJournal(s.journal, {
            id: newId(),
            at: now,
            kind: 'hatch',
            text: 'Specimen Nº01 emerged. Day 001. Mint, alert, mildly dramatic.',
            keepsake: true,
          }),
        });
      },

      doInteraction: (key) => {
        const now = Date.now();
        const s = get();
        const def = interactionByKey(key);
        if (!def) return { ok: false, message: 'Unknown interaction' };
        if (!def.available)
          return { ok: false, message: `${def.label} is coming soon.` };

        // dormant → this counts as a revive pet, not a normal interaction
        if (s.dormant) return get().revive('self');

        const mode = modeOf(s.keepers);
        // paired gentle refusal: won't fully accept care while the other is long gone
        const drifted = driftedKeepers(s, now);
        if (mode === 'paired' && drifted.some((k) => k.isSelf === false)) {
          // he's sad; still let the present keeper interact but note it
        }
        if (usedRecently(s, 'self', key, now))
          return { ok: false, message: `Already did that today ✓` };

        // feed / water refill their vital; everything else builds Bond (a pet)
        if (key === 'feed' || key === 'water') {
          const ceiling = ceilingFor(s);
          const feed = key === 'feed' ? Math.min(100, s.feed + VITALS.feedRefill) : s.feed;
          const water = key === 'water' ? Math.min(100, s.water + VITALS.waterRefill) : s.water;
          const keepers = s.keepers.map((k) => (k.isSelf ? { ...k, lastSeenAt: now } : k));
          const usedMap = { ...(s.usedThisCycle['self'] ?? {}), [key]: now };
          set({
            feed,
            water,
            vitalsUpdatedAt: now,
            mood: computeWellbeing(feed, water, keepers, ceiling),
            moodUpdatedAt: now,
            keepers,
            usedThisCycle: { ...s.usedThisCycle, self: usedMap },
            reaction: { video: def.video, line: def.line, at: now },
          });
          return { ok: true };
        }

        get()._applyGain('self', VITALS.bondPet, key, def.video, def.line);
        return { ok: true };
      },

      doDaily: () => {
        const now = Date.now();
        const s = get();
        if (s.dormant) return get().revive('self');
        if (usedRecently(s, 'self', '__daily__', now))
          return { ok: false, message: "You've done today's interaction ✓" };

        const daily = dailyForIndex(Math.floor(now / DAY));
        get()._applyGain('self', VITALS.bondDaily, '__daily__', undefined, daily.line, true);
        return { ok: true };
      },

      // internal-ish: apply a BOND gain (+ streak/growth on the daily), recompute wellbeing.
      _applyGain: (
        keeperId: string,
        bondGain: number,
        usedKey: string,
        video?: 'feed' | 'water' | 'tap' | 'revive',
        line?: string,
        isDaily?: boolean
      ) => {
        const now = Date.now();
        get().tick(); // settle vitals/state first
        const s = get();
        const mode = modeOf(s.keepers);
        const ceiling = ceilingFor(s);
        const usedMap = { ...(s.usedThisCycle[keeperId] ?? {}) };
        const me = s.keepers.find((k) => k.id === keeperId);

        // update keeper: bond gain (with a one-time -10 penalty if returning after >24h absence)
        const keepers = s.keepers.map((k) => {
          if (k.id !== keeperId) return k;
          let bond = k.bond ?? VITALS.bondStart;
          if (mode === 'paired' && k.lastSeenAt != null && now - k.lastSeenAt > 24 * HOUR) {
            bond = Math.max(0, bond - PENALTY.sad); // bond_absence_penalty
          }
          bond = Math.min(VITALS.bondMax, bond + bondGain);
          return { ...k, bond, lastSeenAt: now, lastDailyAt: isDaily ? now : k.lastDailyAt };
        });

        usedMap[usedKey] = now;
        const nextMood = computeWellbeing(s.feed, s.water, keepers, ceiling);

        const patch: Partial<Store> = {
          mood: nextMood,
          moodUpdatedAt: now,
          keepers,
          usedThisCycle: { ...s.usedThisCycle, [keeperId]: usedMap },
          reaction: { video, line, at: now },
        };

        // streak advance on the daily
        if (isDaily) {
          const withKeepers = { ...s, keepers } as BixiState;
          const complete =
            mode === 'solo'
              ? true
              : withKeepers.keepers.every(
                  (k) => k.lastDailyAt != null && now - k.lastDailyAt < STREAK_WINDOW_HOURS * HOUR
                );
          const newCycle = now - s.lastStreakDayAt > 20 * HOUR;
          if (complete && newCycle) {
            const streak = s.streak + 1;
            patch.streak = streak;
            patch.bestStreak = Math.max(s.bestStreak, streak);
            patch.totalCareDays = s.totalCareDays + 1;
            patch.lastStreakDayAt = now;

            // growth (permanent, unbroken-streak gated)
            const paired = mode === 'paired';
            const earned = stageForStreak(streak, paired);
            if (STAGE_META[earned].index > STAGE_META[s.growthStage].index) {
              patch.growthStage = earned;
              patch.journal = pushJournal(s.journal, {
                id: newId(),
                at: now,
                kind: 'growth',
                text: `Growth stage reached: ${STAGE_META[earned].label} ${STAGE_META[earned].emoji} (Day ${streak} streak).`,
                keepsake: true,
              });
              if (earned === 'fullbloom') {
                patch.hasCompanion = true;
                patch.unlockedSecrets = Array.from(
                  new Set([...s.unlockedSecrets, 'companion'])
                );
              }
            }
            // graduation
            if (streak >= GRADUATION_STREAK && paired && !s.everReached100Streak) {
              patch.everReached100Streak = true;
            }
          }
          // daily journal (keepsake) + daily-log
          const daily = dailyForIndex(Math.floor(now / DAY));
          patch.journal = pushJournal(patch.journal ?? s.journal, {
            id: newId(),
            at: now,
            kind: 'daily',
            by: keeperId,
            text: `${me?.name ?? 'A keeper'} shared today's moment — ${daily.label} ${daily.emoji}.`,
            keepsake: true,
          });
        }

        // secret unlocks by mood
        const secrets = new Set(patch.unlockedSecrets ?? s.unlockedSecrets);
        if (nextMood >= MOOD.secretAt) secrets.add('secret1');
        if (nextMood >= MOOD.danceAt) secrets.add('dance');
        patch.unlockedSecrets = Array.from(secrets);

        set(patch as Partial<Store>);
      },

      leaveNote: (note) => {
        const now = Date.now();
        const s = get();
        if (!note.trim()) return;
        set({
          journal: pushJournal(s.journal, {
            id: newId(),
            at: now,
            kind: 'note',
            by: 'self',
            text: 'A note was pressed into the journal.',
            note: note.trim(),
            keepsake: true,
          }),
        });
      },

      revive: (keeperId = 'self') => {
        const now = Date.now();
        const s = get();
        if (!s.dormant) return { ok: false, message: 'Bixi is awake.' };
        const mode = modeOf(s.keepers);

        let pending = s.revivePending.filter((id) => id !== keeperId);
        const keepers = s.keepers.map((k) =>
          k.id === keeperId ? { ...k, lastSeenAt: now } : k
        );

        if (mode === 'paired' && pending.length > 0) {
          // still need the other keeper
          const waitingFor = s.keepers.find((k) => k.id === pending[0]);
          set({ revivePending: pending, keepers });
          return {
            ok: false,
            message: `Bixi stirs… but he won't fully wake until ${
              waitingFor?.name ?? 'your person'
            } comes back too.`,
          };
        }

        // complete revive — he comes back starving (vitals floored to the revive level)
        const ceiling = ceilingFor(s);
        const feed = Math.max(s.feed, VITALS.reviveVital);
        const water = Math.max(s.water, VITALS.reviveVital);
        set({
          dormant: false,
          revivePending: [],
          keepers,
          feed,
          water,
          vitalsUpdatedAt: now,
          mood: computeWellbeing(feed, water, keepers, ceiling),
          moodUpdatedAt: now,
          reaction: { video: 'revive', line: 'You came back. You came *back*.', at: now },
          journal: pushJournal(s.journal, {
            id: newId(),
            at: now,
            kind: 'revive',
            text: 'Revived. He blinked, then bloomed back toward the light.',
            keepsake: true,
          }),
        });
        return { ok: true };
      },

      generateInvite: () => {
        const code = makeCode();
        set({ inviteCode: code, inviteCreatedAt: Date.now() });
        return code;
      },

      acceptCoParent: (partnerName) => {
        const now = Date.now();
        const s = get();
        if (s.keepers.length >= 2) return;
        const name = partnerName?.trim() || 'Your person';
        const ceiling = MOOD.pairedCeiling;
        const keepers = [
          ...s.keepers,
          {
            id: 'partner',
            name,
            isSelf: false,
            lastDailyAt: null,
            lastSeenAt: now, // they just joined → present
            bond: VITALS.bondStart,
          },
        ];
        const feed = Math.max(s.feed, VITALS.bloomVital);
        const water = Math.max(s.water, VITALS.bloomVital);
        set({
          keepers,
          feed,
          water,
          vitalsUpdatedAt: now,
          bloomedAt: now,
          inviteCode: null,
          mood: computeWellbeing(feed, water, keepers, ceiling),
          moodUpdatedAt: now,
          reaction: { video: undefined, line: 'There are two of you now. I can feel it 🌸', at: now },
          journal: pushJournal(s.journal, {
            id: newId(),
            at: now,
            kind: 'bloom',
            text: `${name} joined. Bixi bloomed — the second keeper has arrived.`,
            keepsake: true,
          }),
        });
      },

      setPartnerPresence: (present) => {
        const now = Date.now();
        const s = get();
        set({
          keepers: s.keepers.map((k) =>
            k.isSelf
              ? k
              : { ...k, lastSeenAt: present ? now : now - 2 * DAY }
          ),
        });
        get().tick();
      },

      simulatePartnerReturn: () => {
        const s = get();
        if (s.dormant) {
          get().revive('partner');
        } else {
          get().setPartnerPresence(true);
        }
      },

      tick: () => {
        const now = Date.now();
        const s = get();
        if (!s.createdAt) return;
        const patch = simulateElapsed(s, now);
        if (Object.keys(patch).length) set(patch as Partial<Store>);
      },

      clearReaction: () => set({ reaction: null }),
      setNotificationsAsked: () => set({ notificationsAsked: true }),
      noteAction: (kind) => set((s) => ({ actionAt: { ...s.actionAt, [kind]: Date.now() } })),
      markNotesRead: () => set({ notesReadAt: Date.now() }),
      setBixiName: (name) => {
        const clean = name.trim().slice(0, 20);
        if (clean) set({ bixiName: clean, bixiNameChangedAt: Date.now() });
      },
      reset: () => set({ ...initialState(), reaction: null, lastStreakDayAt: 0, actionAt: {}, notesReadAt: 0 }),
    }),
    {
      name: 'bixi-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { _hydrated, reaction, ...rest } = s as Store;
        void _hydrated;
        void reaction;
        return rest as Store;
      },
      onRehydrateStorage: () => (state) => {
        state?.tick?.();
        useBixi.setState({ _hydrated: true });
      },
    }
  )
);
