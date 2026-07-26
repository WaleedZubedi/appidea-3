import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { Sprout } from '@/ui/SpecimenSeal';
import { Txt } from '@/ui/primitives';

/* ── same tokens as the Home screen ── */
const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.38)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';

export default function Name() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; kind?: string }>();
  const [name, setName] = useState('');
  const pretty = name.trim() || 'Bixi';

  const go = () =>
    router.push({
      pathname: '/onboarding/hatch',
      params: { mode: params.mode ?? 'solo', kind: params.kind ?? '', name: name.trim() },
    });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={['#231609', BG, '#100b06']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.col}>
              <View style={styles.mark}><Sprout size={26} color={LEAF} /></View>

              <Txt style={styles.eyebrow}>NAME YOUR SPECIMEN</Txt>
              <Txt style={styles.h1}>What will you{'\n'}call <Txt style={styles.h1em}>him?</Txt></Txt>
              <Txt style={styles.sub}>
                He’s always a <Txt style={styles.subStrong}>Bixi</Txt> — give yours a nickname only the two of you use.
              </Txt>

              <View style={styles.nameWrap}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Bixi"
                  placeholderTextColor={FAINT}
                  style={styles.input}
                  autoCorrect={false}
                  autoCapitalize="words"
                  maxLength={18}
                  returnKeyType="done"
                  keyboardAppearance="dark"
                  selectionColor={ACCENT}
                  onSubmitEditing={go}
                />
                <View style={styles.underline} />
                <Txt style={styles.hint}>You can change this anytime later in the You tab. ✎</Txt>
              </View>

              <Pressable onPress={go} style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}>
                <LinearGradient colors={['#f2925f', '#d9603a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                  <Txt style={styles.ctaLabel}>Meet {pretty}</Txt>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => router.push('/onboarding/join')} hitSlop={8} style={styles.joinLink}>
                <Txt style={styles.joinTxt}>Have an invite code? Join your person →</Txt>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 8, justifyContent: 'center' },
  col: { width: '100%', maxWidth: 400, alignSelf: 'center', alignItems: 'center' },

  mark: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    backgroundColor: 'rgba(127,192,122,0.12)', borderWidth: 1, borderColor: 'rgba(127,192,122,0.3)',
  },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2.5, color: ACCENT, marginBottom: 12, textAlign: 'center' },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 38, lineHeight: 42, color: CREAM, letterSpacing: -0.5, textAlign: 'center' },
  h1em: { fontFamily: fonts.serifRegular, fontStyle: 'italic', color: ACCENT },
  sub: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: DIM, marginTop: 12, textAlign: 'center', maxWidth: '90%' },
  subStrong: { fontFamily: fonts.sansBold, color: CREAM },

  nameWrap: { alignSelf: 'stretch', marginTop: 38, alignItems: 'center' },
  input: {
    fontFamily: fonts.serifSemibold, fontSize: 34, color: CREAM, textAlign: 'center',
    paddingVertical: 8, minWidth: 220,
  },
  underline: { height: 2, alignSelf: 'stretch', backgroundColor: 'rgba(240,137,95,0.5)', marginHorizontal: 30 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, color: FAINT, marginTop: 14, textAlign: 'center' },

  ctaWrap: {
    alignSelf: 'stretch', marginTop: 40, height: 54, borderRadius: 16, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.2 },

  joinLink: { alignSelf: 'center', paddingVertical: 18 },
  joinTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },
});
