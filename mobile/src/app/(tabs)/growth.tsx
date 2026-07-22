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

// the comfort ladder — each streak opens up a new moment with him.
// {name} is replaced with the pet's name. `emoji` is a placeholder until art lands.
type Milestone = { streak: number; title: string; desc: string; emoji: string; tint: string; pairedOnly?: boolean };
const MILESTONES: Milestone[] = [
  { streak: 3, title: 'Warms up to you', tint: '#7fc07a', emoji: '🌱',
    desc: '{name} stops hiding and finally peeks out from behind his leaf.' },
  { streak: 7, title: 'First laugh', tint: '#e0a94a', emoji: '😊',
    desc: 'A week in, and {name} giggles out loud for the very first time.' },
  { streak: 10, title: 'A shy little dance', tint: '#e090b5', emoji: '💃',
    desc: '{name} shows you a secret dance move he is far too shy to do for anyone else.' },
  { streak: 21, title: 'A song of his own', tint: '#63a9d6', emoji: '🎵',
    desc: 'He hums a little tune he made up, just for the two of you.' },
  { streak: 30, title: 'A secret no one knows', tint: '#c9a2e0', emoji: '🤫',
    desc: '{name} leans in and whispers a secret only you two will ever hear.' },
  { streak: 60, title: 'A handmade gift', tint: '#f0895f', emoji: '🎁',
    desc: 'He leaves you a tiny pressed-flower keepsake he made himself.' },
  { streak: 90, title: 'A companion arrives', tint: '#5cc0b4', emoji: '🐣', pairedOnly: true,
    desc: '{name} feels safe enough to invite a little companion into your world.' },
  { streak: 180, title: 'Half a year of you', tint: '#f0c94a', emoji: '🌸',
    desc: 'Six months together. {name} blooms into a rare form only devotion unlocks.' },
  { streak: 365, title: 'A year, together', tint: '#8fcf9a', emoji: '🏵️',
    desc: 'One whole year. {name} presses this season into a keepsake you will always have.' },
];

export default function Growth() {
  const s = useBixi();
  const paired = modeOf(s.keepers) === 'paired';
  const name = s.bixiName;
  const best = s.bestStreak;

  const items = MILESTONES.map((m) => ({ ...m, reached: best >= m.streak && (!m.pairedOnly || paired) }));
  const unlocked = items.filter((x) => x.reached).length;
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
            The longer you stay, the more {name} opens up. Every streak unlocks a new moment together.
          </Text>

          {/* progress toward the next moment */}
          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressStreak}>🔥 {s.streak}-day streak</Text>
              <Text style={styles.progressCount}>{unlocked} / {items.length} unlocked</Text>
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

          <View style={{ gap: 14, marginTop: 18 }}>
            {items.map((m, i) => (
              <MilestoneCard key={m.streak} m={m} name={name} isNext={i === nextIdx} paired={paired} />
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MilestoneCard({
  m, name, isNext, paired,
}: {
  m: Milestone & { reached: boolean }; name: string; isNext: boolean; paired: boolean;
}) {
  const locked = !m.reached;
  const needsPartner = !!m.pairedOnly && !paired;
  return (
    <View style={[styles.card, isNext && styles.cardNext]}>
      {/* ── art placeholder — drop the milestone graphic in here later ── */}
      <View style={[styles.art, { backgroundColor: m.tint + (locked ? '12' : '24'), borderColor: m.tint + (locked ? '22' : '55') }]}>
        <Text style={[styles.artEmoji, locked && { opacity: 0.4 }]}>{m.emoji}</Text>
        {locked && (
          <View style={styles.lockPill}>
            <Text style={styles.lockTxt}>🔒 {needsPartner ? 'Together' : `Day ${m.streak}`}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.req, { color: m.tint }]}>
            DAY {m.streak}{m.pairedOnly ? ' · TOGETHER' : ''}
          </Text>
          {m.reached ? (
            <Text style={styles.unlockedTag}>✓ unlocked</Text>
          ) : isNext ? (
            <Text style={styles.nextTag}>next up</Text>
          ) : null}
        </View>
        <Text style={[styles.cardTitle, locked && { color: 'rgba(245,239,227,0.8)' }]}>{m.title}</Text>
        <Text style={[styles.cardDesc, locked && { color: FAINT }]}>{m.desc.replace(/\{name\}/g, name)}</Text>
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

  card: { borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  cardNext: { borderColor: 'rgba(240,137,95,0.5)' },
  // reserved space for the milestone artwork
  art: { height: 150, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  artEmoji: { fontSize: 60 },
  lockPill: {
    position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(12,8,4,0.6)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.18)',
  },
  lockTxt: { fontFamily: fonts.sansSemibold, fontSize: 11, color: CREAM },

  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  req: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1 },
  unlockedTag: { fontFamily: fonts.sansBold, fontSize: 11, color: '#7fc07a' },
  nextTag: { fontFamily: fonts.sansBold, fontSize: 11, color: ACCENT },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: CREAM, letterSpacing: -0.2 },
  cardDesc: { fontFamily: fonts.sans, fontSize: 14, color: DIM, lineHeight: 21, marginTop: 4 },
});
