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
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { Sprout } from '@/ui/SpecimenSeal';
import { Txt } from '@/ui/primitives';

const BG_TOP = '#1a130b';
const BG_BOT = '#0f0b07';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.62)';
const FAINT = 'rgba(245,239,227,0.40)';
const ACCENT = '#f0895f';
const LEAF = '#a9d182';

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
      <LinearGradient colors={[BG_TOP, BG_BOT]} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowClay]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowLeaf]} pointerEvents="none" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.markRing}>
              <Sprout size={26} color={LEAF} />
            </View>

            <Txt style={styles.eyebrow}>NAME YOUR SPECIMEN</Txt>
            <Txt style={styles.h1}>
              What will you{'\n'}call <Txt style={styles.h1em}>him?</Txt>
            </Txt>
            <Txt style={styles.sub}>
              He’s always a <Txt style={styles.subStrong}>Bixi</Txt> — but give yours a nickname only the two of you use.
            </Txt>

            {/* the name, front and center */}
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
              <LinearGradient colors={['#e0703f', '#c5492a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                <Txt style={styles.ctaLabel}>Meet {pretty}</Txt>
                <View style={styles.ctaArrow}>
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <Path d="M4 12 H19 M13 6 L19 12 L13 18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/onboarding/join')} hitSlop={8} style={styles.joinLink}>
              <Txt style={styles.joinTxt}>Have an invite code? Join your person →</Txt>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BOT },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 8, justifyContent: 'center' },

  glow: { position: 'absolute', width: 340, height: 340, borderRadius: 170, opacity: 0.16 },
  glowClay: { backgroundColor: ACCENT, top: -120, right: -110 },
  glowLeaf: { backgroundColor: LEAF, bottom: -150, left: -120, opacity: 0.1 },

  markRing: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    backgroundColor: 'rgba(169,209,130,0.12)', borderWidth: 1, borderColor: 'rgba(169,209,130,0.3)',
  },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: ACCENT, marginBottom: 12 },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 40, lineHeight: 44, color: CREAM, letterSpacing: -0.6 },
  h1em: { fontFamily: fonts.serifRegular, fontStyle: 'italic', color: ACCENT },
  sub: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23, color: DIM, marginTop: 14, maxWidth: '92%' },
  subStrong: { fontFamily: fonts.sansBold, color: CREAM },

  nameWrap: { marginTop: 40, alignItems: 'center' },
  input: {
    fontFamily: fonts.serifSemibold, fontSize: 34, color: CREAM, textAlign: 'center',
    paddingVertical: 8, minWidth: 200,
  },
  underline: { height: 2, alignSelf: 'stretch', backgroundColor: 'rgba(240,137,95,0.5)', marginHorizontal: 40 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, color: FAINT, marginTop: 14, textAlign: 'center' },

  ctaWrap: {
    marginTop: 44, height: 56, borderRadius: 18, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.2 },
  ctaArrow: { position: 'absolute', right: 22 },

  joinLink: { alignSelf: 'center', paddingVertical: 18 },
  joinTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },
});
