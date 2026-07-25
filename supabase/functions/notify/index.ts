// Bixi streak-risk nudge dispatcher (Area 6, Area 14).
// Called on a schedule (pg_cron → pg_net). Deployed with verify_jwt=false and
// guarded by a shared secret header instead (the caller is our own cron job).
// Finds keepers 20–24h since their daily and sends an Expo push ("Bixi misses you").
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const CRON_SECRET = '8c5f44b3eaeb67e270fc3dc8df00698952d54a629e2f8fd3';

interface Target {
  profile_id: string;
  push_token: string | null;
  bixi_name: string | null;
  streak: number;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-bixi-cron') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('nudge_targets');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targets = (data ?? []) as Target[];
  const messages = targets
    .filter(
      (t) =>
        typeof t.push_token === 'string' &&
        t.push_token.startsWith('ExponentPushToken')
    )
    .map((t) => {
      const name = t.bixi_name ?? 'Bixi';
      return {
        to: t.push_token,
        sound: 'default',
        title: name,
        body: `${name} misses you — keep your ${t.streak}-day streak alive 🔥`,
        data: { type: 'streak_risk' },
      };
    });

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
  }

  return new Response(JSON.stringify({ targets: targets.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
