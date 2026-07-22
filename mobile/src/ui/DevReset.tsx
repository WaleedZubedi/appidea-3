/**
 * TEMPORARY dev tool — a floating bar on every screen for fast test resets.
 * Two actions:
 *   ↺ Onboarding      — sign out + clear local state → intro (account kept)
 *   🗑 Delete account  — delete this account + its Bixi → intro
 * Remove this component (and its mount in app/_layout.tsx) before shipping.
 */
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IS_ONLINE } from '@/lib/config';
import { useBixi } from '@/game/store';
import { useAuth } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { AdminPanel } from '@/ui/AdminPanel';

export function DevReset() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // drag the bar anywhere so it never blocks the view
  const pan = useRef(new Animated.ValueXY()).current;
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => pan.extractOffset(),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.flattenOffset(),
    })
  ).current;

  const toOnboarding = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (IS_ONLINE) await useAuth.getState().signOut();
    } catch {
      /* ignore */
    }
    useBixi.getState().reset();
    setBusy(false);
    router.replace('/onboarding/intro');
  };

  const deleteAndOnboarding = () => {
    Alert.alert(
      'Delete this account?',
      'Permanently deletes this account and its Bixi, then returns to onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (IS_ONLINE && supabase) {
                await supabase.functions.invoke('delete-account').catch(() => {});
                await useAuth.getState().signOut().catch(() => {});
              }
            } catch {
              /* ignore */
            }
            useBixi.getState().reset();
            setBusy(false);
            router.replace('/onboarding/intro');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 94 }]} pointerEvents="box-none">
      <Animated.View style={[styles.bar, { transform: pan.getTranslateTransform() }]}>
        <View style={styles.grip} {...drag.panHandlers}>
          <Text style={styles.gripDots}>⠿</Text>
        </View>
        <View style={styles.div} />
        <Pressable style={styles.btn} onPress={() => setAdminOpen(true)} hitSlop={6}>
          <Text style={[styles.txt, styles.admin]}>⚙︎ admin</Text>
        </Pressable>
        <View style={styles.div} />
        <Pressable style={styles.btn} onPress={toOnboarding} disabled={busy} hitSlop={6}>
          <Text style={styles.txt}>↺ onboarding</Text>
        </Pressable>
        <View style={styles.div} />
        <Pressable style={styles.btn} onPress={deleteAndOnboarding} disabled={busy} hitSlop={6}>
          <Text style={[styles.txt, styles.danger]}>🗑 delete</Text>
        </Pressable>
      </Animated.View>
      <AdminPanel visible={adminOpen} onClose={() => setAdminOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,14,8,0.9)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(245,239,227,0.2)',
    paddingHorizontal: 4, height: 34,
  },
  grip: { paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  gripDots: { fontSize: 15, color: 'rgba(245,239,227,0.5)', marginTop: -2 },
  btn: { paddingHorizontal: 12, paddingVertical: 6 },
  div: { width: 1, height: 18, backgroundColor: 'rgba(245,239,227,0.2)' },
  txt: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: 'rgba(245,239,227,0.85)' },
  admin: { color: '#f0895f' },
  danger: { color: '#ff8a7a' },
});
