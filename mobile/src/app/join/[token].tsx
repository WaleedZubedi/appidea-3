/**
 * Deep-link target: bixi://join/<token> or https://bixi.pet/join/<token>.
 * If signed in (online) → claim immediately. Otherwise send to the join screen with the
 * code prefilled (and, once auth is added, claim after sign-in).
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { actClaim } from '@/game/actions';
import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';

export default function JoinDeepLink() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const userId = useAuth((s) => s.userId);

  useEffect(() => {
    if (!token) return;
    (async () => {
      if (IS_ONLINE && userId) {
        try {
          await actClaim(String(token));
        } catch {
          /* invalid/expired — fall through */
        }
        router.replace('/(tabs)');
      } else {
        router.replace({ pathname: '/onboarding/join', params: { code: String(token) } });
      }
    })();
  }, [token, userId]);

  if (!token) return <Redirect href="/" />;
  return null;
}
