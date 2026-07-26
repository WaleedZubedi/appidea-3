/**
 * Deep-link target: bixi://join/<token> or https://bixi.world/join/<token>.
 * - not signed in → sign-up screen, carrying the invite + who's inviting them
 * - signed in → claim immediately
 * - already a member of that pair (e.g. re-tapped the link) → just go home
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { actClaim } from '@/game/actions';
import { useBixi } from '@/game/store';
import { hydrate } from '@/game/sync';
import { invitePreview } from '@/lib/api';
import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';

export default function JoinDeepLink() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const userId = useAuth((s) => s.userId);
  const ready = useAuth((s) => s.ready);
  const handled = useRef(false);

  useEffect(() => {
    if (!token || !ready || handled.current) return;
    handled.current = true;
    const code = String(token);
    (async () => {
      if (!IS_ONLINE) {
        router.replace({ pathname: '/onboarding/join', params: { code } });
        return;
      }
      // not signed in → send them to sign up, carrying the invite + inviter context
      if (!userId) {
        let inviter = '';
        let bixi = '';
        try {
          const p = await invitePreview(code);
          inviter = p.inviter_name ?? '';
          bixi = p.bixi_name ?? '';
        } catch {
          /* invalid/expired — the auth screen still lets them sign up */
        }
        router.replace({ pathname: '/onboarding/auth', params: { invite: code, inviter, bixi } });
        return;
      }
      // signed in → claim the invite
      try {
        await actClaim(code);
        router.replace('/(tabs)');
      } catch {
        // maybe I'm already in this pair (re-tapped the link) — check the server, then route
        await hydrate().catch(() => {});
        if (useBixi.getState().pairId) router.replace('/(tabs)');
        else router.replace({ pathname: '/onboarding/join', params: { code } });
      }
    })();
  }, [token, userId, ready, router]);

  if (!token) return <Redirect href="/" />;
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.clay} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
});
