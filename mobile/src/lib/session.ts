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
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
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
    // never let a slow/unreachable backend block the first render
    try {
      const timeout = new Promise<{ data: { session: null } }>((res) =>
        setTimeout(() => res({ data: { session: null } }), 4000)
      );
      const { data } = await Promise.race([supabase.auth.getSession(), timeout]);
      set({ userId: data.session?.user?.id ?? null });
      supabase.auth.onAuthStateChange((_e, session) => {
        set({ userId: session?.user?.id ?? null });
      });
    } catch {
      /* offline / unreachable — proceed unauthenticated */
    } finally {
      set({ ready: true });
    }
  },

  signUpWithPassword: async (email, password) => {
    if (!supabase) return 'offline';
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    // If email-confirmation is ON in Supabase, signUp returns a user but no session.
    if (!data.session) {
      // Auto-confirm this fresh signup server-side (no email delivery needed), then sign in.
      await supabase.rpc('confirm_signup', { target_email: email });
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) return sErr.message;
    }
    return null;
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
