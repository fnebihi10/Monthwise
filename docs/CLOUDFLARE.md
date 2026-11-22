# Cloudflare setup

The live Monthwise app is [https://monthwise.online/](https://monthwise.online/). The custom domain is attached to Worker `monthwise-public` in the `public` Wrangler environment.

| Environment | Worker             | D1 database            |
| ----------- | ------------------ | ---------------------- |
| Public      | `monthwise-public` | `monthwise-production` |
| Personal    | `monthwise`        | `monthwise-staging`    |
| Local       | `monthwise-local`  | Local D1 storage       |

The public Worker uses the custom domain, with its workers.dev route disabled. The separate personal environment has its own origin, Google OAuth client and ledger. Its configuration is documented in [Personal deployment](PERSONAL-DEPLOYMENT.md).

## Local development and releases

- `npm run dev` starts a local Worker and applies local migrations only.
- Use the [release checklist](RELEASE-CHECKLIST.md) for public releases. Apply pending migrations to the intended database and keep applied migrations in source history.
- `npm run check:hosted` checks the public site, including the Google redirect and its callback. See [Deployment status](PUBLIC-DEPLOYMENT.md) for the active release and [Operations](OPERATIONS.md) for backups and monitoring.

See [Google sign-in](GOOGLE-SIGN-IN.md) for the active callback and [Staging deployment](STAGING.md) for the original staging record.
