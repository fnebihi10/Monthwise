# Owner-only Worker

The live Monthwise app is [https://monthwise.online/](https://monthwise.online/). This document covers the separate owner-only Wrangler environment, `personal`.

| Setting                      | Value                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| Worker                       | `monthwise`                                                    |
| D1 database                  | `monthwise-staging`                                            |
| Configured owner-only origin | `https://monthwise.fnebihi10.workers.dev`                      |
| Owner-only Google callback   | `https://monthwise.fnebihi10.workers.dev/auth/google/callback` |

The owner-only Worker uses its own Google OAuth client. The database retains the historical name `monthwise-staging` and holds the owner's existing ledger. The public Worker uses a separate D1 database, `monthwise-production`.

`npm run deploy:personal` builds and deploys the owner-only Worker. Verify the target database and pending migrations before a release. Keep the Google client secret in Cloudflare.

The October 2026 hostname move preserved the original database binding. The owner subsequently reported a working Google sign-in. See [Deployment status](PUBLIC-DEPLOYMENT.md) for current checks on the public site.
