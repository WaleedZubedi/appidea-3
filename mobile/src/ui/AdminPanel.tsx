/**
 * TEMPORARY dev tool — a full control panel for testing the Bixi simulation.
 * Manipulate time (age the pet), set meters/streak/growth, toggle states, and
 * simulate pairing. Everything drives the REAL local store + engine (so vitals
 * decay, dormancy, and streak windows all behave), then re-runs simulateElapsed
 * via tick(). Offline demo only — when IS_ONLINE, the server hydrate can
 * overwrite these edits. Remove before shipping (see AdminPanel mount in DevReset).
 */
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { IS_ONLINE } from '@/lib/config';
import { useBixi } from '@/game/store';
import { useDev } from '@/game/devStore';
import { onlineDevSetState } from '@/game/sync';
import type { DevPatch } from '@/lib/api';
import {
  ceilingFor,
  computeWellbeing,
  DAY,
  deriveMoodState,
  HOUR,
  modeOf,
  STAGE_META,
  stageForStreak,
  VITALS,
} from '@/game/engine';
import type { GrowthStage } from '@/game/types';

const BG = '#1c130b';
const CARD = 'rgba(245,239,227,0.05)';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const LINE = 'rgba(245,239,227,0.14)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';
const BLUE = '#63a9d6';
const FEEDC = '#e0a94a';
const PINK = '#e090b5';
const BRICK = '#ff8a7a';

const STAGES: GrowthStage[] = ['egg', 'sprout', 'bud', 'bloom', 'fullbloom'];

/* ── dependency-free slider (core PanResponder — no native rebuild) ──
   onChange fires live while dragging (used offline to write the store live);
   onCommit fires once on release (used online to write the server just once,
   avoiding an RPC per drag tick). An internal drag value keeps it smooth in
   both modes regardless of when the source value updates. */
function Slider({
  value, min, max, step = 1, color = ACCENT, onChange, onCommit,
}: {
  value: number; min: number; max: number; step?: number; color?: string;
  onChange?: (v: number) => void; onCommit?: (v: number) => void;
}) {
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const wRef = useRef(1);
  wRef.current = w;
  const lastRef = useRef(value);
  const cfg = useRef({ min, max, step, onChange, onCommit });
  cfg.current = { min, max, step, onChange, onCommit };

  const compute = (x: number) => {
    const c = cfg.current;
    const width = wRef.current || 1;
    const r = Math.max(0, Math.min(1, x / width));
    let v = c.min + r * (c.max - c.min);
    v = Math.round(v / c.step) * c.step;
    return Math.max(c.min, Math.min(c.max, v));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { const v = compute(e.nativeEvent.locationX); lastRef.current = v; setDrag(v); cfg.current.onChange?.(v); },
      onPanResponderMove: (e) => { const v = compute(e.nativeEvent.locationX); lastRef.current = v; setDrag(v); cfg.current.onChange?.(v); },
      onPanResponderRelease: () => { const v = lastRef.current; setDrag(null); cfg.current.onCommit?.(v); },
      onPanResponderTerminate: () => setDrag(null),
    })
  ).current;

  const shown = drag ?? value;
  const ratio = max > min ? (Math.max(min, Math.min(max, shown)) - min) / (max - min) : 0;
  return (
    <View
      style={styles.track}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
    >
      <View style={styles.trackBar} pointerEvents="none" />
      <View style={[styles.trackFill, { width: ratio * w, backgroundColor: color }]} pointerEvents="none" />
      <View style={[styles.thumb, { left: ratio * w - 11, borderColor: color }]} pointerEvents="none" />
    </View>
  );
}

