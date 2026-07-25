import { Redirect } from 'expo-router';

import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';
import { useBixi } from '@/game/store';

export default function Gate() {
  const onboarded = useBixi((s) => s.onboarded);
  const createdAt = useBixi((s) => s.createdAt);
  const pairId = useBixi((s) => s.pairId);
  const userId = useAuth((s) => s.userId);

  if (IS_ONLINE) {
    if (!userId) return <Redirect href="/onboarding/intro" />; // intro → auth
    if (pairId) return <Redirect href="/(tabs)" />;
    return <Redirect href="/onboarding/name" />; // signed in, no Bixi yet → name → hatch → home
  }

  // offline demo
  if (onboarded && createdAt) return <Redirect href="/(tabs)" />;
  return <Redirect href="/onboarding/intro" />;
}
