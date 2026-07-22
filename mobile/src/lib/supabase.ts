/**
 * Supabase client. Null in offline mode (no env) so the local sim runs untouched.
 * Session persists in AsyncStorage. See docs/PRD.md §15, supabase/migrations/*.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { IS_ONLINE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const supabase: SupabaseClient | null = IS_ONLINE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** narrowing helper for the online-only call sites */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase not configured (offline mode)');
  return supabase;
}
