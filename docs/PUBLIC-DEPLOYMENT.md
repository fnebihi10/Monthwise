# Public deployment status

## Independently checked October 31, 2026

Cloudflare deployment history reports 100% traffic on version `ff4c8c62-c65a-4be9-afe6-52e9d09e1f28`, created October 29 at 15:59:55 UTC. It has no release tag or source message; its exact Git commit is not established by that history. Main is at merge commit `1accfe8` before this maintenance work.

Hosted checks returned health HTTP 200, anonymous ledger HTTP 401 and a Google sign-in redirect HTTP 303. `/api/version` returned 401 because that endpoint is not in the current release. These checks do not sign in or read financial data.

This maintenance change adds `/api/version` using Cloudflare Worker version metadata, a hosted check command and a scheduled health workflow. These changes need deployment/pushing respectively before they operate remotely. No deployment or remote database change was performed during this maintenance work.

Run `npm run deployment:status` to repeat the Cloudflare history check. In Cloudflare, open Workers & Pages → monthwise-public → Deployments and inspect the active version and traffic percentage. A Git commit identifies source; a Worker version ID identifies an uploaded executable; a deployment determines which version receives traffic. A Git push alone does not change the public app.

Remaining acceptance work is tracked in [ACCEPTANCE.md](ACCEPTANCE.md). The sections below preserve historical events only and must not be treated as current setup instructions.

## Latest status

The operator subsequently added the Google secret securely in Cloudflare. Active version after that change was `996cfbe5-654a-4004-94f7-f2407b3d6622`. A hosted check confirmed the correct Google redirect and protected login cookie. The operator confirmed real sign-in, successful JSON restoration, and installation/use of the new domain on iPhone. Two-account hosted isolation and the full physical-device offline flow remain unconfirmed.

A later local quality pass adds diagnostics, dependency patches, refactoring and broader tests. Those changes have not yet been deployed. See [Quality status](QUALITY-STATUS.md).

## Domain attachment history

After the operator removed the root parking A record, domain attachment succeeded. `monthwise.online` now routes to `monthwise-public`, active version `ff225b96-d8b3-4dea-810c-324fcceaeb76`.

Hosted checks confirmed homepage HTTP 200 with CSP, anonymous `/api/ledger` HTTP 401 with no-store, and `/auth/google` HTTP 503 explaining that Google setup is incomplete. `/privacy.html` uses Cloudflare's canonical HTML redirect. The Google client secret still needs to be entered directly by the operator. Public sign-in and personal-record migration have not been completed.

## Initial upload history

The public Worker `monthwise-public` was uploaded from commit `cb0ca29` and has active version `8181ecea-76f2-4f9a-8f5b-8735e91f1ef4`. Its static assets include the homepage and privacy page.

Before initialization, the separate database `monthwise-production` was confirmed to have zero tables and exported to `.wrangler/backups/public-before-first-deploy-2026-10-28.sql`. Migrations 0001 through 0005 were then applied successfully to that database only.

Domain attachment failed with Cloudflare error 100117: `monthwise.online` still has an externally managed website DNS record. The previously reviewed root A record pointed to `192.64.119.142` (Namecheap parking). Remove the conflicting root website record in Cloudflare DNS, preserve email records, then retry deployment/domain attachment. The Worker has no public routing target until this succeeds because workers.dev is disabled.

The public Worker currently has no secrets. The operator must enter the new Google client's `GOOGLE_CLIENT_SECRET` directly into Cloudflare after the Worker exists. Real Google sign-in, Google audience publishing and hosted/device acceptance checks remain pending.

The existing personal Worker `monthwise` and its database `monthwise-staging` were not modified. No personal financial records were read, copied or deleted during this deployment. The owner reports having downloaded a full JSON backup before this work.
