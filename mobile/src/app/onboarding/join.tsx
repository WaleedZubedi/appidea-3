import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { actClaim } from '@/game/actions';
import { IS_ONLINE } from '@/lib/config';
import { invitePreview, type InvitePreview } from '@/lib/api';
import { successHaptic } from '@/lib/haptics';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const ACCENT = '#f0895f';
const BRICK = '#ff8a7a';

export default function Join() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(
    (params.code ?? '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);

  const inviter = preview?.inviter_name ?? 'your person';
  const bixiLabel = preview?.bixi_name ?? 'Bixi';
  const ready = code.trim().length === 4;

  // NOTE: intentionally NO auto-focus. Programmatically focusing this field
  // while arriving from the password screen is what let iOS latch its armed
  // strong-password AutoFill onto it (yellow overlay, no border radius, taps
  // hijacked). The user taps to focus — exactly like the working name field.

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/onboarding/name');
  };

  const friendlyError = (e: unknown): string => {
    const m = (e as { message?: string })?.message ?? '';
    if (m.includes('cannot_join_own_bixi')) return 'That’s your own code — share it with your person instead.';
    if (m.includes('leave_partner_first')) return 'You’re already co-parenting a Bixi. Leave that one first (You → Leave co-parent).';
    if (m.includes('already_has_bixi')) return 'You already have a Bixi — leave it first to join another.';
    if (m.includes('invite_used')) return 'That invite has already been used.';
    if (m.includes('invite_expired')) return 'That invite has expired — ask for a fresh code.';
    if (m.includes('invalid_invite')) return 'We couldn’t find that code. Double-check it and try again.';
    if (m.includes('pair_full')) return 'That Bixi already has two keepers.';
    if (m.includes('authenticated')) return 'Please sign in again to join.';
    return 'Something went wrong joining. Try again.';
  };

  const findBixi = async () => {
    if (!ready || busy) return;
    setErr(null);
    if (!IS_ONLINE) { setConfirming(true); return; }
    setBusy(true);
    try {
      const p = await invitePreview(code.trim());
      setPreview(p);
      setConfirming(true);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmJoin = async () => {
    successHaptic();
    setErr(null);
    setBusy(true);
    try {
      await actClaim(code.trim());
      router.replace('/(tabs)');
    } catch (e) {
      setErr(friendlyError(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack} hitSlop={12}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M15 5l-7 7 7 7" stroke={CREAM} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Join your person</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {!confirming ? (
          <View style={styles.body}>
            <Text style={styles.eyebrow}>ENTER THEIR 4-LETTER CODE</Text>
            <Text style={styles.lede}>Ask your person for the code on their Home screen.</Text>

            {/* one real, full-size, visible input — reliably accepts typing */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => {
                setErr(null);
                setCode(t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4));
              }}
              placeholder="ABCD"
              placeholderTextColor="rgba(245,239,227,0.28)"
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="ascii-capable"
              maxLength={4}
              returnKeyType="go"
              onSubmitEditing={findBixi}
              keyboardAppearance="dark"
              selectionColor={ACCENT}
              style={styles.input}
            />

            {err ? <Text style={styles.err}>{err}</Text> : null}

            <View style={styles.flexGrow} />

            <Pressable
              disabled={!ready || busy}
              onPress={findBixi}
              style={({ pressed }) => [styles.primary, (!ready || busy) && styles.primaryOff, pressed && ready && { opacity: 0.9 }]}
            >
              {busy ? <ActivityIndicator color="#1a120a" /> : <Text style={styles.primaryTxt}>Find their Bixi</Text>}
            </Pressable>
            <Pressable onPress={goBack} style={styles.cancel} hitSlop={8}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={{ fontSize: 44 }}>🌱</Text>
              <Text style={styles.eyebrow}>YOU'RE JOINING</Text>
              <Text style={styles.cardName}>{inviter}'s {bixiLabel}</Text>
              {preview ? (
                <Text style={styles.cardMeta}>caring since Day {String(preview.day).padStart(3, '0')}</Text>
              ) : null}
              <Text style={styles.cardBody}>
                Once you join, {bixiLabel} blooms — and you're both his keepers.
              </Text>
            </View>

            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={styles.flexGrow} />

            <Pressable
              disabled={busy}
              onPress={confirmJoin}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
            >
              {busy ? <ActivityIndicator color="#1a120a" /> : <Text style={styles.primaryTxt}>Join {inviter} & bloom {bixiLabel}</Text>}
            </Pressable>
            <Pressable onPress={() => { setConfirming(false); setPreview(null); }} style={styles.cancel} hitSlop={8}>
              <Text style={styles.cancelTxt}>Not you? Enter a different code</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingHorizontal: 24 },
  flex: { flex: 1 },
  flexGrow: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: CREAM },

  body: { flex: 1, paddingTop: 20 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.4, color: ACCENT },
  lede: { fontFamily: fonts.sans, fontSize: 15, color: DIM, marginTop: 8, lineHeight: 21 },

  input: {
    marginTop: 28,
    height: 80,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(245,239,227,0.18)',
    backgroundColor: 'rgba(245,239,227,0.06)',
    fontFamily: fonts.mono,
    fontSize: 44,
    letterSpacing: 14,
    textAlign: 'center',
    paddingLeft: 14, // offset letterSpacing so text sits centered
    color: CREAM,
  },

  err: { fontFamily: fonts.sans, fontSize: 14, color: BRICK, marginTop: 16 },

  primary: {
    height: 56, borderRadius: 28, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  primaryOff: { backgroundColor: 'rgba(245,239,227,0.14)', shadowOpacity: 0 },
  primaryTxt: { fontFamily: fonts.sansBold, fontSize: 16.5, color: '#1a120a' },
  cancel: { alignSelf: 'center', paddingVertical: 16 },
  cancelTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },

  card: {
    alignItems: 'center', gap: 8, marginTop: 12, padding: 26, borderRadius: 22,
    backgroundColor: 'rgba(245,239,227,0.05)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.14)',
  },
  cardName: { fontFamily: fonts.serifSemibold, fontSize: 24, color: CREAM, textAlign: 'center' },
  cardMeta: { fontFamily: fonts.mono, fontSize: 12, color: DIM },
  cardBody: { fontFamily: fonts.sans, fontSize: 15, color: DIM, textAlign: 'center', lineHeight: 21, marginTop: 4 },
});
