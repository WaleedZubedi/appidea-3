// Apple "Sign in with Apple" server helpers: build the client-secret JWT (ES256,
// signed with the .p8 key) and use it to exchange an authorization code for a
// refresh token, or revoke a token. Used by `apple-link` (capture at sign-in)
// and `delete-account` (revoke on deletion — App Store Guideline 5.1.1(v)).
//
// Requires these edge-function secrets:
//   APPLE_TEAM_ID     e.g. 74DB45GHW2
//   APPLE_KEY_ID      the Key ID of the "Sign in with Apple" .p8 key
//   APPLE_CLIENT_ID   the app bundle id, world.bixi.app (native sign-in audience)
//   APPLE_PRIVATE_KEY the full .p8 contents (-----BEGIN PRIVATE KEY----- ...)

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function clientSecret(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID')!;
  const keyId = Deno.env.get('APPLE_KEY_ID')!;
  const clientId = Deno.env.get('APPLE_CLIENT_ID')!;
  const pem = Deno.env.get('APPLE_PRIVATE_KEY')!;
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'ES256', kid: keyId })));
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        iss: teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: clientId,
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))
  );
  return `${signingInput}.${b64url(sig)}`;
}

/** Exchange the sign-in authorization code for a long-lived refresh token. */
export async function appleExchangeCode(code: string): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: Deno.env.get('APPLE_CLIENT_ID')!,
    client_secret: await clientSecret(),
    code,
    grant_type: 'authorization_code',
  });
  const r = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.refresh_token ?? null;
}

/** Revoke a stored refresh token so the app fully severs from the Apple ID. */
export async function appleRevoke(refreshToken: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: Deno.env.get('APPLE_CLIENT_ID')!,
    client_secret: await clientSecret(),
    token: refreshToken,
    token_type_hint: 'refresh_token',
  });
  await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}
