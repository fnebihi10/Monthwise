# Staging deployment

Updated 2026-10-23.

## Provisioned and configured

- Worker: monthwise-staging.
- Origin: https://monthwise-staging.fatlind-monthwise.workers.dev
- D1: monthwise-staging, with both ledger and Google-session migrations applied.
- workers.dev route: verified enabled through Cloudflare API.
- Version deployed before secret update: e90c2fb6-c5e6-4f37-b90a-5a39c570f17d.
- Public Google client ID loaded into staging configuration from the owner's downloaded Web OAuth file.
- GOOGLE_CLIENT_SECRET uploaded directly through stdin into Cloudflare secret storage. It is absent from project source and built assets.
- Owner email remains the single allowed Google account.
- Production Worker was not deployed and production schema remains unapplied.

## Verification

- Production build and 20 tests passed immediately before publication.
- Cloudflare deployment command succeeded and returned the origin above.
- Initial TLS handshake failures resolved after hostname activation. HTTPS checks passed: homepage 200, anonymous ledger 401, Google login 303 to accounts.google.com, correct callback and Secure/HttpOnly cookie.
- Deployment and anonymous-access protection are verified. The user saved the Google callback and confirmed successful real owner login on desktop through a screenshot on 2026-10-23.

## Required Google console change

Google Auth Platform -> Clients -> Monthwise staging -> Authorized redirect URIs:
https://monthwise-staging.fatlind-monthwise.workers.dev/auth/google/callback

Save the client configuration. Authorized JavaScript origins are not required by this server-side flow. Ensure the owner's Google account is a permitted test user.

## Remaining checks

- Desktop owner login confirmed. Verify sign-out and physical iPhone/cross-device use.
- Independent backups and offline behavior are later-sprint work.
