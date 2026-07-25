/**
 * Auth session (online mode). Plain email + password — no email confirmation code.
 * Apple/Google sign-in via the OAuth browser flow once those providers are enabled
 * in Supabase. Offline mode → no auth.
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
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
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
    if (data.session) return {}; // signed in immediately (email confirmation off)
    // No session means "Confirm email" is still enabled on the project. With no
    // code UI, sign the user straight in (works once confirmation is turned off).
    const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
    return inErr ? { error: inErr.message } : {};
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return 'offline';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