function Chip({ label, onPress, tone = 'default' }: { label: string; onPress: () => void; tone?: 'default' | 'good' | 'danger' }) {
  const c = tone === 'danger' ? BRICK : tone === 'good' ? LEAF : CREAM;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { borderColor: c + '55' }, pressed && { backgroundColor: c + '18' }]}
    >
      <Text style={[styles.chipTxt, { color: c }]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/* ── store manipulation helpers (all read fresh state) ── */
const recomputeMood = (patchKeepers?: any) => {
  const s = useBixi.getState();
  const keepers = patchKeepers ?? s.keepers;
  return {
    mood: computeWellbeing(s.feed, s.water, keepers, ceilingFor(s)),
    moodUpdatedAt: Date.now(),
  };
};

function advanceTime(ms: number) {
  const s = useBixi.getState();
  const sh = (t?: number | null) => (t == null || t === 0 ? t : t - ms);
  const keepers = s.keepers.map((k) => ({
    ...k,
    lastSeenAt: sh(k.lastSeenAt),
    lastDailyAt: sh(k.lastDailyAt),
    lastFeedAt: sh(k.lastFeedAt),
    lastWaterAt: sh(k.lastWaterAt),
    lastPetAt: sh(k.lastPetAt),
  }));
  const usedThisCycle: Record<string, Record<string, number>> = {};
  for (const [kid, m] of Object.entries(s.usedThisCycle)) {
    const nm: Record<string, number> = {};
    for (const [key, t] of Object.entries(m)) nm[key] = (t as number) - ms;
    usedThisCycle[kid] = nm;
  }
  useBixi.setState({
    createdAt: sh(s.createdAt) ?? s.createdAt,
    bloomedAt: sh(s.bloomedAt) ?? null,
    moodUpdatedAt: sh(s.moodUpdatedAt) ?? Date.now(),
    vitalsUpdatedAt: sh(s.vitalsUpdatedAt) ?? Date.now(),
    inviteCreatedAt: sh(s.inviteCreatedAt) ?? null,
    lastStreakDayAt: sh(s.lastStreakDayAt) ?? 0,
    keepers,
    usedThisCycle,
  } as any);
  useBixi.getState().tick();
}

export function AdminPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useBixi();
  const now = Date.now();

  const [hours, setHours] = useState(6);
  const [days, setDays] = useState(1);

  const self = s.keepers.find((k) => k.isSelf);
  const partner = s.keepers.find((k) => !k.isSelf);
  const paired = modeOf(s.keepers) === 'paired';
  const day = s.createdAt ? Math.floor((now - s.createdAt) / DAY) + 1 : 0;
  const moodState = s.createdAt ? deriveMoodState(s, now) : 'egg';
  const bond = Math.round(self?.bond ?? 0);
  const dailyDone = self?.lastDailyAt != null && now - self.lastDailyAt < DAY;
  const bothHere = useDev((d) => d.bothHere);

  // Online → write to the server (realtime syncs BOTH parents). Offline → mutate
  // the local store. `dual` picks the right path per action.
  const push = (p: DevPatch) => { void onlineDevSetState(p); };
  const dual = (p: DevPatch, local: () => void) => { if (IS_ONLINE) push(p); else local(); };

  // Time travel: server (online) or local store (offline) shifts all game
  // timestamps; the per-device action cooldowns are client-only, so shift them
  // here too so the 60-min button locks also follow the skip.
  const doAdvance = (ms: number) => {
    const at = useBixi.getState().actionAt ?? {};
    const shifted: Record<string, number> = {};
    for (const [k, v] of Object.entries(at)) shifted[k] = v - ms;
    useBixi.setState({ actionAt: shifted });
    if (IS_ONLINE) push({ advanceMs: ms }); else advanceTime(ms);
  };

  const setFeed = (v: number) => {
    const st = useBixi.getState();
    useBixi.setState({ feed: v, vitalsUpdatedAt: Date.now(), ...recomputeMood(st.keepers) });
  };
  const setWater = (v: number) => {
    const st = useBixi.getState();
    useBixi.setState({ water: v, vitalsUpdatedAt: Date.now(), ...recomputeMood(st.keepers) });
  };
  const setBond = (v: number) => {
    const st = useBixi.getState();
    const keepers = st.keepers.map((k) => (k.isSelf ? { ...k, bond: v } : k));
    useBixi.setState({ keepers, ...recomputeMood(keepers) });
  };
  const setStreak = (n: number) => {
    const st = useBixi.getState();
    useBixi.setState({
      streak: n,
      bestStreak: Math.max(st.bestStreak, n),
      growthStage: stageForStreak(n, modeOf(st.keepers) === 'paired'),
    });
  };
  const setStage = (stage: GrowthStage) => useBixi.setState({ growthStage: stage });

  const toggleDormant = () => {
    const st = useBixi.getState();
    if (st.dormant) {
      const t = Date.now();
      const keepers = st.keepers.map((k) => ({ ...k, lastSeenAt: t }));
      useBixi.setState({ dormant: false, revivePending: [], keepers, vitalsUpdatedAt: t, ...recomputeMood(keepers) });
    } else {
      useBixi.setState({ dormant: true });
    }
  };

  const setDaily = (done: boolean) => {
    const st = useBixi.getState();
    const t = Date.now();
    const keepers = st.keepers.map((k) => (k.isSelf ? { ...k, lastDailyAt: done ? t : null, lastSeenAt: done ? t : k.lastSeenAt } : k));
    const selfUsed = { ...(st.usedThisCycle['self'] ?? {}) };
    if (done) selfUsed['__daily__'] = t;
    else delete selfUsed['__daily__'];
    useBixi.setState({ keepers, usedThisCycle: { ...st.usedThisCycle, self: selfUsed } });
  };

  const clearCooldowns = () => {
    const st = useBixi.getState();
    const keepers = st.keepers.map((k) => ({ ...k, lastFeedAt: null, lastWaterAt: null, lastPetAt: null }));
    useBixi.setState({ keepers, usedThisCycle: {} });
  };

  const addPartner = () => {
    if (partner) return;
    useBixi.getState().acceptCoParent('Maya');
  };
  const removePartner = () => {
    const st = useBixi.getState();
    useBixi.setState({ keepers: st.keepers.filter((k) => k.isSelf), bloomedAt: null });
  };

  const reHatch = () => {
    const st = useBixi.getState();
    st.reset();
    useBixi.getState().createBixi('solo', 'Bixi', null);
    useBixi.getState().hatch();
  };
  const hardReset = () => {
    useBixi.getState().reset();
    onClose();
    router.replace('/onboarding/intro');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: '92%' }]}>
          <View style={styles.grip} />
          <View style={styles.headRow}>
            <Text style={styles.title}>⚙︎ Admin control panel</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>Done</Text>
            </Pressable>
          </View>

          {/* live snapshot */}
          <View style={styles.readout}>
            <Stat label="Day" value={String(day)} />
            <Stat label="Streak" value={String(s.streak)} color={ACCENT} />
            <Stat label="Feed" value={`${Math.round(s.feed)}%`} color={FEEDC} />
            <Stat label="Water" value={`${Math.round(s.water)}%`} color={BLUE} />
            <Stat label="Bond" value={`${bond}%`} color={PINK} />
            <Stat label="Mood" value={String(moodState)} color={moodState === 'dormant' ? DIM : LEAF} />
          </View>

          <Text style={[styles.mode, { color: IS_ONLINE ? LEAF : FEEDC }]}>
            {IS_ONLINE ? '🟢 Online — changes sync live to both parents' : '🟡 Offline — local device only'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {/* ── TIME ── */}
            <Section title="TIME TRAVEL">
              <View style={styles.chipWrap}>
                {[['+1h', HOUR], ['+3h', 3 * HOUR], ['+6h', 6 * HOUR], ['+12h', 12 * HOUR], ['+1d', DAY], ['+3d', 3 * DAY], ['+7d', 7 * DAY]].map(
                  ([lbl, ms]) => <Chip key={lbl as string} label={lbl as string} onPress={() => doAdvance(ms as number)} />
                )}
              </View>
              <Text style={styles.rowLabel}>Hours: <Text style={styles.rowVal}>{hours}h</Text></Text>
              <Slider value={hours} min={0} max={72} step={1} color={ACCENT} onChange={setHours} />
              <Text style={styles.rowLabel}>Days: <Text style={styles.rowVal}>{days}d</Text></Text>
              <Slider value={days} min={0} max={30} step={1} color={ACCENT} onChange={setDays} />
              <View style={styles.chipWrap}>
                <Chip label={`▶ Advance ${days}d ${hours}h`} tone="good" onPress={() => doAdvance(days * DAY + hours * HOUR)} />
              </View>
              <Text style={styles.hint}>Ages the pet by shifting timestamps back, then re-runs decay/dormancy/streak{IS_ONLINE ? ' — on the server, for both parents' : ''}.</Text>
            </Section>

            {/* ── METERS ── */}
            <Section title="METERS">
              <Text style={styles.rowLabel}>Feed: <Text style={[styles.rowVal, { color: FEEDC }]}>{Math.round(s.feed)}%</Text></Text>
              <Slider value={s.feed} min={0} max={100} step={1} color={FEEDC}
                onChange={IS_ONLINE ? undefined : setFeed} onCommit={IS_ONLINE ? (v) => push({ feed: v }) : undefined} />
              <Text style={styles.rowLabel}>Water: <Text style={[styles.rowVal, { color: BLUE }]}>{Math.round(s.water)}%</Text></Text>
              <Slider value={s.water} min={0} max={100} step={1} color={BLUE}
                onChange={IS_ONLINE ? undefined : setWater} onCommit={IS_ONLINE ? (v) => push({ water: v }) : undefined} />
              <Text style={styles.rowLabel}>Bond (shared): <Text style={[styles.rowVal, { color: PINK }]}>{bond}%</Text></Text>
              <Slider value={bond} min={0} max={100} step={1} color={PINK}
                onChange={IS_ONLINE ? undefined : setBond} onCommit={IS_ONLINE ? (v) => push({ bond: v }) : undefined} />
              <View style={styles.chipWrap}>
                <Chip label="Fill all" tone="good" onPress={() => dual({ feed: 100, water: 100, bond: 100 }, () => { setFeed(100); setWater(100); setBond(100); })} />
                <Chip label="Drain all" onPress={() => dual({ feed: 8, water: 8, bond: 10 }, () => { setFeed(8); setWater(8); setBond(10); })} />
                <Chip label="Reset to hatch" onPress={() => dual({ feed: VITALS.hatchVital, water: VITALS.hatchVital, bond: VITALS.bondStart }, () => { setFeed(VITALS.hatchVital); setWater(VITALS.hatchVital); setBond(VITALS.bondStart); })} />
              </View>
            </Section>

            {/* ── STREAK & GROWTH ── */}
            <Section title="STREAK & GROWTH">
              <Text style={styles.rowLabel}>Streak: <Text style={[styles.rowVal, { color: ACCENT }]}>{s.streak} days</Text></Text>
              <Slider value={s.streak} min={0} max={120} step={1} color={ACCENT}
                onChange={IS_ONLINE ? undefined : setStreak} onCommit={IS_ONLINE ? (v) => push({ streak: v }) : undefined} />
              <View style={styles.chipWrap}>
                {[0, 3, 7, 14, 30, 100].map((n) => <Chip key={n} label={`${n}`} onPress={() => dual({ streak: n }, () => setStreak(n))} />)}
              </View>
              <Text style={styles.rowLabel}>Growth stage</Text>
              <View style={styles.chipWrap}>
                {STAGES.map((st) => (
                  <Chip
                    key={st}
                    label={`${STAGE_META[st].emoji} ${STAGE_META[st].label}${s.growthStage === st ? ' ✓' : ''}`}
                    tone={s.growthStage === st ? 'good' : 'default'}
                    onPress={() => dual({ growth: st }, () => setStage(st))}
                  />
                ))}
              </View>
            </Section>

            {/* ── STATE ── */}
            <Section title="STATE">
              <View style={styles.chipWrap}>
                <Chip
                  label={s.mood < 5 ? '☀︎ Revive (fill meters)' : '💤 Crash to dormant'}
                  tone={s.mood < 5 ? 'good' : 'danger'}
                  onPress={() => s.mood < 5
                    ? dual({ feed: 95, water: 95, bond: 60 }, () => { setFeed(95); setWater(95); setBond(60); })
                    : dual({ feed: 2, water: 2, bond: 2 }, () => { setFeed(2); setWater(2); setBond(2); })}
                />
                <Chip label={dailyDone ? '↺ Undo daily' : '✨ Mark daily done'} onPress={() => dual({ daily: dailyDone ? 'undone' : 'done' }, () => setDaily(!dailyDone))} />
                <Chip label="Clear cooldowns" onPress={() => dual({ clearCooldowns: true }, clearCooldowns)} />
              </View>
            </Section>

            {/* ── PRESENCE ── */}
            <Section title="PRESENCE">
              <Text style={styles.hint}>Force the two-people icon to show both keepers live (local visual — no server write).</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label={bothHere ? '👥 Both here: ON' : '👥 Both here: OFF'}
                  tone={bothHere ? 'good' : 'default'}
                  onPress={() => useDev.getState().setBothHere(!bothHere)}
                />
              </View>
            </Section>

            {/* ── PAIRING (offline sim only) ── */}
            {!IS_ONLINE && (
              <Section title="PAIRING (simulated)">
                <Text style={styles.hint}>Mode: <Text style={styles.rowVal}>{paired ? `paired with ${partner?.name}` : 'solo'}</Text></Text>
                <View style={styles.chipWrap}>
                  {!paired
                    ? <Chip label="＋ Add partner (bloom)" tone="good" onPress={addPartner} />
                    : <Chip label="✕ Remove partner" tone="danger" onPress={removePartner} />}
                  {paired && <Chip label="Partner is here" onPress={() => useBixi.getState().setPartnerPresence(true)} />}
                  {paired && <Chip label="Partner away 2d" onPress={() => useBixi.getState().setPartnerPresence(false)} />}
                  {paired && <Chip label="Simulate return" onPress={() => useBixi.getState().simulatePartnerReturn()} />}
                </View>
              </Section>
            )}
            {IS_ONLINE && (
              <Section title="PAIRING">
                <Text style={styles.hint}>Mode: <Text style={styles.rowVal}>{paired ? `paired with ${partner?.name}` : 'solo'}</Text>. Online pairing is real — use invite codes, not the simulator.</Text>
              </Section>
            )}

            {/* ── DANGER ── */}
            <Section title="DANGER ZONE">
              <View style={styles.chipWrap}>
                {!IS_ONLINE && <Chip label="Reset & re-hatch (solo)" onPress={reHatch} />}
                <Chip label="Hard reset → onboarding" tone="danger" onPress={hardReset} />
              </View>
            </Section>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value, color = CREAM }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(6,4,2,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 10,
    borderWidth: 1, borderColor: LINE,
  },
  grip: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,239,227,0.25)', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: CREAM },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,239,227,0.1)', borderWidth: 1, borderColor: LINE },
  closeTxt: { fontFamily: fonts.sansSemibold, fontSize: 13, color: CREAM },

  readout: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6,
    padding: 10, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE,
  },
  mode: { fontFamily: fonts.sansSemibold, fontSize: 12, marginTop: 8, marginBottom: 2 },
  stat: { minWidth: 62, flexGrow: 1, alignItems: 'center' },
  statVal: { fontFamily: fonts.mono, fontSize: 16, color: CREAM },
  statLabel: { fontFamily: fonts.sansSemibold, fontSize: 10, letterSpacing: 0.6, marginTop: 2, textTransform: 'uppercase' },

  section: { marginTop: 16 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.2, color: ACCENT, marginBottom: 8 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 13, color: DIM, marginTop: 8 },
  rowVal: { fontFamily: fonts.mono, color: CREAM },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, color: 'rgba(245,239,227,0.4)', marginTop: 8, lineHeight: 16 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(245,239,227,0.03)' },
  chipTxt: { fontFamily: fonts.sansSemibold, fontSize: 13 },

  track: { height: 34, justifyContent: 'center', marginTop: 4 },
  trackBar: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(245,239,227,0.16)' },
  trackFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3 },
  thumb: { position: 'absolute', top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#221a12', borderWidth: 2 },
});
