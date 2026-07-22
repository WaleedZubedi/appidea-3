import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { DevReset } from '@/ui/DevReset';
import { useBixi } from '@/game/store';
import { actHydrate } from '@/game/actions';
import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrated = useBixi((s) => s._hydrated);
  const authReady = useAuth((s) => s.ready);
  const userId = useAuth((s) => s.userId);
  const initAuth = useAuth((s) => s.init);
  const [synced, setSynced] = useState(!IS_ONLINE);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // for a signed-in online user, pull server state before rendering routes
  useEffect(() => {
    if (!IS_ONLINE) return;
    if (authReady && userId) {
      actHydrate().finally(() => setSynced(true));
    } else if (authReady && !userId) {
      setSynced(true);
    }
  }, [authReady, userId]);

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const ready = fontsLoaded && hydrated && authReady && synced;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <DevReset />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
