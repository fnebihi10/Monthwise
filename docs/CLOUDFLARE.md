# Cloudflare setup

The setup notes below include historical staging steps. For the current implementation and next deployment, use [Architecture](ARCHITECTURE.md), [Personal deployment](PERSONAL-DEPLOYMENT.md) and [Release checklist](RELEASE-CHECKLIST.md). The personal environment retains the existing ledger database; do not initialize or substitute the unused production database for it.

## Completed

- Wrangler login verified on 2026-10-19.
- monthwise-staging created in WEUR; migrations 0001_ledger.sql and 0002_google_sessions.sql applied.
- monthwise-production created in WEUR; schema not yet applied.
- Real D1 binding IDs saved in wrangler.jsonc.
- No local financial records uploaded. Staging Worker published on 2026-10-23; see STAGING.md for verification status.

## Authentication choice

The owner declined Cloudflare Zero Trust's payment-method requirement. Monthwise now uses owner-only Google OAuth instead. Do not activate a Zero Trust plan or configure Access applications for this project.

Read [Google sign-in setup](GOOGLE-SIGN-IN.md) for the remaining Google client and HTTPS hostname configuration.

## Remaining deployment work

1. Create the Google Web application OAuth client.
2. Deploy a staging Worker with its own HTTPS workers.dev hostname. Until its origin and Google credentials are configured, financial API requests must remain unauthorized.
3. Set APP_ORIGIN, OWNER_EMAIL and GOOGLE_CLIENT_ID in staging. Set GOOGLE_CLIENT_SECRET through Cloudflare's secure secret entry.
4. Add the exact /auth/google/callback URI in Google's client settings.
5. Test owner login, rejected accounts, session expiry and sign-out on desktop and iPhone.
6. Initialize the independent production database and repeat with production settings.
7. Add and verify independent backups before real use.

Staging workers.dev is enabled at https://monthwise-staging.fatlind-monthwise.workers.dev. Preview URLs and production workers.dev remain disabled. A purchased domain is not required.

## Local development

npm run dev applies local migrations only, preserving the local development identity and existing ledger records. Cloud OAuth does not replace that shared LAN development workspace. Do not expose the local development server to the Internet.

## Migrations

Applied migration files are immutable. Append later changes. 0001 creates finance records; 0002 adds sign-in attempts, hashed sessions and login rate limits; 0003 adds planning; 0004 adds ledger change tracking and query indexes. Apply all pending migrations before deploying the updated code.

## Staging handoff

Google credentials are configured in staging. Add the exact callback URI in Google as documented in [STAGING.md](STAGING.md). HTTPS, anonymous API rejection and Google redirect checks passed. Real Google sign-in remains pending the callback allowlist and owner testing.

## Current personal URL

The former fatlind-monthwise namespace was renamed to fnebihi10 by the owner. The app is now deployed at https://monthwise.fnebihi10.workers.dev using the personal environment and the existing ledger database. See PERSONAL-DEPLOYMENT.md for verified status and the required new Google callback.
