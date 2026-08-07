/**
 * Auth session (online mode). Plain email + password — no email confirmation code.
 * Apple/Google sign-in via the OAuth browser flow once those providers are enabled
 * in Supabase. Offline mode → no auth.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
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
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithProvider: (provider: 'apple' | 'google') => Promise<string | null>;
  signInWithApple: () => Promise<string | null>; // native iOS "Sign in with Apple"
  resetPassword: (email: string) => Promise<{ error?: string }>;
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

  signUpWithPassword: async (email, password, name) => {
    if (!supabase) return { error: 'offline' };
    // `name` flows to profiles.display_name via the handle_new_user trigger
    // (coalesce(raw_user_meta_data->>'name', email prefix)) → shows in-app.
    const trimmed = name?.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: trimmed ? { data: { name: trimmed } } : undefined,
    });
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

  signInWithApple: async () => {
    if (!supabase) return 'offline';
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) return 'No Apple token returned';
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: cred.identityToken,
      });
      if (error) return error.message;
      // Apple only returns the name on the FIRST authorization — persist it now.
      const name = `${cred.fullName?.givenName ?? ''} ${cred.fullName?.familyName ?? ''}`.trim();
      if (name) {
        try { await supabase.rpc('set_display_name', { p_name: name }); } catch {}
      }
      // Hand the one-time auth code to the server so it can store a refresh token
      // and revoke it if the user later deletes their account (Guideline 5.1.1(v)).
      // Best-effort — never block sign-in on it.
      if (cred.authorizationCode) {
        try { await supabase.functions.invoke('apple-link', { body: { code: cred.authorizationCode } }); } catch {}
      }
      return null;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err?.code === 'ERR_REQUEST_CANCELED') return 'cancelled';
      return err?.message ?? 'Apple sign-in failed';
    }
  },

  resetPassword: async (email) => {
    if (!supabase) return { error: 'offline' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'https://bixi.world/reset',
    });
    return error ? { error: error.message } : {};
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ userId: null });
  },
}));
