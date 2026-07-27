/**
 * Runtime config. When EXPO_PUBLIC_SUPABASE_URL + ANON_KEY are set, the app runs in
 * ONLINE mode (real auth + server-authoritative Bixi). When unset, it runs the fully
 * local offline simulation (the demo) — nothing here throws either way.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** true → talk to Supabase; false → offline local sim */
export const IS_ONLINE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export const APP_SCHEME = 'bixi';
export const UNIVERSAL_LINK_HOST = 'bixi.world';

/** EAS projectId for Expo push (set after `eas init`) */
export const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '';

/**
 * Show the floating dev tools (admin panel / reset). On in local dev and in any
 * build where EXPO_PUBLIC_DEV_TOOLS=1 (set for the preview profile in eas.json).
 * MUST be off for the production/App Store build.
 */
export const DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === '1';

/** Show the "Continue with Google" button. Flip to true once the Google
 * provider + Google Cloud OAuth client are configured. Apple is separate. */
export const GOOGLE_SIGNIN = false;

/**
 * PostHog analytics. The key is a PUBLIC, write-only project key — safe to ship
 * in the app binary (same class as the Supabase anon key). Override via env if
 * you ever rotate it. When it doesn't look like a `phc_` key, analytics no-ops.
 */
export const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_Aj4wEtUo5mPuoFPQQoHkYS5Ej5dZ7ST8rvymfqSjHghj';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
export const ANALYTICS_ON = POSTHOG_KEY.startsWith('phc_');

/**
 * Legal pages, hosted alongside the marketing site. Update LEGAL_BASE if the
 * domain changes — Apple review requires these URLs to be live and reachable.
 */
export const LEGAL_BASE = 'https://bixi.world';
export const TERMS_URL = `${LEGAL_BASE}/terms.html`;
export const PRIVACY_URL = `${LEGAL_BASE}/privacy.html`;
