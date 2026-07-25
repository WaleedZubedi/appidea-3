/**
 * "How to keep {name} happy" guide, opened from the mood status.
 * Explains the current model: mood is a blend of Feed, Water and Bond, every
 * action nudges a meter (each on a 60-min cooldown), the daily ritual adds a
 * mood boost and grows the streak (only when both keepers do it), and letting
 * the meters drain drops his mood. Ends with a CTA to the growth page.
 */
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';

const BG = '#1c130b';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.6)';
const LINE = 'rgba(245,239,227,0.14)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';
const BLUE = '#63a9d6';
const FEEDC = '#e0a94a';
const PINK = '#e090b5';
const SHOWER = '#5cc0b4';
const READ = '#c9a2e0';
const STRETCH = '#8fcf9a';
const SCROLL = '#7fa8d0';
const SUN = '#f0c94a';

type Row = { icon: string; name: string; color: string; what: string };

const PILLARS: Row[] = [
  { icon: '🍽️', name: 'Feed', color: FEEDC, what: 'Fills his Feed meter. Let him get hungry and his whole mood sags.' },
  { icon: '💧', name: 'Water', color: BLUE, what: 'Fills his Water meter. Keep it from running dry.' },
  { icon: '🫶', name: 'Bond', color: PINK, what: 'Grows every time you play with him. Bond counts a little extra, so time together matters most.' },
];
const BOND: Row[] = [
  { icon: '🫶', name: 'Pet', color: PINK, what: 'A quick bit of affection.' },
  { icon: '🚿', name: 'Shower', color: SHOWER, what: 'Fresh and sparkly.' },
  { icon: '📖', name: 'Read', color: READ, what: 'Quiet time together.' },
  { icon: '🧘', name: 'Stretch', color: STRETCH, what: 'Move a little together.' },
  { icon: '📱', name: 'Scroll', color: SCROLL, what: 'Even lazy time side by side counts.' },
  { icon: '☀️', name: 'Sun', color: SUN, what: 'Soak up some warmth.' },
];

export function BixiGuide({ visible, onClose, bixiName = 'Bixi', paired = false }: {
  visible: boolean; onClose: () => void; bixiName?: string; paired?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const name = bixiName?.trim() ? bixiName.trim() : 'Bixi';

  const goGrowth = () => { onClose(); router.push('/growth'); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: '90%' }]}>
          <View style={styles.grip} />
          <View style={styles.headRow}>
            <Text style={styles.title}>How to keep {name} happy</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>Got it</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.lede}>
              {name}'s mood is one number, and it comes straight from three things you look after:{' '}
              <Text style={[styles.b, { color: FEEDC }]}>Feed</Text>,{' '}
              <Text style={[styles.b, { color: BLUE }]}>Water</Text>, and your{' '}
              <Text style={[styles.b, { color: PINK }]}>Bond</Text>. Keep all three up and his mood climbs.
              Let them slide and it falls.
            </Text>

            <Text style={styles.section}>THE THREE THINGS THAT MATTER</Text>
            {PILLARS.map((r) => <GuideRow key={r.name} {...r} />)}

            <Text style={styles.section}>WAYS TO BUILD BOND</Text>
            {BOND.map((r) => <GuideRow key={r.name} {...r} />)}

            <Text style={styles.section}>GOOD TO KNOW</Text>
            <Bullet t={`Every action nudges a meter up, and ${name}'s mood follows.`} />
            <Bullet t={'Each action rests for 60 minutes after you use it, so a little care spread through the day beats one big burst.'} />
            <Bullet t={`You both raise the same ${name}. Whatever either of you does shows up live for the other.`} />

            <Text style={styles.section}>✨ THE DAILY RITUAL</Text>
            <View style={styles.callout}>
              <Text style={styles.calloutTxt}>
                Tap {name} once a day for his <Text style={[styles.b, { color: ACCENT }]}>ritual</Text>. It gives
                him a solid mood boost (about <Text style={styles.b}>2%</Text>) and grows your{' '}
                <Text style={styles.b}>streak</Text>, and the streak is what makes {name} grow.
              </Text>
            </View>
            {paired ? (
              <Bullet t={`The streak only moves when both of you do the ritual, so give your person a nudge.`} />
            ) : null}
            <Bullet t={'Miss a day and the streak drops back to zero. There is no grace, so show up.'} />

            <Text style={styles.section}>CONSISTENCY IS THE WHOLE GAME</Text>
            <Bullet t={`His meters quietly drain a little every day. Care daily and ${name} thrives. Disappear and he drifts, then wilts.`} />
            <Bullet t={'Small and steady wins. A minute a day is plenty to keep him glowing.'} />

            {/* CTA to the growth page */}
            <Text style={styles.ctaHint}>Curious how far he can go?</Text>
            <Pressable onPress={goGrowth} style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
              <Text style={styles.ctaEmoji}>🌱</Text>
              <Text style={styles.ctaTxt}>See {name}'s growth journey</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function GuideRow({ icon, name, color, what }: Row) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { borderColor: color + '66', backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 17 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color }]}>{name}</Text>
        <Text style={styles.rowWhat}>{what}</Text>
      </View>
    </View>
  );
}

function Bullet({ t }: { t: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletTxt}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(6,4,2,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, borderWidth: 1, borderColor: LINE,
  },
  grip: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,239,227,0.25)', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 20, color: CREAM, flexShrink: 1, marginRight: 10 },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: ACCENT },
  closeTxt: { fontFamily: fonts.sansBold, fontSize: 13, color: '#1a120a' },

  lede: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM, lineHeight: 21, marginBottom: 6 },
  b: { fontFamily: fonts.sansBold, color: CREAM },

  section: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1, color: ACCENT, marginTop: 20, marginBottom: 10 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: fonts.sansBold, fontSize: 14.5 },
  rowWhat: { fontFamily: fonts.sans, fontSize: 13, color: DIM, lineHeight: 18, marginTop: 1 },

  callout: {
    padding: 14, borderRadius: 16, backgroundColor: 'rgba(240,137,95,0.1)',
    borderWidth: 1, borderColor: 'rgba(240,137,95,0.35)',
  },
  calloutTxt: { fontFamily: fonts.sans, fontSize: 14, color: CREAM, lineHeight: 21 },

  bullet: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  bulletDot: { fontFamily: fonts.sansBold, fontSize: 14, color: ACCENT, lineHeight: 20 },
  bulletTxt: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: DIM, lineHeight: 20 },

  ctaHint: { fontFamily: fonts.sansSemibold, fontSize: 13, color: DIM, textAlign: 'center', marginTop: 24, marginBottom: 10 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 27, backgroundColor: LEAF,
    shadowColor: LEAF, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 5 },
  },
  ctaEmoji: { fontSize: 18 },
  ctaTxt: { fontFamily: fonts.sansBold, fontSize: 15.5, color: '#12200f' },
  ctaArrow: { fontFamily: fonts.sansBold, fontSize: 17, color: '#12200f' },
});
