# Deep-link hosting (bixi.pet)

Host these at the root of **bixi.pet** (the domain in §25-A) so invite links resolve.

## Files
- `.well-known/apple-app-site-association` — iOS Universal Links. Served at
  `https://bixi.pet/.well-known/apple-app-site-association` with `Content-Type: application/json`
  and **no redirect**. Replace `YOUR_TEAM_ID` and confirm the bundle id (`pet.bixi.app`).
- `.well-known/assetlinks.json` — Android App Links. Replace the SHA-256 signing fingerprint
  (`eas credentials` / Play Console → App integrity).
- `join.html` — the fallback resolver for `/join/<token>`. Add a Vercel rewrite:
  ```json
  { "rewrites": [{ "source": "/join/:token", "destination": "/join.html" }] }
  ```
  and set the real App Store / Play Store URLs inside it.

## How a co-parent invite flows
1. Inviter shares `https://bixi.pet/join/<token>` (or the `BIXI-XXXX` code).
2. App installed → the OS opens the app directly at `bixi://join/<token>` (see
   `mobile/src/app/join/[token].tsx`) → `claim_invite`.
3. App not installed → `join.html` sends them to the store; after install they reopen the
   link to join. (Full deferred deep-linking with a server-stored claim token is the
   production upgrade — see PRD §13.)
