import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { colors, fonts, radius, space } from '@/theme';
import { useBixi } from '@/game/store';
import { IS_ONLINE, UNIVERSAL_LINK_HOST } from '@/lib/config';
import { actInvite } from '@/game/actions';
import { Eyebrow, LinkButton, PrimaryButton, SecondaryButton, Txt } from '@/ui/primitives';

export default function Invite() {
  const router = useRouter();
  const code = useBixi((s) => s.inviteCode);
  const token = useBixi((s) => s.inviteToken);
  const bixiName = useBixi((s) => s.bixiName);
  const acceptCoParent = useBixi((s) => s.acceptCoParent);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // a real server invite is BIXI-XXXX (9 chars). Anything shorter / the "BIXI-…"
  // fallback means one was never minted.
  const validCode = !!code && code.length >= 8 && !code.includes('…');

  const mintInvite = async () => {
    setError(null);
    setLoading(true);
    try {
      // ONLINE → create_invite RPC, mints a unique code tied to THIS pair and stores it.
      await actInvite();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(
        /auth|not a member|no pair/i.test(msg)
          ? 'You need to be signed in to your Bixi to invite. Sign in and try again.'
          : 'Couldn’t create an invite — check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // If we landed here without a real code (hatch didn't mint one), mint it now.
  useEffect(() => {
    if (IS_ONLINE && !validCode) void mintInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = () => {
    if (!validCode) return;
    Share.share({
      message: `Come raise ${bixiName} with me on Bixi 🌱\n\nOpen the app → “Have an invite code? Join a Bixi” → enter this code:\n\n${code}`,
    }).catch(() => {});
  };

  // offline demo only: pretend the co-parent accepted → bloom
  const simulateJoin = () => {
    acceptCoParent('Your person');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Eyebrow color={colors.clayPress}>Invite your co-parent</Eyebrow>
        <Txt style={styles.title}>{bixiName} is waiting for your person 🥚</Txt>
      </View>

      <View style={styles.center}>
        {loading ? (
          <>
            <ActivityIndicator color={colors.clay} />
            <Txt variant="meta" center>Minting a unique invite code…</Txt>
          </>
        ) : error ? (
          <>
            <Txt variant="body" color={colors.brick} center style={{ maxWidth: 300 }}>
              {error}
            </Txt>
            <SecondaryButton label="Try again" onPress={mintInvite} />
          </>
        ) : (
          <>
            <View style={styles.codeBox}>
              <Txt style={styles.code}>{code}</Txt>
            </View>
            <View style={styles.qrBox}>
              <QRCode
                value={`https://${UNIVERSAL_LINK_HOST}/join/${token ?? code ?? ''}`}
                size={140}
                color={colors.ink}
                backgroundColor="#ffffff"
              />
              <Txt variant="meta" center>scan to join</Txt>
            </View>
            <Txt variant="meta" center style={{ maxWidth: 300 }}>
              This code is unique to {bixiName}. One person, once — they enter it to join,
              and only then does he bloom. Valid 7 days.
            </Txt>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {validCode && !loading && !error && (
          <>
            <PrimaryButton label="Share invite code" onPress={share} />
            <View style={{ height: 10 }} />
          </>
        )}
        {!IS_ONLINE && (
          <>
            <SecondaryButton label="They joined — simulate bloom" onPress={simulateJoin} />
            <View style={{ height: 14 }} />
          </>
        )}
        {IS_ONLINE && <View style={{ height: 14 }} />}
        <LinkButton
          label="I'll invite later — start on my own"
          onPress={() => router.replace('/(tabs)')}
          color={colors.muted}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.xl },
  top: { paddingTop: 40, gap: 8 },
  title: { fontFamily: fonts.serif, fontSize: 25, color: colors.ink, letterSpacing: -0.3, lineHeight: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  codeBox: {
    borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.md,
    paddingVertical: 18, paddingHorizontal: 34, backgroundColor: colors.sheet,
  },
  qrBox: {
    alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.rule, backgroundColor: '#ffffff',
  },
  code: { fontFamily: fonts.mono, fontSize: 30, letterSpacing: 4, color: colors.ink },
  footer: { paddingBottom: 24 },
});
