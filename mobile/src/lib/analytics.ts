/**
 * PostHog analytics — a thin, crash-proof wrapper. Everything is a no-op when no
 * key is configured (ANALYTICS_ON=false), so calling track()/identify() anywhere
 * is always safe. The singleton lets us fire events from non-React code (game
 * actions, sync) as well as components.
 */
import PostHog from 'posthog-react-native';

import { ANALYTICS_ON, POSTHOG_HOST, POSTHOG_KEY } from './config';

export const posthog: PostHog | null = ANALYTICS_ON
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, captureAppLifecycleEvents: true })
  : null;

/** fire a custom event, e.g. track('care_action', { kind: 'feed' }). */
export function track(event: string, props?: Record<string, any>): void {
  try { posthog?.capture(event, props); } catch {}
}

/** tie all following events to a real person (their account id + traits). */
export function identifyUser(id: string, props?: Record<string, any>): void {
  try { posthog?.identify(id, props); } catch {}
}

/** a screen view — drives the "how people move through the app" funnels. */
export function trackScreen(name: string): void {
  try { posthog?.screen(name); } catch {}
}

/** on sign-out: forget the person so the next user starts a clean journey. */
export function resetAnalytics(): void {
  try { posthog?.reset(); } catch {}
}
