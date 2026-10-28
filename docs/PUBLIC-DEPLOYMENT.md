# Public deployment handoff — October 28, 2026

The public Worker `monthwise-public` was uploaded from commit `cb0ca29` and has active version `8181ecea-76f2-4f9a-8f5b-8735e91f1ef4`. Its static assets include the homepage and privacy page.

Before initialization, the separate database `monthwise-production` was confirmed to have zero tables and exported to `.wrangler/backups/public-before-first-deploy-2026-10-28.sql`. Migrations 0001 through 0005 were then applied successfully to that database only.

Domain attachment failed with Cloudflare error 100117: `monthwise.online` still has an externally managed website DNS record. The previously reviewed root A record pointed to `192.64.119.142` (Namecheap parking). Remove the conflicting root website record in Cloudflare DNS, preserve email records, then retry deployment/domain attachment. The Worker has no public routing target until this succeeds because workers.dev is disabled.

The public Worker currently has no secrets. The operator must enter the new Google client's `GOOGLE_CLIENT_SECRET` directly into Cloudflare after the Worker exists. Real Google sign-in, Google audience publishing and hosted/device acceptance checks remain pending.

The existing personal Worker `monthwise` and its database `monthwise-staging` were not modified. No personal financial records were read, copied or deleted during this deployment. The owner reports having downloaded a full JSON backup before this work.
