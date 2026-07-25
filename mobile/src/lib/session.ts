/**
 * Auth session (online mode). Email OTP works out of the box; Apple/Google via the
 * OAuth browser flow once you enable those providers in Supabase. Offline mode → no auth.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';

import { IS_ONLINE } from './config';
import { supabase } from './supabase';

interface AuthState {
  ready: boolean;
  userId: string | null;
  online: boolean;
  init: () => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string; needsCode?: boolean }>;
  verifySignupCode: (email: string, token: string) => Promise<string | null>;
  resendSignupCode: (email: string) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  sendEmailOtp: (email: string) => Promise<string | null>; // returns error msg or null
  verifyEmailOtp: (email: string, token: string) => Promise<string | null>;
  signInWithProvider: (provider: 'apple' | 'google') => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  ready: !IS_ONLINE,
  userId: null,
  online: IS_ONLINE,

  init: async () => {
    if (!supabase) {
      set({ ready: true, userId: null });
      return;
    }
    // The listener fires an INITIAL_SESSION event on subscribe with the restored
    // session, and again on any refresh/sign-in/out — this is the source of truth.
    supabase.auth.onAuthStateChange((_e, session) => {
      set({ userId: session?.user?.id ?? null, ready: true });
    });
    // Back it up with getSession, but NEVER null a valid session just because a
    // slow refresh lost a timeout race — only unblock first render.
    const load = supabase.auth
      .getSession()
      .then(({ data }) => set({ userId: data.session?.user?.id ?? null }))
      .catch(() => {});
    const guard = new Promise<void>((res) => setTimeout(res, 4000));
    await Promise.race([load, guard]);
    set({ ready: true });
  },

  signUpWithPassword: async (email, password) => {
    if (!supabase) return { error: 'offline' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // Email-confirmation is ON → no session yet; Supabase emailed a 6-digit code.
    if (!data.session) return { needsCode: true };
    return {}; // confirmation OFF → already signed in
  },

  verifySignupCode: async (email, token) => {
    if (!supabase) return 'offline';
    const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'signup' });
    return error?.message ?? null;
  },

  resendSignupCode: async (email) => {
    if (!supabase) return 'offline';
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return error?.message ?? null;
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return 'offline';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  sendEmailOtp: async (email) => {
    if (!supabase) return 'offline';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return error?.message ?? null;
  },

  verifyEmailOtp: async (email, input) => {
    if (!supabase) return 'offline';
    const trimmed = input.trim();
    // If they pasted the whole magic link from the email, verify via its token_hash.
    if (/token/i.test(trimmed) && trimmed.length > 12) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://x/?${trimmed}`);
        const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token');
        const linkType = (url.searchParams.get('type') as 'email' | 'magiclink') || 'email';
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: linkType });
          return error?.message ?? null;
        }
      } catch {
        /* not a URL — fall through to code path */
      }
    }
    // Otherwise treat it as the 6-digit code.
    const { error } = await supabase.auth.verifyOtp({ email, token: trimmed, type: 'email' });
    return error?.message ?? null;
  },

  signInWithProvider: async (provider) => {
    if (!supabase) return 'offline';
    const redirectTo = Linking.createURL('/auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return error.message;
    if (!data?.url) return 'no auth url';
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success' || !res.url) return 'cancelled';
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(res.url);
    return exErr?.message ?? null;
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ userId: null });
  },
}));
