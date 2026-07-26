import { Image } from 'expo-image';
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
import { Txt } from '@/ui/primitives';

const BG = require('../../../assets/images/signup-bg.jpg');

/* ── palette tuned to the artwork ── */
const CREAM = '#f4ead2';
const DIM = 'rgba(244,234,210,0.82)';
const FAINT = 'rgba(244,234,210,0.5)';
const LEAF = '#b7dd86';
const GREEN_INK = '#33471f'; // text on the cream button
const SURFACE = 'rgba(10,16,7,0.55)';
const SURFACE_LINE = 'rgba(233,214,150,0.34)';
const ICON = 'rgba(244,234,210,0.8)';

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
        /* used/expired — fall through to normal routing */
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
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" priority="high" />
      {/* soft bottom scrim so the fields stay legible over the artwork */}
      <LinearGradient
        colors={['transparent', 'rgba(8,14,6,0.35)', 'rgba(8,14,6,0.72)']}
        locations={[0.4, 0.66, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafeAreaView edges={['bottom']} style={[styles.form, { paddingBottom: insets.bottom + 14 }]}>
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
                  selectionColor={LEAF}
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
                selectionColor={LEAF}
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
                selectionColor={LEAF}
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
              style={({ pressed }) => [styles.cta, (!canSubmit || busy) && styles.ctaDim, pressed && styles.ctaPressed]}
            >
              <Txt style={styles.ctaLabel}>{busy ? 'One moment…' : isUp ? 'Create our account' : 'Sign in'}</Txt>
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
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#26311a' },
  flex: { flex: 1 },
  // push the form into the lower (empty) part of the artwork; it rises with the keyboard
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  form: { paddingHorizontal: 26 },

  inviteBanner: {
    backgroundColor: 'rgba(10,16,7,0.6)', borderWidth: 1, borderColor: SURFACE_LINE,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14,
  },
  inviteBannerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM, textAlign: 'center' },
  inviteBannerSub: { fontFamily: fonts.sans, fontSize: 13, color: DIM, textAlign: 'center', marginTop: 3, lineHeight: 18 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: SURFACE_LINE,
    borderRadius: 14, paddingHorizontal: 16, height: 50, marginBottom: 10,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: CREAM, height: '100%' },

  error: { fontFamily: fonts.sans, fontSize: 13.5, color: '#ffc7b6', textAlign: 'center', marginBottom: 8, marginTop: -2 },

  cta: {
    marginTop: 6, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: CREAM,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  ctaDim: { opacity: 0.55 },
  ctaPressed: { transform: [{ scale: 0.99 }] },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: GREEN_INK, letterSpacing: 0.2 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  switchText: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM },
  switchLink: { fontFamily: fonts.sansBold, fontSize: 14.5, color: LEAF },

  legalLine: { fontFamily: fonts.sans, fontSize: 11.5, color: FAINT, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  legalLink: { fontFamily: fonts.sansSemibold, color: CREAM },
});
