# Owner-only Google sign-in

Cloudflare Zero Trust is no longer used. No Zero Trust subscription or payment method is needed for this authentication design.

## What the app implements

- OAuth authorization code flow with PKCE S256, state and nonce.
- Only the verified email configured as OWNER_EMAIL can sign in.
- Google ID token signature, issuer, audience, expiry, nonce and email_verified are checked.
- Owner records use the stable Google subject (google:SUBJECT), not email.
- Opaque seven-day sessions; only hashes are stored in D1.
- Secure HttpOnly SameSite=Lax host-only cookies. Logout is a same-origin POST and revokes the database session.
- Browser-bound one-time sign-in attempts expire after ten minutes.
- Google access/refresh tokens are not retained; requested scopes are only openid and email.
- Local development remains an explicitly labelled shared local workspace.

## Current configuration status

A Google Web OAuth client is configured in staging, and its secret is stored in Cloudflare. The staging hostname and HTTPS/API/Google-redirect checks are verified. Real Google login remains pending the callback allowlist and owner testing. See STAGING.md.
Staging and production D1 databases already exist. Staging has both 0001_ledger.sql and 0002_google_sessions.sql applied.
Production still needs both migrations. Real login has not been verified yet.

## Google setup

1. Open https://console.cloud.google.com/ and create/select a project named Monthwise. OAuth setup does not require enabling a billing account or starting a cloud trial.
2. Open Google Auth Platform. Configure Branding with the app name and your support/contact email.
3. Use External audience for a personal Gmail account. Keep Testing initially and add only your own Google email as a test user.
4. Request only openid and email; no Gmail, Drive or financial-account permissions.
5. Under Clients, create an OAuth client of type Web application.
6. Add the exact authorized redirect URI: https://monthwise-staging.fatlind-monthwise.workers.dev/auth/google/callback. Do not invent a hostname; use the verified Worker URL after deployment. Separate staging/production clients are recommended.
7. Save the client ID as GOOGLE_CLIENT_ID. Save the client secret through Cloudflare's secret entry, never in source control or a chat message.

## Worker configuration

Non-secret vars per environment:

- APP_ORIGIN: exact HTTPS origin, no path (e.g. https://monthwise-staging.YOUR-SUBDOMAIN.workers.dev).
- OWNER_EMAIL: the only allowed Google email. Initially the same Gmail used for your Cloudflare account; change deliberately if needed.
- GOOGLE_CLIENT_ID: the Google Web application client ID.
- MODE: production for all hosted deployments.

Secret per environment:

- GOOGLE_CLIENT_SECRET: enter directly using Wrangler's interactive secret prompt or Cloudflare dashboard.

No application session signing secret is needed: session tokens are cryptographically random, opaque and hashed in the database.
Do not put the client secret in a VITE_ variable, wrangler vars, docs, screenshots or Git.

## Deployment order

1. Staging migrations are applied. Keep the local-only development identity disabled in hosted settings.
2. Deploy staging with an HTTPS hostname; absent Google settings must fail closed with no financial API access.
3. Configure the real origin, client ID, owner email and client secret.
4. Set the exact callback URI in Google.
5. Test successful owner login, another account being denied, sign-out, expired sessions, and iPhone Safari.
6. Initialize production and repeat with the independent production configuration.
7. Do not claim offline support or independent backup recovery until the later sprints are implemented.

## References

- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Google OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- OAuth client setup: https://developers.google.com/workspace/guides/create-credentials
- OAuth library: https://github.com/panva/oauth4webapi
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/
