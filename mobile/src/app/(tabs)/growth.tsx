import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { modeOf } from '@/game/engine';
import { useBixi } from '@/game/store';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.38)';
const LINE = 'rgba(245,239,227,0.12)';
const CARD = 'rgba(245,239,227,0.05)';
const ACCENT = '#f0895f';
const RAIL_OFF = 'rgba(245,239,227,0.14)';

// the comfort ladder — each streak opens up a new moment with him. The first
// moment is his shy little dance at a 30-day streak; everything grows from there.
// {name} → the pet's name. `img` is the milestone art; the Day-365 keepsake is TBD.
type Milestone = { streak: number; title: string; desc: string; tint: string; img?: number; pairedOnly?: boolean };
const MILESTONES: Milestone[] = [
  { streak: 30, title: 'A shy little dance', tint: '#e090b5', img: require('../../../assets/growth/dance.jpg'),
    desc: '{name} shows you a secret dance move he is far too shy to do for anyone else.' },
  { streak: 60, title: 'A song of his own', tint: '#63a9d6', img: require('../../../assets/growth/song.jpg'),
    desc: 'He hums a little tune he made up, just for the two of you.' },
  { streak: 90, title: 'A secret no one knows', tint: '#c9a2e0', img: require('../../../assets/growth/secret.jpg'),
    desc: '{name} leans in and whispers a secret only you two will ever hear.' },
  { streak: 120, title: 'A handmade gift', tint: '#f0895f', img: require('../../../assets/growth/gift.jpg'),
    desc: 'He leaves you a tiny pressed-flower keepsake he made himself.' },
  { streak: 150, title: 'A companion arrives', tint: '#5cc0b4', pairedOnly: true, img: require('../../../assets/growth/companion.jpg'),
    desc: '{name} feels safe enough to invite a little companion into your world.' },
  { streak: 180, title: 'Half a year of you', tint: '#f0c94a', img: require('../../../assets/growth/rareform.jpg'),
    desc: 'Six months together. {name} blooms into a rare form only devotion unlocks.' },
  { streak: 365, title: 'A year, together', tint: '#8fcf9a', img: require('../../../assets/growth/year.jpg'),
    desc: 'One whole year. {name} presses this season into a keepsake you will always have.' },
];

