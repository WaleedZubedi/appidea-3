import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, hardShadow, radius, space } from '@/theme';
import { useAuth } from '@/lib/session';
import { Eyebrow, LinkButton, Txt } from '@/ui/primitives';

export default function Gate() {
  const router = useRouter();
  const signOut = useAuth((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Eyebrow color={colors.clayPress}>Adopt Bixi</Eyebrow>
        <Txt style={styles.title}>Raise Bixi together,{'\n'}or on your own?</Txt>
      </View>

      <View style={styles.choices}>
        {/* primary — pairing is the hero path */}
        <Pressable
          style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
          onPress={() => router.push('/onboarding/kind')}
        >
          <Txt style={{ fontSize: 30 }}>🤝</Txt>
          <Txt style={styles.primaryTitle}>With someone</Txt>
          <Txt variant="body" style={styles.primarySub}>
            Invite your person to co-parent Bixi
          </Txt>
        </Pressable>

        {/* secondary — solo stays a real, warm choice */}
        <Pressable
          style={({ pressed }) => [styles.secondaryCard, pressed && { backgroundColor: colors.tint }]}
          onPress={() => router.push({ pathname: '/onboarding/name', params: { mode: 'solo' } })}
        >
          <Txt style={{ fontSize: 26 }}>🌱</Txt>
          <View style={{ flex: 1 }}>
            <Txt style={styles.secondaryTitle}>On my own</Txt>
            <Txt variant="body">Start now — invite your person anytime.</Txt>
          </View>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <LinkButton
          label="Have an invite code?  Join a Bixi →"
          onPress={() => router.push('/onboarding/join')}
        />
        <LinkButton label="Sign out" onPress={handleSignOut} color={colors.muted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.xl },
  top: { paddingTop: 40, gap: 8 },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, letterSpacing: -0.3, lineHeight: 33 },
  choices: { flex: 1, justifyContent: 'center', gap: 16 },
  primaryCard: {
    backgroundColor: colors.clay,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: 4,
    ...hardShadow,
  },
  primaryTitle: { fontFamily: fonts.sansBold, fontSize: 22, color: '#fff', marginTop: 6 },
  primarySub: { color: '#fbe7de' },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.sheet,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  secondaryTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink },
  footer: { alignItems: 'center', paddingBottom: 24, gap: 12 },
});
