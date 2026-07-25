import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, space } from '@/theme';
import { Eyebrow, LinkButton, PrimaryButton, Txt } from '@/ui/primitives';

export default function Name() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; kind?: string }>();
  const [name, setName] = useState('');

  const go = () =>
    router.push({
      pathname: '/onboarding/hatch',
      params: {
        mode: params.mode ?? 'solo',
        kind: params.kind ?? '',
        name: name.trim(),
      },
    });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <Eyebrow color={colors.clayPress}>Name your specimen</Eyebrow>
          <Txt style={styles.title}>What will you call him?</Txt>
          <Txt variant="body" style={{ marginTop: 4 }}>
            He’s always a <Txt variant="bodyStrong">Bixi</Txt> — but you can give yours a nickname.
          </Txt>
        </View>

        <View style={styles.center}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Bixi"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCorrect={false}
            maxLength={18}
            returnKeyType="done"
            onSubmitEditing={go}
          />
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={name.trim() ? `meet ${name.trim()}` : 'meet Bixi'} onPress={go} />
          <View style={{ height: 12 }} />
          <LinkButton
            label="Have an invite code? Join your person →"
            color={colors.muted}
            onPress={() => router.push('/onboarding/join')}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.xl },
  top: { paddingTop: 40, gap: 6 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, letterSpacing: -0.3 },
  center: { flex: 1, justifyContent: 'center' },
  input: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderColor: colors.rule,
    paddingVertical: 12,
  },
  footer: { paddingBottom: 24 },
});
