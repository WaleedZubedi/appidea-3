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
          router.replace('/(tabs)'); // claimed → home
        } catch {
          // invalid / expired / already-has-Bixi → send to the join screen where
          // the code is prefilled and the real reason is shown (don't silently
          // drop them on home as if it worked).
          router.replace({ pathname: '/onboarding/join', params: { code: String(token) } });
        }
      } else {
        router.replace({ pathname: '/onboarding/join', params: { code: String(token) } });
      }
    })();
  }, [token, userId]);

  if (!token) return <Redirect href="/" />;
  return null;
}