export default function Growth() {
  const s = useBixi();
  const paired = modeOf(s.keepers) === 'paired';
  const name = s.bixiName;
  const best = s.bestStreak;

  const items = MILESTONES.map((m) => ({ ...m, reached: best >= m.streak && (!m.pairedOnly || paired) }));
  const nextIdx = items.findIndex((x) => !x.reached);
  const next = nextIdx >= 0 ? items[nextIdx] : null;
  const prevStreak = nextIdx > 0 ? items[nextIdx - 1].streak : 0;
  const prog = next ? Math.max(0, Math.min(1, (s.streak - prevStreak) / (next.streak - prevStreak))) : 1;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>THE LONG GAME</Text>
          <Text style={styles.title}>Growth</Text>
          <Text style={styles.lede}>
            The longer you stay, the more {name} opens up. Every milestone streak unlocks a new moment together.
          </Text>

          {/* progress toward the next moment */}
          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressStreak}>{s.streak}-day streak</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${prog * 100}%` }]} />
            </View>
            <Text style={styles.progressNext}>
              {next
                ? `Next: ${next.title} at a ${next.streak}-day streak${next.pairedOnly && !paired ? ' (needs a co-parent)' : ''}`
                : `Every moment unlocked. ${name} adores you.`}
            </Text>
          </View>

          {/* the timeline */}
          <View style={styles.timeline}>
            {items.map((m, i) => (
              <TimelineItem
                key={m.streak}
                m={m}
                name={name}
                isNext={i === nextIdx}
                paired={paired}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                topOn={m.reached}
                bottomOn={i < items.length - 1 && items[i + 1].reached}
              />
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TimelineItem({
  m, name, isNext, paired, isFirst, isLast, topOn, bottomOn,
}: {
  m: Milestone & { reached: boolean }; name: string; isNext: boolean; paired: boolean;
  isFirst: boolean; isLast: boolean; topOn: boolean; bottomOn: boolean;
}) {
  const locked = !m.reached;
  const needsPartner = !!m.pairedOnly && !paired;
  return (
    <View style={styles.row}>
      {/* left rail — connecting line + node */}
      <View style={styles.rail}>
        <View style={[styles.railSeg, { height: 26, opacity: isFirst ? 0 : 1 }, topOn && styles.railOn]} />
        <View style={[styles.node, m.reached ? { backgroundColor: m.tint, borderColor: m.tint } : styles.nodeOff]} />
        <View style={[styles.railSeg, { flex: 1, opacity: isLast ? 0 : 1 }, bottomOn && styles.railOn]} />
      </View>

      {/* the card */}
      <View style={[styles.card, isNext && styles.cardNext]}>
        {/* ── milestone art ── */}
        <View style={[styles.slot, { borderColor: m.tint + (locked ? '2a' : '55') }]}>
          {m.img ? (
            <Image source={m.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: m.tint + '22' }]} />
          )}
          {locked && <View style={[StyleSheet.absoluteFill, styles.slotScrim]} />}
          <View style={locked ? styles.lockPill : styles.donePill}>
            <Text style={locked ? styles.lockTxt : styles.doneTxt}>
              {locked ? (needsPartner ? 'Together' : `Day ${m.streak}`) : 'Unlocked'}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <Text style={[styles.req, { color: m.tint }]}>DAY {m.streak}{m.pairedOnly ? ' · TOGETHER' : ''}</Text>
            {isNext && !m.reached ? <Text style={styles.nextTag}>next up</Text> : null}
          </View>
          <Text style={[styles.cardTitle, locked && { color: 'rgba(245,239,227,0.82)' }]}>{m.title}</Text>
          <Text style={[styles.cardDesc, locked && { color: FAINT }]}>{m.desc.replace(/\{name\}/g, name)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 22, paddingTop: 8 },

  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.4, color: ACCENT },
  title: { fontFamily: fonts.serifSemibold, fontSize: 30, color: CREAM, marginTop: 4, letterSpacing: -0.4 },
  lede: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM, marginTop: 4, lineHeight: 21 },

  progressCard: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: LINE },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressStreak: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM },
  progressCount: { fontFamily: fonts.mono, fontSize: 12, color: DIM },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(245,239,227,0.12)', overflow: 'hidden', marginTop: 12 },
  barFill: { height: 8, borderRadius: 4, backgroundColor: ACCENT },
  progressNext: { fontFamily: fonts.sans, fontSize: 12.5, color: DIM, marginTop: 10, lineHeight: 18 },

  timeline: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 34, alignItems: 'center' },
  railSeg: { width: 2, backgroundColor: RAIL_OFF },
  railOn: { backgroundColor: 'rgba(240,137,95,0.5)' },
  node: {
    width: 15, height: 15, borderRadius: 8, borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  nodeOff: { backgroundColor: BG, borderColor: RAIL_OFF },

  card: { flex: 1, marginLeft: 12, marginBottom: 16, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  cardNext: { borderColor: 'rgba(240,137,95,0.5)' },
  // the milestone art
  slot: { height: 132, borderBottomWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
  slotScrim: { backgroundColor: 'rgba(10,8,4,0.5)' },
  lockPill: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(12,8,4,0.6)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.18)',
  },
  lockTxt: { fontFamily: fonts.sansSemibold, fontSize: 10.5, color: CREAM },
  donePill: {
    position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(127,192,122,0.18)', borderWidth: 1, borderColor: 'rgba(127,192,122,0.45)',
  },
  doneTxt: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#8fcf9a' },

  body: { padding: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  req: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1 },
  nextTag: { fontFamily: fonts.sansBold, fontSize: 11, color: ACCENT },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 19, color: CREAM, letterSpacing: -0.2 },
  cardDesc: { fontFamily: fonts.sans, fontSize: 13.5, color: DIM, lineHeight: 20, marginTop: 3 },
});
