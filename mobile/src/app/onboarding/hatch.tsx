import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, space } from '@/theme';
import { actHatch } from '@/game/actions';
import type { Mode, RelationshipKind } from '@/game/types';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { Eyebrow, Txt } from '@/ui/primitives';

const TAPS_TO_HATCH = 3;

export default function Hatch() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; kind?: string; name?: string }>();

  const [taps, setTaps] = useState(0);
  const [hatched, setHatched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const mode = (params.mode === 'paired' ? 'paired' : 'solo') as Mode;

  const wobble = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const onTap = async () => {
    if (hatched) return;
    const n = taps + 1;
    setTaps(n);
    wobble();
    if (n >= TAPS_TO_HATCH) {
      tapHaptic();
      successHaptic();
      setErr(null);
      setHatched(true);
      const kind = (params.kind ? params.kind : null) as RelationshipKind;
      try {
        await actHatch(mode, params.name ?? '', kind);
        // only navigate once the server hatch actually succeeded
        setTimeout(() => {
          if (mode === 'paired') router.replace('/onboarding/invite');
          else router.replace('/(tabs)');
        }, 1100);
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? '';
        setHatched(false);
        setTaps(0);
        setErr(
          msg.includes('already_has_bixi')
            ? 'This account already has a Bixi. Sign in on your other device, or reset from You → Delete account.'
            : 'Hatching failed — check your connection and tap the egg again.'
        );
      }
    } else {
      tapHaptic();
    }
  };

  const crackedEmoji = hatched ? '🐣' : taps === 0 ? '🥚' : taps === 1 ? '🥚' : '🐣';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Eyebrow color={colors.clayPress}>
          {hatched ? 'Day 001' : 'Tap to wake him'}
        </Eyebrow>
        <Pressable onPress={onTap} style={styles.plate}>
          <Animated.Text style={[styles.egg, { transform: [{ scale }] }]}>
            {crackedEmoji}
          </Animated.Text>
        </Pressable>
        <Txt style={styles.title}>
          {hatched ? 'He\'s here.' : 'Something\'s stirring…'}
        </Txt>
        <Txt variant="body" center style={{ maxWidth: 300 }}>
          {hatched
            ? `Say hello to ${params.name?.trim() || 'Bixi'}.`
            : `Give the egg a few taps to coax him out.`}
        </Txt>
        {!hatched && (
          <View style={styles.dots}>
            {Array.from({ length: TAPS_TO_HATCH }).map((_, idx) => (
              <View key={idx} style={[styles.dot, idx < taps && styles.dotOn]} />
            ))}
          </View>
        )}
        {err ? (
          <Txt variant="body" color={colors.brick} center style={{ maxWidth: 300, marginTop: 8 }}>
            {err}
          </Txt>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  plate: {
    width: 200, height: 200, borderRadius: 22, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginVertical: 18,
    borderWidth: 6, borderColor: colors.tint,
  },
  egg: { fontSize: 96 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.rule },
  dotOn: { backgroundColor: colors.clay },
});
