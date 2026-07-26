import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { actHatch } from '@/game/actions';
import { track } from '@/lib/analytics';
import type { Mode, RelationshipKind } from '@/game/types';
import { successHaptic, tapHaptic } from '@/lib/haptics';

// tap progression: closed → a few cracks → hatched
const FRAMES = [
  require('../../../assets/bixi/hatch0.jpg'),       // closed
  require('../../../assets/bixi/hatch1.jpg'),       // a few cracks
  require('../../../assets/bixi/hatchedFinal.jpg'), // hatched
];
const TAPS_TO_HATCH = 2; // closed → (tap) cracked → (tap) hatched
const CREAM = '#f5efe3';
const ACCENT = '#f0895f';

export default function Hatch() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; kind?: string; name?: string }>();

  const [taps, setTaps] = useState(0);
  const [hatched, setHatched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hatchPromise = useRef<Promise<unknown> | null>(null);
  const mode = (params.mode === 'paired' ? 'paired' : 'solo') as Mode;
  const name = params.name?.trim() || 'Bixi';

  const onTap = () => {
    if (hatched) return;
    const n = taps + 1;
    setTaps(n);
    tapHaptic();
    if (n < TAPS_TO_HATCH) return; // still cracking

    // reached the hatch — create the Bixi in the BACKGROUND while they admire it,
    // so tapping the button feels instant (no "waking him" wait)
    successHaptic();
    setErr(null);
    setHatched(true);
    const kind = (params.kind ? params.kind : null) as RelationshipKind;
    hatchPromise.current = actHatch(mode, params.name ?? '', kind).then(() =>
      track('bixi_hatched', { mode })
    );
  };

  const goHome = async () => {
    if (busy) return;
    tapHaptic();
    setBusy(true);
    setErr(null);
    try {
      await hatchPromise.current; // almost always already resolved by now
      if (mode === 'paired') router.replace('/onboarding/invite');
      else router.replace('/(tabs)');
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setBusy(false);
      setHatched(false);
      setTaps(0);
      hatchPromise.current = null;
      setErr(
        msg.includes('already_has_bixi')
          ? 'This account already has a Bixi. Sign in on your other device, or reset from You → Delete account.'
          : 'Hatching failed — check your connection and tap the egg again.'
      );
    }
  };

  const frameIdx = Math.min(taps, TAPS_TO_HATCH);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* all frames mounted + preloaded so the hatched frame is already decoded
          when we reach it — no black screen, no last-second pop */}
      {FRAMES.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={[StyleSheet.absoluteFill, { opacity: i === frameIdx ? 1 : 0 }]}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
          transition={180}
        />
      ))}
      {/* tap the egg to crack it — disabled once hatched so the button takes over */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} disabled={hatched} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bottom} pointerEvents="box-none">
          <Text style={styles.eyebrow} pointerEvents="none">
            {hatched ? 'DAY 001' : 'TAP TO WAKE HIM'}
          </Text>
          <Text style={styles.title} pointerEvents="none">
            {hatched ? `Say hello to ${name}.` : 'Something’s stirring…'}
          </Text>

          {!hatched ? (
            <>
              <Text style={styles.sub} pointerEvents="none">Give the egg a few taps to coax him out.</Text>
              <View style={styles.dots} pointerEvents="none">
                {Array.from({ length: TAPS_TO_HATCH }).map((_, i) => (
                  <View key={i} style={[styles.dot, i < taps && styles.dotOn]} />
                ))}
              </View>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cta, (busy || pressed) && styles.ctaDim]}
              onPress={goHome}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#2a1a10" />
              ) : (
                <Text style={styles.ctaTxt}>{name} is waiting for you →</Text>
              )}
            </Pressable>
          )}

          {err ? <Text style={styles.err} pointerEvents="none">{err}</Text> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

// legibility over the artwork comes from a soft text shadow, not a black bar
const shadow = { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0a06' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  bottom: { paddingHorizontal: 28, paddingBottom: 46, alignItems: 'center', gap: 8 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.8, color: ACCENT, ...shadow },
  title: { fontFamily: fonts.serifSemibold, fontSize: 27, color: CREAM, textAlign: 'center', ...shadow },
  sub: { fontFamily: fonts.sans, fontSize: 15, color: 'rgba(245,239,227,0.9)', textAlign: 'center', ...shadow },
  dots: { flexDirection: 'row', gap: 9, marginTop: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(245,239,227,0.35)' },
  dotOn: { backgroundColor: ACCENT },
  cta: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaDim: { opacity: 0.7 },
  ctaTxt: { fontFamily: fonts.sansBold, fontSize: 16, color: '#2a1a10', letterSpacing: 0.2 },
  err: { fontFamily: fonts.sans, fontSize: 14, color: '#ff8a7a', textAlign: 'center', marginTop: 8, ...shadow },
});
