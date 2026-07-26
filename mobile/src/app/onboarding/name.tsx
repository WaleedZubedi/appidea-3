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

const CLAY_TOP = '#cf5836';
const CLAY_BOT = '#b0421f';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.78)';
const FAINT = 'rgba(245,239,227,0.55)';
const CLAY_INK = '#9c3a1e';

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
      <LinearGradient colors={[CLAY_TOP, CLAY_BOT]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.col}>
              <View style={styles.mark}>
                <Sprout size={28} color={CREAM} />
              </View>

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
                  selectionColor={CREAM}
                  onSubmitEditing={go}
                />
                <View style={styles.underline} />
                <Txt style={styles.hint}>You can change this anytime later in the You tab. ✎</Txt>
              </View>

              <Pressable onPress={go} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                <Txt style={styles.ctaLabel}>Meet {pretty}</Txt>
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
  root: { flex: 1, backgroundColor: CLAY_BOT },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 8, justifyContent: 'center' },
  col: { width: '100%', maxWidth: 400, alignSelf: 'center', alignItems: 'center' },

  mark: {
    width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: 'rgba(245,239,227,0.85)', marginBottom: 12, textAlign: 'center' },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 38, lineHeight: 42, color: CREAM, letterSpacing: -0.5, textAlign: 'center' },
  h1em: { fontFamily: fonts.serifRegular, fontStyle: 'italic', color: CREAM },
  sub: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 22, color: DIM, marginTop: 12, textAlign: 'center', maxWidth: '90%' },
  subStrong: { fontFamily: fonts.sansBold, color: CREAM },

  nameWrap: { alignSelf: 'stretch', marginTop: 40, alignItems: 'center' },
  input: {
    fontFamily: fonts.serifSemibold, fontSize: 34, color: CREAM, textAlign: 'center',
    paddingVertical: 8, minWidth: 220,
  },
  underline: { height: 2, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.45)', marginHorizontal: 30 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, color: FAINT, marginTop: 14, textAlign: 'center' },

  cta: {
    alignSelf: 'stretch', marginTop: 44, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: CLAY_INK, letterSpacing: 0.2 },

  joinLink: { alignSelf: 'center', paddingVertical: 18 },
  joinTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },
});
