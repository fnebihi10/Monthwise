# Operating Monthwise

## Diagnostics after deploying this branch

Unexpected API failures return a generic message and an internally generated `X-Request-ID`; the interface shows that reference for support. Search for the reference under the public Worker's Observability logs.

Application failure events contain only event name, scope (`ledger`, `worker` or `auth`), generated request ID, status and timestamp. They omit exception messages/stacks, URLs, query strings, cookies, Google codes/tokens, IPs, emails, financial values and request bodies. Expected validation conflicts are not logged as server errors.

The public environment enables custom logs, disables automatic invocation logs and traces, and requests query-string redaction. Do not enable raw request/body logging when troubleshooting. Cloudflare has its own infrastructure metadata and retention policies.

`GET /api/health` checks required hosted sign-in configuration and a minimal database read. Healthy is HTTP 200 with `{"status":"ok"}`; unhealthy is HTTP 503. Responses are not cached and contain no user records or counts. The public edge guard applies. This does not prove Google availability, successful sign-in, or successful writes/restores.

An external uptime monitor can check this endpoint after release. Monitoring accounts, billing alerts and notification destinations have not been provisioned by these changes.

## Independent database backups

Run `npm run backup:public` while authenticated to Cloudflare. It verifies that public/personal database IDs differ, exports only the public database, and saves a SHA-256 manifest. CLI output containing signed download URLs is captured rather than logged. Files remain under ignored `.wrangler/backups`; they contain private financial data.

Copy the SQL and manifest to an encrypted, access-controlled location outside this computer. A local file alone does not protect against device failure. Do not add backups to Git, CI artifacts or public storage. User JSON exports and provider recovery remain useful additional layers.

Run `npm run recovery:check -- path/to/backup.sql` to verify a SQL backup in a fresh isolated local database. It verifies any checksum manifest, imports with explicit `--local`, and checks D1's supported `quick_check`, foreign keys and ledger usage counters. Its private local report contains record counts. There is no remote restore mode.

`npm run test:recovery` exercises this procedure with synthetic data: create a fresh schema, insert records, export real D1 SQL, import into another fresh database and verify both records survived. CI runs it without cloud credentials or live data.

These scripts provide a verified procedure, not unattended off-device scheduling. For an active beta, back up daily and before migrations; check recent recovery copies regularly. An unattended schedule still needs restricted credentials, encrypted storage and failure notifications.

## Dependencies and release checks

Run `npm audit --audit-level=moderate` and `npm run check` before release. The lockfile updates Wrangler to 4.155 and patches transitive dependencies. Overrides select patched Undici 7.x inside Miniflare and UUID 11.x inside ExcelJS. ExcelJS uses UUID's stable v4 API; unit/browser workbook round trips verify compatibility. A package audit is not a complete security audit.

CI checks Edge on Windows and Chromium plus iPhone-emulated WebKit on Linux, including WCAG A/AA scans and offline reconnection. It also runs synthetic 25,000-record capacity and SQL recovery checks. Emulation and automated accessibility scans do not replace physical devices or assistive technology.

## Release and incident routine

1. Confirm GitHub checks and record the source commit.
2. Back up the public database and verify recovery before schema changes.
3. Deploy public; preserve the personal binding and existing Google secret.
4. Verify health, anonymous API denial, Google redirect, real sign-in and disposable-record persistence.
5. Check two real Google accounts and physical iPhone offline/reconnection before wider promotion.
6. Record the Worker version, checks and limitations in PUBLIC-DEPLOYMENT.md.

For incidents, collect the reference/time, inspect minimal logs, and check Cloudflare status/quotas. Never request users' passwords, cookies or Google secrets. Code rollbacks must preserve schema compatibility; remote database recovery requires a separate reviewed procedure and a backup of the current state.

References: [Cloudflare logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [D1 supported checks](https://developers.cloudflare.com/d1/sql-api/sql-statements/).
