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
