# Public Monthwise launch

## Status on October 28, 2026

The existing personal Worker is `monthwise`, at https://monthwise.fnebihi10.workers.dev. Its most recent deployment inspected during this work was October 24. Pushing to GitHub did not update it.

The public version is prepared on `feat/public-multiuser`. It has not been deployed. The original GitHub `main` checks passed. The operator created the Monthwise Online Google project and supplied its public client ID. The client secret, domain connection and Google audience still require configuration before release.

The public environment targets a new Worker, `monthwise-public`, and the existing unused D1 database `monthwise-production`. Read-only inspection confirmed zero tables in that database on October 28. Your personal data stays in `monthwise-staging`. Neither remote database was changed during implementation.

## What changes for users

Public mode accepts any correctly verified Google identity. Each Google subject has its own ledger, account totals, income, expenses, planning, savings goals, annual overview and exports. Existing ownership constraints apply to every user. There is no shared household ledger, bank integration, password login or automatic currency conversion. Amounts currently use EUR.

`ACCESS_MODE=public` is explicit. Missing access mode preserves owner-only behavior; unknown values fail closed. The personal environment remains `owner`.

| Protection                         | Initial setting                                                      |
| ---------------------------------- | -------------------------------------------------------------------- |
| Login initiation                   | 20 attempts per IP hash per minute in D1                             |
| Coarse edge flood guard            | 600 API/auth requests per IP hash per minute per Cloudflare location |
| Authenticated reads                | 240 per user per minute in D1                                        |
| Writes                             | 120 per user per minute in D1                                        |
| Full-ledger reads and JSON exports | 6 per public user per minute                                         |
| Restore attempts                   | 3 per public user per minute                                         |
| Ledger capacity                    | 25,000 total records per user, enforced by database triggers         |
| JSON recovery file                 | 8 MB and 25,000 total records                                        |
| Active sessions                    | At most 10 per user; each expires after seven days                   |
| Account deletion                   | Explicit confirmation and sign-in within the last ten minutes        |

The IP limit is intentionally coarse because many people can share an IP. Cloudflare edge counters are approximate and regional; durable per-user D1 limits supplement them. These limits reduce abuse; they do not guarantee protection against every attack or unlimited hosting capacity.

Backup export validates its limits before download. A ledger whose JSON exceeds 8 MB needs operator-assisted recovery/export; regular backups are recommended. The per-user record quota does not promise unlimited overall database capacity.

## Step 1 — Google sign-in configuration

Create a separate production Google Cloud project and a Web application OAuth client. In Google Auth Platform:

1. Set the app name to Monthwise and the support/contact email to `nebigifatlind@gmail.com`, as supplied by the operator.
2. Configure the audience as External and review the production publishing requirements. Request only `openid` and `email`.
3. Add the exact authorized redirect URI: `https://monthwise.online/auth/google/callback`.
4. The planned homepage is `https://monthwise.online/` and the privacy page is `/privacy.html` on that host. These pages become available after the first configured deployment.
5. Put the new client ID in `env.public.vars.GOOGLE_CLIENT_ID` in `wrangler.jsonc`.

The callback is an endpoint, not a page to open manually. Store the client secret in Cloudflare's secret storage; do not put it in source, GitHub, screenshots or chat. The owner can enter it locally with `npx wrangler secret put GOOGLE_CLIENT_SECRET --env public` when the public Worker exists. If Wrangler offers to create the new public Worker for secret setup, verify that the name is `monthwise-public` before proceeding.

A custom domain can be chosen before the final launch. Google's production branding/verification requirements must be reviewed for the chosen hostname and domains under the operator's control. If the origin changes, update APP_ORIGIN and the exact Google callback together. The personal Google client and callback remain separate.

Official references: [Google production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance), [Google audience settings](https://support.google.com/cloud/answer/15549945?hl=en).

## Step 2 — Review the concrete release

Review the privacy page, support address, limits and database bindings. Run `npm run check`. Run `node scripts/check-public-config.mjs`; it checks local settings only and does not verify the remote client secret, domain activation or Google audience. Review and merge the feature branch before releasing.

Check `wrangler.jsonc`: public uses database ID `333feb62-aa82-41b7-8b03-7d330e45eff5`; personal uses `33853f06-8e98-4422-89cb-4bd2221cc442`. Do not interchange them.

## Step 3 — Deploy after Google setup and release approval

These commands are a later release procedure; they were not run during implementation:

```sh
npx wrangler d1 export DB --env public --remote --output .wrangler/backups/public-before-launch.sql
npx wrangler d1 migrations apply DB --env public --remote
npm run deploy:public
```

All migrations, including 0004 and 0005, must be present before the updated code handles financial requests. Public mode fails closed if its edge limiter is missing. Add GOOGLE_CLIENT_SECRET securely and verify it exists in the public Worker before testing sign-in. A backup directory may need to be created locally before exporting.

## Step 4 — Verify before inviting people

Use two real Google accounts. Verify a fresh empty ledger for each, enter disposable records, and confirm neither account sees the other's records. Test export, restore, account deletion, sign-out, shared-browser switching, iPhone installation and offline reconnection. The automated tests cover these boundaries locally; they do not replace real Google and device checks.

In Cloudflare, review Worker errors and D1 usage. Set usage/billing notifications appropriate to the account plan. D1 Free has finite daily operations and storage; reaching limits can interrupt the app. Do not enable logging that captures OAuth callback codes, cookies, credentials or financial request bodies. Set up independent database backups and an incident/contact procedure. Do not change to a paid plan without the operator's decision.

Official references: [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 capacity and quotas](https://developers.cloudflare.com/d1/reference/faq/).
