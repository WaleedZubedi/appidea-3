import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { fonts } from '@/theme';
import { actClaim, actHydrate } from '@/game/actions';
import { useBixi } from '@/game/store';
import { useAuth } from '@/lib/session';
import { identifyUser, track } from '@/lib/analytics';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { Sprout } from '@/ui/SpecimenSeal';
import { Txt } from '@/ui/primitives';

/* ── dark palette (from our system) ── */
const BG_TOP = '#1a130b';
const BG_BOT = '#0f0b07';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.62)';
const FAINT = 'rgba(245,239,227,0.40)';
const ACCENT = '#f0895f'; // clay light
const LEAF = '#a9d182';
const SURFACE = 'rgba(245,239,227,0.055)';
const SURFACE_LINE = 'rgba(245,239,227,0.14)';
const ICON = 'rgba(245,239,227,0.7)';

/* ── field icons (tuned for the dark surface) ── */
function MailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x={3} y={5} width={18} height={14} rx={3} stroke={ICON} strokeWidth={1.8} fill="none" />
      <Path d="M4 7 L12 13 L20 7" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function LockIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x={5} y={10} width={14} height={10} rx={2.6} stroke={ICON} strokeWidth={1.8} fill="none" />
      <Path d="M8 10 V8 a4 4 0 0 1 8 0 V10" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M2 12 C4.5 7 8 5 12 5 C16 5 19.5 7 22 12 C19.5 17 16 19 12 19 C8 19 4.5 17 2 12 Z" stroke={FAINT} strokeWidth={1.7} fill="none" />
      <Circle cx={12} cy={12} r={3.1} stroke={FAINT} strokeWidth={1.7} fill="none" />
      {off ? <Line x1={4} y1={4} x2={20} y2={20} stroke={FAINT} strokeWidth={1.7} strokeLinecap="round" /> : null}
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

