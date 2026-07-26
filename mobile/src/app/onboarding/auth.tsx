import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { fonts } from '@/theme';
import { actClaim, actHydrate } from '@/game/actions';
import { useBixi } from '@/game/store';
import { useAuth } from '@/lib/session';
import { identifyUser, track } from '@/lib/analytics';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { Txt } from '@/ui/primitives';

const HERO = require('../../../assets/growth/song.jpg');
const HERO_H = Math.round(Dimensions.get('window').height * 0.4);

/* ── same tokens as the Home screen ── */
const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.38)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';
const SURFACE = 'rgba(12,8,4,0.42)';
const SURFACE_LINE = 'rgba(245,239,227,0.18)';
const ICON = 'rgba(245,239,227,0.62)';

function UserIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={3.6} stroke={ICON} strokeWidth={1.8} fill="none" />
      <Path d="M5 20 C5 15.6 8.1 13.5 12 13.5 C15.9 13.5 19 15.6 19 20" stroke={ICON} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
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

export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const params = useLocalSearchParams<{ invite?: string; inviter?: string; bixi?: string }>();
  const invite = params.invite ? String(params.invite) : null;
  const inviterName = (params.inviter && String(params.inviter)) || 'Your person';
  const bixiName = (params.bixi && String(params.bixi)) || 'their Bixi';
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isUp = mode === 'up';
  const canSubmit =
    email.trim().length >= 4 && password.length >= 6 && (!isUp || username.trim().length >= 1);

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
        /* used/expired — fall through */
      }
    }
    if (isUp) {
      router.replace('/onboarding/name');
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
      const res = await signUpWithPassword(em, password, username.trim());
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          bounces={false}
        >
          {/* ── hero: Bixi singing, with a soft curved bottom into the page ── */}
          <View style={[styles.hero, { height: HERO_H }]}>
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" priority="high" />
            <LinearGradient colors={['rgba(24,16,9,0.35)', 'rgba(24,16,9,0)', 'rgba(24,16,9,0.1)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Svg width="100%" height={54} viewBox="0 0 100 16" preserveAspectRatio="none" style={styles.curve}>
              <Path d="M0,0 Q50,20 100,0 L100,16 L0,16 Z" fill={BG} />
            </Svg>
          </View>

          <View style={styles.body}>
            <Txt style={styles.eyebrow}>{isUp ? 'WELCOME TO' : 'WELCOME BACK TO'}</Txt>
            <Txt style={styles.brand}>Bixi</Txt>
            <Txt style={styles.sub}>
              {isUp
                ? 'A tiny companion for the moments you share.'
                : 'See how your Bixi’s been getting on while you were away.'}
            </Txt>

            {invite ? (
              <View style={styles.inviteBanner}>
                <Txt style={styles.inviteBannerTitle}>{inviterName} & {bixiName} are waiting for you 🌱</Txt>
                <Txt style={styles.inviteBannerSub}>Create your account to join and raise {bixiName} together.</Txt>
              </View>
            ) : null}

            {isUp ? (
              <View style={styles.field}>
                <UserIcon />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your name"
                  placeholderTextColor={FAINT}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={24}
                  textContentType="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  keyboardAppearance="dark"
                  selectionColor={ACCENT}
                  style={styles.input}
                />
              </View>
            ) : null}

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

            {err ? <Txt style={styles.error}>{err}</Txt> : null}

            <Pressable
              onPress={submit}
              style={({ pressed }) => [styles.ctaWrap, (!canSubmit || busy) && styles.ctaDim, pressed && styles.ctaPressed]}
            >
              <LinearGradient colors={['#f5a06d', '#e0703f', '#d05730']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                <Txt style={styles.ctaLabel}>{busy ? 'One moment…' : isUp ? 'Create our account' : 'Sign in'}</Txt>
                <View style={styles.ctaArrow}>
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path d="M4 12 H18 M12 6 L18 12 L12 18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              </LinearGradient>
            </Pressable>

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

  hero: { width: '100%', backgroundColor: '#20140b' },
  curve: { position: 'absolute', left: 0, right: 0, bottom: -1 },

  body: { paddingHorizontal: 26, marginTop: -6, alignItems: 'center' },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2.5, color: ACCENT, marginBottom: 2 },
  brand: { fontFamily: fonts.serifSemibold, fontSize: 42, lineHeight: 46, color: CREAM, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: DIM, marginTop: 8, textAlign: 'center', maxWidth: '92%' },

  inviteBanner: {
    alignSelf: 'stretch', backgroundColor: 'rgba(240,137,95,0.12)',
    borderWidth: 1, borderColor: 'rgba(240,137,95,0.4)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16,
  },
  inviteBannerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM, textAlign: 'center' },
  inviteBannerSub: { fontFamily: fonts.sans, fontSize: 13, color: DIM, textAlign: 'center', marginTop: 3, lineHeight: 18 },

  field: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: SURFACE_LINE,
    borderRadius: 14, paddingHorizontal: 16, height: 52, marginTop: 12,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: CREAM, height: '100%' },

  error: { fontFamily: fonts.sans, fontSize: 13.5, color: '#ffb3a0', textAlign: 'center', marginTop: 12 },

  ctaWrap: {
    alignSelf: 'stretch', marginTop: 18, height: 56, borderRadius: 18, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 9,
  },
  ctaDim: { opacity: 0.5 },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff', letterSpacing: 0.3 },
  ctaArrow: { position: 'absolute', right: 22 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  switchText: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM },
  switchLink: { fontFamily: fonts.sansBold, fontSize: 14.5, color: ACCENT },

  legalLine: { fontFamily: fonts.sans, fontSize: 11.5, color: FAINT, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  legalLink: { fontFamily: fonts.sansSemibold, color: CREAM },
});
