import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, space } from '@/theme';
import type { RelationshipKind } from '@/game/types';
import { Eyebrow, LinkButton, PrimaryButton, Txt } from '@/ui/primitives';

const KINDS: { key: Exclude<RelationshipKind, null>; emoji: string; label: string }[] = [
  { key: 'couple', emoji: '💞', label: 'A couple' },
  { key: 'friends', emoji: '🤞', label: 'Best friends' },
  { key: 'family', emoji: '🏡', label: 'Family' },
];

export default function Kind() {
  const router = useRouter();
  const [sel, setSel] = useState<RelationshipKind>(null);

  const next = () =>
    router.push({
      pathname: '/onboarding/name',
      params: { mode: 'paired', kind: sel ?? '' },
    });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Eyebrow color={colors.clayPress}>Who's your person?</Eyebrow>
        <Txt style={styles.title}>How do you two know each other?</Txt>
        <Txt variant="body" style={{ marginTop: 4 }}>
          Just sets the tone — you can change it later.
        </Txt>
      </View>

      <View style={styles.list}>
        {KINDS.map((k) => (
          <Pressable
            key={k.key}
            onPress={() => setSel(k.key)}
            style={[styles.row, sel === k.key && styles.rowOn]}
          >
            <Txt style={{ fontSize: 24 }}>{k.emoji}</Txt>
            <Txt style={styles.rowLabel}>{k.label}</Txt>
            <View style={[styles.radio, sel === k.key && styles.radioOn]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="continue" onPress={next} />
        <View style={{ height: 10 }} />
        <LinkButton label="skip" onPress={next} color={colors.muted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.xl },
  top: { paddingTop: 40, gap: 6 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, letterSpacing: -0.3 },
  list: { flex: 1, justifyContent: 'center', gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.sheet, borderRadius: radius.md,
    padding: space.lg, borderWidth: 1.5, borderColor: colors.line,
  },
  rowOn: { borderColor: colors.clay, backgroundColor: '#fdf3ee' },
  rowLabel: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.rule },
  radioOn: { borderColor: colors.clay, backgroundColor: colors.clay },
  footer: { paddingBottom: 24, alignItems: 'center' },
});
