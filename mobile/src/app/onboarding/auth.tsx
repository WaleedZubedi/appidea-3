import { ImageBackground } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, fonts, radius } from '@/theme';
import { actHydrate } from '@/game/actions';
import { useBixi } from '@/game/store';
import { useAuth } from '@/lib/session';
import { identifyUser, track } from '@/lib/analytics';
import { Sprout } from '@/ui/SpecimenSeal';
import { Txt } from '@/ui/primitives';

const HERO = require('../../../assets/images/auth-hero.jpg');
const CREAM = '#f5efe3';
const ACCENT = '#f0895f';
const LEAF = '#a9d182';
const HERO_H = Math.round(Dimensions.get('window').height * 0.4);
const ICON = '#5f7a54'; // muted green for the input chips

/* ── little SVG icons ── */
function MailIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={3} y={5} width={18} height={14} rx={3} stroke={ICON} strokeWidth={1.8} fill="none" />
      <Path d="M4 7 L12 13 L20 7" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function LockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={5} y={10} width={14} height={10} rx={2.6} stroke={ICON} strokeWidth={1.8} fill="none" />
      <Path d="M8 10 V8 a4 4 0 0 1 8 0 V10" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M2 12 C4.5 7 8 5 12 5 C16 5 19.5 7 22 12 C19.5 17 16 19 12 19 C8 19 4.5 17 2 12 Z" stroke={colors.muted} strokeWidth={1.7} fill="none" />
      <Circle cx={12} cy={12} r={3.1} stroke={colors.muted} strokeWidth={1.7} fill="none" />
      {off ? <Line x1={4} y1={4} x2={20} y2={20} stroke={colors.muted} strokeWidth={1.7} strokeLinecap="round" /> : null}
    </Svg>
  );
}
function ArrowIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M4 12 H19 M13 6 L19 12 L13 18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.5 C12.6 8.4 15.6 11.4 22.5 12 C15.6 12.6 12.6 15.6 12 22.5 C11.4 15.6 8.4 12.6 1.5 12 C8.4 11.4 11.4 8.4 12 1.5 Z" fill={color} />
    </Svg>
  );
}
function Heart() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M12 20.5 C12 20.5 3.5 14.5 3.5 8.9 C3.5 6.1 5.6 4 8.2 4 C9.9 4 11.3 5 12 6.3 C12.7 5 14.1 4 15.8 4 C18.4 4 20.5 6.1 20.5 8.9 C20.5 14.5 12 20.5 12 20.5 Z" stroke={LEAF} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithPassword, signUpWithPassword, verifySignupCode, resendSignupCode } = useAuth();
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [resent, setResent] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isUp = mode === 'up';
  const canSubmit = email.trim().length >= 4 && password.length >= 6;

  const friendlyAuthError = (m: string): string => {
    const s = m.toLowerCase();
    if (s.includes('already registered') || s.includes('already exists')) return 'That email already has an account — sign in instead.';
    if (s.includes('invalid login')) return 'Wrong email or password.';
    if (s.includes('token') || s.includes('otp') || s.includes('expired')) return 'That code is wrong or expired. Resend and try again.';
    if (s.includes('for security') || s.includes('rate')) return 'Hang on a few seconds, then try again.';
    return m;
  };

  const afterAuth = async () => {
    const uid = useAuth.getState().userId;
    if (uid) identifyUser(uid, { email: email.trim().toLowerCase() });
    track(isUp ? 'signed_up' : 'signed_in');
    await actHydrate();
    const pid = useBixi.getState().pairId;
    router.replace(pid ? '/(tabs)' : '/onboarding/name');
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setErr(null);
    setBusy(true);
    const em = email.trim().toLowerCase();
    if (isUp) {
      const res = await signUpWithPassword(em, password);
      setBusy(false);
      if (res.error) return setErr(friendlyAuthError(res.error));
      if (res.needsCode) { setResent(false); setStep('code'); return; }
      await afterAuth(); // confirmation off → already signed in
    } else {
      const e = await signInWithPassword(em, password);
      setBusy(false);
      if (e) return setErr(friendlyAuthError(e));
      await afterAuth();
    }
  };

  const verify = async () => {
    if (code.trim().length < 6 || busy) return;
    setErr(null);
    setBusy(true);
    const e = await verifySignupCode(email.trim().toLowerCase(), code);
    setBusy(false);
    if (e) return setErr(friendlyAuthError(e));
    await afterAuth();
  };

  const resend = async () => {
    if (busy) return;
    setErr(null); setResent(false);
    const e = await resendSignupCode(email.trim().toLowerCase());
    if (e) setErr(friendlyAuthError(e)); else setResent(true);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {/* ── hero ── */}
          <ImageBackground source={HERO} style={styles.hero} contentFit="contain" contentPosition="top" priority="high" cachePolicy="memory-disk" transition={220}>
            <LinearGradient
              colors={['rgba(14,10,6,0.66)', 'rgba(14,10,6,0.2)', 'rgba(14,10,6,0)', 'rgba(14,10,6,0)']}
              locations={[0, 0.24, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <View style={styles.pill}>
                <View style={styles.pillDot} />
                <Txt style={styles.pillText}>adopt a bixi</Txt>
              </View>

              <View style={styles.kicker}>
                <Txt style={styles.kickerText}>specimen nº 01</Txt>
                <View style={styles.kickerRule} />
              </View>

              <Txt style={styles.title}>
                {isUp ? 'Welcome to ' : 'Welcome\n'}
                {isUp ? <Txt style={[styles.title, { color: ACCENT }]}>Bixi.</Txt> : <Txt style={[styles.title, { color: ACCENT }]}>back.</Txt>}
              </Txt>

              {!isUp ? (
                <Txt style={styles.subtitle}>Sign in to see how your Bixi has been getting on.</Txt>
              ) : null}
            </SafeAreaView>
          </ImageBackground>

          {/* ── paper sheet ── */}
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sparkles}>
              <Star size={13} color={LEAF} />
              <Star size={22} color={ACCENT} />
              <Star size={13} color={ACCENT} />
            </View>

            {step === 'form' ? (
              <>
                <View style={styles.field}>
                  <View style={styles.chip}><MailIcon /></View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@email.com"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    textContentType="none"
                    autoComplete="off"
                    importantForAutofill="no"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <View style={styles.chip}><LockIcon /></View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="password (min 6 characters)"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!show}
                    textContentType="none"
                    autoComplete="off"
                    importantForAutofill="no"
                    passwordRules=""
                    onSubmitEditing={submit}
                    style={styles.input}
                  />
                  <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} style={styles.eye}>
                    <EyeIcon off={show} />
                  </Pressable>
                </View>

                {err ? <Txt style={styles.error}>{err}</Txt> : null}

                <Pressable
                  onPress={submit}
                  style={({ pressed }) => [styles.ctaWrap, (!canSubmit || busy) && styles.ctaDim, pressed && styles.ctaPressed]}
                >
                  <LinearGradient colors={['#d9603a', '#c5492a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                    <View style={styles.ctaLeft}><Sprout size={22} color="#f3e7cf" /></View>
                    <Txt style={styles.ctaLabel}>{busy ? 'One moment…' : isUp ? 'Create account' : 'Sign in'}</Txt>
                    <View style={styles.ctaRight}><ArrowIcon /></View>
                  </LinearGradient>
                </Pressable>

                <View style={styles.heartRow}>
                  <View style={styles.heartRule} />
                  <Heart />
                  <View style={styles.heartRule} />
                </View>

                <View style={styles.switchRow}>
                  <Txt style={styles.switchText}>{isUp ? 'Already have an account? ' : 'New here? '}</Txt>
                  <Pressable onPress={() => { setErr(null); setMode(isUp ? 'in' : 'up'); }} hitSlop={8}>
                    <Txt style={styles.switchLink}>{isUp ? 'Sign in' : 'Create one'}</Txt>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Txt style={styles.codeTitle}>Check your email</Txt>
                <Txt style={styles.codeHint}>
                  We sent a 6-digit code to{'\n'}
                  <Txt style={styles.codeEmail}>{email.trim().toLowerCase()}</Txt>
                </Txt>

                <TextInput
                  value={code}
                  onChangeText={(t) => { setErr(null); setResent(false); setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); }}
                  placeholder="••••••"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={verify}
                  style={styles.codeInput}
                />

                {err ? <Txt style={styles.error}>{err}</Txt> : resent ? <Txt style={styles.codeOk}>New code sent ✓</Txt> : null}

                <Pressable
                  onPress={verify}
                  style={({ pressed }) => [styles.ctaWrap, (code.trim().length < 6 || busy) && styles.ctaDim, pressed && styles.ctaPressed]}
                >
                  <LinearGradient colors={['#d9603a', '#c5492a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                    <View style={styles.ctaLeft}><Sprout size={22} color="#f3e7cf" /></View>
                    <Txt style={styles.ctaLabel}>{busy ? 'Checking…' : 'Verify'}</Txt>
                    <View style={styles.ctaRight}><ArrowIcon /></View>
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={resend} style={styles.linkBtn} hitSlop={8}>
                  <Txt style={styles.linkTxt}>Resend code</Txt>
                </Pressable>
                <Pressable onPress={() => { setStep('form'); setCode(''); setErr(null); setResent(false); }} style={styles.linkBtn} hitSlop={8}>
                  <Txt style={styles.linkTxt}>Use a different email</Txt>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  hero: { width: '100%', height: HERO_H, backgroundColor: '#26190c' },
  heroContent: { paddingHorizontal: 26, paddingTop: 8 },

  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(169,209,130,0.4)',
    backgroundColor: 'rgba(10,7,4,0.28)',
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LEAF },
  pillText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#cfe6b0' },

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  kickerText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase', color: ACCENT },
  kickerRule: { width: 34, height: 1, backgroundColor: 'rgba(240,137,95,0.6)' },

  title: { fontFamily: fonts.serifSemibold, fontSize: 40, lineHeight: 44, color: CREAM, letterSpacing: -0.6, marginTop: 6 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21, color: 'rgba(245,239,227,0.9)', marginTop: 10, maxWidth: '82%' },

  sheet: {
    flex: 1,
    marginTop: -22,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sparkles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sheet,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 14,
    height: 52,
    marginBottom: 11,
  },
  chip: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, marginLeft: 12, fontFamily: fonts.sans, fontSize: 16, color: colors.ink, height: '100%' },
  eye: { paddingLeft: 8 },

  error: { fontFamily: fonts.sans, fontSize: 14, color: colors.brick, textAlign: 'center', marginBottom: 6, marginTop: -2 },

  ctaWrap: {
    marginTop: 6,
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.clay,
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaDim: { opacity: 0.55 },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  ctaLeft: { position: 'absolute', left: 22 },
  ctaRight: { position: 'absolute', right: 22 },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.2 },

  heartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14 },
  heartRule: { width: 70, height: 1, backgroundColor: colors.rule },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  switchText: { fontFamily: fonts.sans, fontSize: 15, color: colors.body },
  switchLink: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.clay },

  codeTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.ink, textAlign: 'center' },
  codeHint: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.body, textAlign: 'center', lineHeight: 21, marginTop: 6, marginBottom: 14 },
  codeEmail: { fontFamily: fonts.sansBold, color: colors.ink },
  codeInput: {
    height: 60, borderRadius: 16, borderWidth: 1.5, borderColor: colors.rule, backgroundColor: colors.sheet,
    fontFamily: fonts.mono, fontSize: 30, letterSpacing: 12, textAlign: 'center', color: colors.ink,
    paddingLeft: 12, marginBottom: 6,
  },
  codeOk: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: '#3b8a4a', textAlign: 'center', marginBottom: 6 },
  linkBtn: { alignSelf: 'center', paddingVertical: 12 },
  linkTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.clay },
});
