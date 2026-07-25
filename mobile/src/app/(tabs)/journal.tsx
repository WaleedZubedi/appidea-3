import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { DAY, STAGE_META } from '@/game/engine';
import { useBixi } from '@/game/store';
import { IS_ONLINE } from '@/lib/config';
import { fetchJournal, subscribeToPair } from '@/lib/api';
import { ActionGlyph } from '@/ui/actionIcon';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.4)';
const LINE = 'rgba(245,239,227,0.12)';
const CARD = 'rgba(245,239,227,0.05)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (ms: number) => { const d = new Date(ms); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

const KIND_META: Record<string, { emoji: string; color: string; verb: string }> = {
  water: { emoji: '💧', color: '#63a9d6', verb: 'watered' },
  feed: { emoji: '🍽️', color: '#e0a94a', verb: 'fed' },
  pet: { emoji: '🫶', color: '#e090b5', verb: 'petted' },
  shower: { emoji: '🚿', color: '#5cc0b4', verb: 'showered' },
  books: { emoji: '📖', color: '#c9a2e0', verb: 'read to' },
  stretch: { emoji: '🧘', color: '#8fcf9a', verb: 'stretched with' },
  scroll: { emoji: '📱', color: '#7fa8d0', verb: 'scrolled with' },
  sun: { emoji: '☀️', color: '#f0c94a', verb: 'sunbathed with' },
  daily: { emoji: '✨', color: ACCENT, verb: 'did the ritual with' },
};

const MILE_META: Record<string, { glyph: string; title: (d: string | null) => string }> = {
  bloom: { glyph: '🌸', title: () => 'Bloomed — a second keeper joined' },
  growth: { glyph: '🌿', title: (d) => `Grew into a ${d ?? 'new stage'}` },
  revive: { glyph: '↺', title: () => 'Woke from dormancy' },
  milestone: { glyph: '★', title: (d) => d ?? 'A milestone' },
};

type CareEvent = { id: string; profile_id: string; kind: string; is_daily: boolean; created_at: string };
type Milestone = { id: string; kind: string; detail: string | null; created_at: string };

const heatColor = (c: number) => {
  if (c <= 0) return 'rgba(245,239,227,0.07)';
  if (c === 1) return 'rgba(127,192,122,0.3)';
  if (c <= 3) return 'rgba(127,192,122,0.55)';
  if (c <= 6) return 'rgba(127,192,122,0.8)';
  return LEAF;
};

