# Personal deployment

Updated 2026-10-23.

Current handoff, 2026-10-28: the owner reports that the live app and owner Google sign-in work. The verification notes below describe the earlier deployment. Planning, backup/restore and PWA features are implemented locally; the latest fixes and migration 0004 still need a separate deployment. See [How Monthwise works](PROJECT-GUIDE.md) and [Release checklist](RELEASE-CHECKLIST.md).

Current app: https://monthwise.fnebihi10.workers.dev
Google callback: https://monthwise.fnebihi10.workers.dev/auth/google/callback

## Verified

- User changed the account namespace to fnebihi10 in the Cloudflare dashboard; API confirmed it.
- Worker monthwise deployed using the personal Wrangler environment.
- Build passed; no schema changes were required.
- Existing monthwise-staging database binding retained. No records copied, reset or deleted.
- Google secret uploaded directly to Cloudflare's secret storage for the new Worker.
- HTTPS homepage returned 200; anonymous ledger returned 401 with no-store.
- Login returned 303 to accounts.google.com using the exact new callback.
- Login cookie has Secure and HttpOnly.
- Code deployment before the secret update: 34615067-11ba-4576-9b45-3aa5580dacef.

## Required owner step

Google Auth Platform -> Clients -> Monthwise staging -> Authorized redirect URIs.
Replace the obsolete callback with:
https://monthwise.fnebihi10.workers.dev/auth/google/callback
Save, then sign in again at the current app. Real login on the new host remains pending this step.

## Future deployments

Use npm run deploy:personal. It builds and deploys with --env personal.
The default Worker name is monthwise-production, distinct from the current personal Worker, to avoid accidentally replacing its database binding. The separate production database is still unused and not initialized.

The current database retains its historical name monthwise-staging. It contains the owner's existing records and is intentionally shared with the personal deployment. Do not reset it or swap bindings without explicit data-migration work.

The old fatlind-monthwise namespace is retired. The previous staging Worker may still appear in the dashboard; it is not the current personal URL. Do not use old bookmarks.

## Release status

This is the existing personal address. Monthly planning, backup/restore and PWA/offline features are implemented in the source. Local release checks passed on 2026-10-28; the current remote code and schema have not been audited during the repository handoff. Physical iPhone verification and deployment of the latest fixes remain separate release tasks.
