// apple-link: called right after a native "Sign in with Apple". Takes the
// one-time authorization code, exchanges it for a refresh token, and stores it
// so delete-account can revoke it later (Guideline 5.1.1(v)). verify_jwt=true →
// only the signed-in user, only for themselves.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { appleExchangeCode } from '../_shared/apple.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let code: string | undefined;
  try {
    code = (await req.json())?.code;
  } catch {
    /* no body */
  }
  if (!code) {
    return new Response(JSON.stringify({ error: 'missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const refresh = await appleExchangeCode(code);
  if (!refresh) {
    // Non-fatal: sign-in already succeeded. We just won't be able to revoke.
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  await admin
    .from('apple_tokens')
    .upsert({ user_id: user.id, refresh_token: refresh, updated_at: new Date().toISOString() });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