export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithPassword, signUpWithPassword } = useAuth();
  // arriving from an invite deep link → claim it right after the account is made
  const params = useLocalSearchParams<{ invite?: string; inviter?: string; bixi?: string }>();
  const invite = params.invite ? String(params.invite) : null;
  const inviterName = (params.inviter && String(params.inviter)) || 'Your person';
  const bixiName = (params.bixi && String(params.bixi)) || 'their Bixi';
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isUp = mode === 'up';
  const canSubmit = email.trim().length >= 4 && password.length >= 6;

  const friendlyAuthError = (m: string): string => {
    const s = m.toLowerCase();
    if (s.includes('already registered') || s.includes('already exists')) return 'That email already has an account — sign in instead.';
    if (s.includes('invalid login')) return 'Wrong email or password.';
    if (s.includes('not confirmed')) return 'Email confirmation is still on for this project — turn it off in Supabase, or sign in.';
    if (s.includes('for security') || s.includes('rate')) return 'Hang on a few seconds, then try again.';
    return m;
  };

  const afterAuth = async () => {
    const uid = useAuth.getState().userId;
    if (uid) identifyUser(uid, { email: email.trim().toLowerCase() });
    track(isUp ? 'signed_up' : 'signed_in');
    if (invite) {
      try {
        await actClaim(invite);
        router.replace('/(tabs)');
        return;
      } catch {
        /* used/expired — fall through to normal routing */
      }
    }
    if (isUp) {
      router.replace('/onboarding/name'); // new account, no pair yet → name your Bixi
      return;
    }
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
      await afterAuth();
    } else {
      const e = await signInWithPassword(em, password);
      setBusy(false);
      if (e) return setErr(friendlyAuthError(e));
      await afterAuth();
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[BG_TOP, BG_BOT]} style={StyleSheet.absoluteFill} />
      {/* soft accent glows — depth without a photo */}
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
            {/* ── hero (typographic, no image) ── */}
            <View style={styles.mark}>
              <View style={styles.markRing}>
                <Sprout size={26} color={LEAF} />
              </View>
            </View>

            <Txt style={styles.eyebrow}>SPECIMEN Nº 01 · RAISED BY TWO</Txt>

            {isUp ? (
              <Txt style={styles.h1}>
                Keep <Txt style={styles.h1accent}>Bixi</Txt> alive,{'\n'}
                <Txt style={styles.h1em}>together.</Txt>
              </Txt>
            ) : (
              <Txt style={styles.h1}>
                Welcome{'\n'}<Txt style={styles.h1em}>back.</Txt>
              </Txt>
            )}

            <Txt style={styles.sub}>
              {isUp
                ? 'One little creature. Two people. He blooms when you both show up — and won’t make it without you both.'
                : 'See how your Bixi has been getting on while you were away.'}
            </Txt>

            {invite ? (
              <View style={styles.inviteBanner}>
                <Txt style={styles.inviteBannerTitle}>{inviterName} & {bixiName} are waiting for you 🌱</Txt>
                <Txt style={styles.inviteBannerSub}>Create your account to join and raise {bixiName} together.</Txt>
              </View>
            ) : null}

            {/* ── fields ── */}
            <View style={styles.form}>
              <View style={styles.field}>
                <MailIcon />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={FAINT}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  textContentType="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  keyboardAppearance="dark"
                  selectionColor={ACCENT}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <LockIcon />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="password (min 6 characters)"
                  placeholderTextColor={FAINT}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!show}
                  textContentType="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  passwordRules=""
                  keyboardAppearance="dark"
                  selectionColor={ACCENT}
                  onSubmitEditing={submit}
                  style={styles.input}
                />
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
                  <EyeIcon off={show} />
                </Pressable>
              </View>
            </View>

            {err ? <Txt style={styles.error}>{err}</Txt> : null}

            <Pressable
              onPress={submit}
              style={({ pressed }) => [styles.ctaWrap, (!canSubmit || busy) && styles.ctaDim, pressed && styles.ctaPressed]}
            >
              <LinearGradient colors={['#e0703f', '#c5492a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                <Txt style={styles.ctaLabel}>{busy ? 'One moment…' : isUp ? 'Create our account' : 'Sign in'}</Txt>
                <View style={styles.ctaArrow}><ArrowIcon /></View>
              </LinearGradient>
            </Pressable>

            <Txt style={styles.tagline}>It takes two. 🌱</Txt>

            <View style={styles.switchRow}>
              <Txt style={styles.switchText}>{isUp ? 'Already have an account? ' : 'New here? '}</Txt>
              <Pressable onPress={() => { setErr(null); setMode(isUp ? 'in' : 'up'); }} hitSlop={8}>
                <Txt style={styles.switchLink}>{isUp ? 'Sign in' : 'Create one'}</Txt>
              </Pressable>
            </View>

            <Txt style={styles.legalLine}>
              By continuing you agree to our{' '}
              <Txt style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Txt>
              {' '}and{' '}
              <Txt style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Txt>.
            </Txt>
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

  mark: { alignItems: 'flex-start', marginBottom: 18 },
  markRing: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(169,209,130,0.12)', borderWidth: 1, borderColor: 'rgba(169,209,130,0.3)',
  },

  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: ACCENT, marginBottom: 12 },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 40, lineHeight: 44, color: CREAM, letterSpacing: -0.6 },
  h1accent: { color: ACCENT, fontFamily: fonts.serifSemibold },
  h1em: { fontFamily: fonts.serifRegular, fontStyle: 'italic', color: CREAM },
  sub: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23, color: DIM, marginTop: 14, maxWidth: '94%' },

  inviteBanner: {
    backgroundColor: 'rgba(169,209,130,0.12)',
    borderWidth: 1, borderColor: 'rgba(169,209,130,0.3)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 20,
  },
  inviteBannerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM, textAlign: 'center' },
  inviteBannerSub: { fontFamily: fonts.sans, fontSize: 13, color: DIM, textAlign: 'center', marginTop: 3, lineHeight: 18 },

  form: { marginTop: 26, gap: 12 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: SURFACE_LINE,
    borderRadius: 14, paddingHorizontal: 16, height: 54,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: CREAM, height: '100%' },

  error: { fontFamily: fonts.sans, fontSize: 14, color: '#ff9a8a', textAlign: 'center', marginTop: 14 },

  ctaWrap: {
    marginTop: 22, height: 56, borderRadius: 18, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  ctaDim: { opacity: 0.5 },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.2 },
  ctaArrow: { position: 'absolute', right: 22 },

  tagline: { fontFamily: fonts.serifRegular, fontStyle: 'italic', fontSize: 15, color: FAINT, textAlign: 'center', marginTop: 16 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  switchText: { fontFamily: fonts.sans, fontSize: 15, color: DIM },
  switchLink: { fontFamily: fonts.sansBold, fontSize: 15, color: ACCENT },

  legalLine: { fontFamily: fonts.sans, fontSize: 12, color: FAINT, textAlign: 'center', marginTop: 18, lineHeight: 18 },
  legalLink: { fontFamily: fonts.sansSemibold, color: ACCENT },
});
