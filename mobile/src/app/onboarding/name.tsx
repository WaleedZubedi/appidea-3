import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { Txt } from '@/ui/primitives';

const HERO = require('../../../assets/growth/dance.jpg');
const HERO_H = Math.round(Dimensions.get('window').height * 0.4);

/* ── same tokens as the Home screen ── */
const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.38)';
const ACCENT = '#f0895f';

export default function Name() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; kind?: string }>();
  const [name, setName] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  const pretty = name.trim() || 'Bixi';

  // collapse the hero when the keyboard is up so the field + button get room
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setKbOpen(true); });
    const h = Keyboard.addListener(hideEvt, () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setKbOpen(false); });
    return () => { s.remove(); h.remove(); };
  }, []);

  const go = () =>
    router.push({
      pathname: '/onboarding/hatch',
      params: { mode: params.mode ?? 'solo', kind: params.kind ?? '', name: name.trim() },
    });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: kbOpen ? insets.top + 8 : 0, paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── hero: Bixi dancing (collapses when the keyboard opens) ── */}
          <View style={[styles.hero, { height: kbOpen ? 0 : HERO_H }]}>
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" priority="high" />
            <LinearGradient colors={['rgba(24,16,9,0.35)', 'rgba(24,16,9,0)', 'rgba(24,16,9,0.1)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Svg width="100%" height={54} viewBox="0 0 100 16" preserveAspectRatio="none" style={styles.curve}>
              <Path d="M0,0 Q50,20 100,0 L100,16 L0,16 Z" fill={BG} />
            </Svg>
          </View>

          <View style={styles.body}>
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
              <LinearGradient colors={['#f5a06d', '#e0703f', '#d05730']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                <Txt style={styles.ctaLabel}>Meet {pretty}</Txt>
                <View style={styles.ctaArrow}>
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path d="M4 12 H18 M12 6 L18 12 L12 18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/onboarding/join')} hitSlop={8} style={styles.joinLink}>
              <Txt style={styles.joinTxt}>Have an invite code? Join your person →</Txt>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: { width: '100%', backgroundColor: '#20140b', overflow: 'hidden' },
  curve: { position: 'absolute', left: 0, right: 0, bottom: -1 },

  body: { paddingHorizontal: 26, marginTop: -6, alignItems: 'center' },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2.5, color: ACCENT, marginBottom: 6, textAlign: 'center' },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 36, lineHeight: 40, color: CREAM, letterSpacing: -0.5, textAlign: 'center' },
  h1em: { fontFamily: fonts.serifRegular, fontStyle: 'italic', color: ACCENT },
  sub: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: DIM, marginTop: 10, textAlign: 'center', maxWidth: '92%' },
  subStrong: { fontFamily: fonts.sansBold, color: CREAM },

  nameWrap: { alignSelf: 'stretch', marginTop: 30, alignItems: 'center' },
  input: {
    fontFamily: fonts.serifSemibold, fontSize: 34, color: CREAM, textAlign: 'center',
    paddingVertical: 8, minWidth: 220,
  },
  underline: { height: 2, alignSelf: 'stretch', backgroundColor: 'rgba(240,137,95,0.5)', marginHorizontal: 30 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, color: FAINT, marginTop: 14, textAlign: 'center' },

  ctaWrap: {
    alignSelf: 'stretch', marginTop: 34, height: 56, borderRadius: 18, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 9,
  },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.3 },
  ctaArrow: { position: 'absolute', right: 22 },

  joinLink: { alignSelf: 'center', paddingVertical: 16 },
  joinTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },
});