export default function Journal() {
  const s = useBixi();
  const now = Date.now();
  const [data, setData] = useState<{ events: CareEvent[]; milestones: Milestone[] }>({ events: [], milestones: [] });
  const [calOpen, setCalOpen] = useState(false);
  const [tab, setTab] = useState<'daily' | 'field'>('daily');
  const [openDays, setOpenDays] = useState<Set<number>>(new Set());
  const inited = useRef(false);

  useEffect(() => {
    if (!IS_ONLINE || !s.pairId) return;
    const pid = s.pairId;
    let alive = true;
    const load = () => { fetchJournal(pid).then((d) => { if (alive) setData(d as any); }).catch(() => {}); };
    load();
    // any care action updates bixi_state → refetch → the today card fills in live
    const ch = subscribeToPair(pid, load);
    return () => { alive = false; void ch.unsubscribe(); };
  }, [s.pairId]);

  const toggleDay = (d: number) =>
    setOpenDays((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const nameOf = (pid: string) => {
    const k = s.keepers.find((x) => x.id === pid);
    if (!k) return 'Someone';
    if (k.isSelf) return 'You';
    return k.name && k.name !== 'Your person' ? k.name.charAt(0).toUpperCase() + k.name.slice(1) : 'Your person';
  };

  const day = s.createdAt ? Math.floor((now - s.createdAt) / DAY) + 1 : 1;
  const stage = STAGE_META[s.growthStage];

  const dayCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of data.events) {
      const d = Math.floor(new Date(e.created_at).getTime() / DAY);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [data.events]);

  const cal = useMemo(() => {
    const today = Math.floor(now / DAY);
    const cells: { day: number; count: number }[] = [];
    for (let i = 15; i >= 0; i--) cells.push({ day: today - i, count: dayCounts.get(today - i) ?? 0 });
    return cells;
  }, [dayCounts, now]);

  const dailyGroups = useMemo(() => {
    const byDay = new Map<number, { count: number; actors: Map<string, Set<string>> }>();
    for (const e of data.events) {
      const d = Math.floor(new Date(e.created_at).getTime() / DAY);
      if (!byDay.has(d)) byDay.set(d, { count: 0, actors: new Map() });
      const g = byDay.get(d)!;
      g.count++;
      const kind = e.is_daily ? 'daily' : e.kind;
      if (!g.actors.has(e.profile_id)) g.actors.set(e.profile_id, new Set());
      g.actors.get(e.profile_id)!.add(kind);
    }
    return [...byDay.entries()].sort((a, b) => b[0] - a[0]);
  }, [data.events]);

  const dayLabel = (d: number) => {
    const n = Math.floor(now / DAY) - d;
    if (n <= 0) return 'Today';
    return `${n} day${n === 1 ? '' : 's'} ago`;
  };

  // open the most recent day by default (once)
  useEffect(() => {
    if (!inited.current && dailyGroups.length) { inited.current = true; setOpenDays(new Set([dailyGroups[0][0]])); }
  }, [dailyGroups]);

  const fieldNotes = useMemo(
    () => data.milestones.filter((m) => m.kind !== 'hatch').map((m) => {
      const meta = MILE_META[m.kind];
      return { id: m.id, at: new Date(m.created_at).getTime(), glyph: meta?.glyph ?? '·', title: meta ? meta.title(m.detail) : (m.detail ?? m.kind) };
    }),
    [data.milestones]
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>THE FIELD JOURNAL</Text>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.lede}>Every moment with {s.bixiName} is pressed here like a leaf.</Text>

          {/* streak activity calendar — tap to open the 4×4 grid */}
          <Pressable style={styles.card} onPress={() => setCalOpen((o) => !o)}>
            <View style={styles.calHead}>
              <View>
                <Text style={styles.calTitle}>Activity</Text>
                <Text style={styles.calSub}>🔥 {s.streak} day streak · last 16 days</Text>
              </View>
              <Chevron open={calOpen} />
            </View>
            {calOpen && (
              <>
                <View style={styles.grid}>
                  {cal.map((c, i) => (
                    <View key={i} style={[styles.cube, { backgroundColor: heatColor(c.count) }]} />
                  ))}
                </View>
                <View style={styles.legend}>
                  <Text style={styles.legendTxt}>less</Text>
                  {[0, 1, 3, 6, 8].map((n) => <View key={n} style={[styles.legendCube, { backgroundColor: heatColor(n) }]} />)}
                  <Text style={styles.legendTxt}>more</Text>
                </View>
              </>
            )}
          </Pressable>

          {/* sub-tabs */}
          <View style={styles.tabs}>
            <TabBtn label="Daily log" active={tab === 'daily'} onPress={() => setTab('daily')} />
            <TabBtn label="Field notes" active={tab === 'field'} onPress={() => setTab('field')} />
          </View>

          {tab === 'daily' ? (
            dailyGroups.length === 0 ? (
              <Empty text="Each day you care for him lands here — who did what, at a glance." />
            ) : (
              <View style={{ gap: 10 }}>
                {dailyGroups.map(([d, g]) => {
                  const open = openDays.has(d);
                  return (
                    <View key={d} style={styles.dayCard}>
                      <Pressable style={styles.dayHead} onPress={() => toggleDay(d)}>
                        <Text style={styles.dayLabel}>{dayLabel(d)}</Text>
                        <View style={styles.dayHeadRight}>
                          <Text style={styles.dayCount}>{g.count} moment{g.count === 1 ? '' : 's'}</Text>
                          <Chevron open={open} />
                        </View>
                      </Pressable>
                      {open && [...g.actors.entries()].map(([pid, kinds]) => (
                        <View key={pid} style={styles.actorRow}>
                          <Text style={styles.actorName} numberOfLines={1}>{nameOf(pid)}</Text>
                          <View style={styles.chips}>
                            {[...kinds].map((k) => (
                              <View key={k} style={[styles.chip, { borderColor: (KIND_META[k]?.color ?? DIM) + '55', backgroundColor: (KIND_META[k]?.color ?? DIM) + '1c' }]}>
                                <ActionGlyph kind={k} size={18} />
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            <View style={{ gap: 10 }}>
              {/* the specimen card — hatch date, always first */}
              <View style={styles.specimen}>
                <Text style={styles.specimenEyebrow}>SPECIMEN Nº01</Text>
                <Text style={styles.specimenName}>{s.bixiName}</Text>
                <Text style={styles.specimenMeta}>
                  {s.createdAt ? `Hatched ${fmtDate(s.createdAt)}` : 'Not yet hatched'}
                </Text>
                <Text style={styles.specimenMeta}>Day {String(day).padStart(3, '0')} · {stage.emoji} {stage.label}</Text>
              </View>

              {fieldNotes.length === 0 ? (
                <Empty text="Milestones and moments of flourishing will gather here." />
              ) : (
                fieldNotes.map((f) => (
                  <View key={f.id} style={styles.note}>
                    <Text style={styles.noteGlyph}>{f.glyph}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noteTitle}>{f.title}</Text>
                      <Text style={styles.noteDate}>{fmtDate(f.at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
      <Path d="M7 10l5 5 5-5" stroke={DIM} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnOn]} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
    </Pressable>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 30 }}>🌱</Text>
      <Text style={styles.emptyTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 22, paddingTop: 8 },

  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.4, color: ACCENT },
  title: { fontFamily: fonts.serifSemibold, fontSize: 30, color: CREAM, marginTop: 4, letterSpacing: -0.4 },
  lede: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM, marginTop: 4, lineHeight: 21 },

  card: {
    marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: LINE,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM },
  calSub: { fontFamily: fonts.sans, fontSize: 12.5, color: DIM, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center' },
  cube: { width: 62, height: 62, borderRadius: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 14 },
  legendTxt: { fontFamily: fonts.sans, fontSize: 11, color: FAINT, marginHorizontal: 2 },
  legendCube: { width: 12, height: 12, borderRadius: 3 },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(245,239,227,0.06)', borderWidth: 1, borderColor: LINE },
  tabBtnOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: DIM },
  tabLabelOn: { color: '#1a120a' },

  dayCard: { padding: 14, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, gap: 10 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM },
  dayCount: { fontFamily: fonts.mono, fontSize: 11, color: FAINT },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actorName: { fontFamily: fonts.sansSemibold, fontSize: 13, color: DIM, width: 74 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipEmoji: { fontSize: 15 },

  specimen: { padding: 18, borderRadius: 18, backgroundColor: 'rgba(240,137,95,0.08)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.28)' },
  specimenEyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: ACCENT },
  specimenName: { fontFamily: fonts.serifSemibold, fontSize: 26, color: CREAM, marginTop: 4 },
  specimenMeta: { fontFamily: fonts.sans, fontSize: 13.5, color: DIM, marginTop: 4 },

  note: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: LINE },
  noteGlyph: { fontSize: 20, width: 26, textAlign: 'center' },
  noteTitle: { fontFamily: fonts.serifSemibold, fontSize: 15, color: CREAM, lineHeight: 20 },
  noteDate: { fontFamily: fonts.mono, fontSize: 11, color: FAINT, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 34, gap: 8, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE },
  emptyTxt: { fontFamily: fonts.sans, fontSize: 14, color: DIM, textAlign: 'center', lineHeight: 21, paddingHorizontal: 24 },
});
