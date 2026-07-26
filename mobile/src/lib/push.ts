/**
 * Expo push registration (Area 6 / PRD §14). Asked AFTER first care ("remind you if
 * Bixi's feeling lonely?"). The token is stored on the profile; the `notify` Edge
 * Function + cron dispatch the "Bixi misses you" nudges.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { setPushToken } from './api';
import { EAS_PROJECT_ID, IS_ONLINE } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** request permission + return an Expo push token (or null if unavailable/denied). */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bixi',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined
    );
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Request permission, save the push token, and fire an immediate local nudge so
 * the user actually SEES notifications working. Returns true if permission was
 * granted. Used by the You-screen toggle and the after-first-action prompt.
 */
export async function enableNotifications(bixiName: string): Promise<boolean> {
  const token = await registerForPush();
  if (token && IS_ONLINE) {
    try { await setPushToken(token); } catch {}
  }
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: bixiName || 'Bixi',
        body: `You’re all set — ${bixiName || 'Bixi'} will nudge you when he needs you or misses you 🌱`,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
    return true;
  } catch {
    return false;
  }
}
