# Google sign-in

The live Monthwise app is [https://monthwise.online/](https://monthwise.online/). In Google Auth Platform, the public Web application client uses this authorized redirect URI:

```text
https://monthwise.online/auth/google/callback
```

## Worker configuration

- The public Worker sets `APP_ORIGIN=https://monthwise.online` (no trailing slash) and `ACCESS_MODE=public` in `wrangler.jsonc`.
- `GOOGLE_CLIENT_ID` identifies the public Web application client. Store `GOOGLE_CLIENT_SECRET` in the corresponding Cloudflare Worker environment.
- The separate `personal` environment has its own client and callback and accepts only the configured `OWNER_EMAIL`. See [Personal deployment](PERSONAL-DEPLOYMENT.md).
- Local development uses a development identity and requires no Google credentials.

## Verification

Run `npm run check:hosted` to verify that the public sign-in endpoint redirects to Google with the public callback. Complete the real-account and Google audience checks in [Acceptance](ACCEPTANCE.md).

See [Architecture](ARCHITECTURE.md) for scopes, token validation and session handling.
