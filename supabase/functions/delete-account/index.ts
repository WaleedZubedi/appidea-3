// Bixi account deletion (Area 9 / App Store / GDPR / CCPA).
// verify_jwt=true → only a signed-in user can call it, and only for themselves.
// Deleting the auth user cascades: profiles → pair_members (membership trigger
// clears revive_pending + voids their invites; cleanup_empty_pair tidies an
// emptied pair). A paired partner keeps the Bixi as a solo unit.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';

  // resolve WHO is calling from their JWT (never trust a body param)
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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deleted: user.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
