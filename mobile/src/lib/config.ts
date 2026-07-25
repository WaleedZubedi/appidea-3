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
export const UNIVERSAL_LINK_HOST = 'bixi.pet';

/** EAS projectId for Expo push (set after `eas init`) */
export const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '';

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
export const LEGAL_BASE = 'https://bixi.pet';
export const TERMS_URL = `${LEGAL_BASE}/terms.html`;
export const PRIVACY_URL = `${LEGAL_BASE}/privacy.html`;
