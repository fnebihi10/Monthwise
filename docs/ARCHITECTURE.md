# Architecture

## Current version

Monthwise is a personal finance PWA with owner-only and explicit public access modes built with React 19, strict TypeScript, Vite, Cloudflare Workers and D1. The browser calls same-origin Worker endpoints. Cloudflare serves the built static assets.

## Identity and request protection

Google OAuth uses PKCE, nonce and a one-time browser-bound login attempt. oauth4webapi performs the code exchange; jose verifies signed ID tokens, issuer, audience, expiry, nonce, verified email and authorized party. Owner mode permits only OWNER_EMAIL. Explicit public mode permits any correctly verified Google identity. Unknown access modes fail closed. Ownership always uses the stable Google subject. Public launch uses a separate Worker and database; see PUBLIC-LAUNCH.md.

Sessions last seven days. D1 stores only the SHA-256 hash of a random opaque token. The browser cookie is host-only, Secure, HttpOnly and SameSite=Lax. Every authenticated request rechecks the owner configuration. Logout revokes the session and clears private browser storage across tabs. Google access and refresh tokens are not retained.

Mutations require a matching Origin and reject cross-site requests. JSON bodies are limited to 8 KiB, except restore. Durable owner-scoped rate limits permit 120 mutations per minute. Private responses use Cache-Control: no-store. SQL values are parameterized and composite foreign keys enforce account ownership.

Local authentication requires explicit local mode, a loopback Worker URL and no Google credentials. Vite proxies local API requests and rewrites only matching development origins. The shared local identity is for sample data on a trusted network.

## Accounting and planning

Money uses integer EUR cents. Account balances derive from opening balances, actual transactions and transfers. Opening balances and transfers never count as income or expenses. One transfer row references both accounts, so both balance effects exist atomically.

Budgets are monthly limits. Plans hold expected income and bill occurrences; recurring plans can be copied without copying payments. Paying a plan atomically creates and links one actual transaction. Goals and allocations reserve money without recording spending. Unassigned money is current account balances minus the selected month's unpaid bills and all goal allocations.

Entry updates and deletes require the last-seen revision. Account edits compare the prior values. Identical retried entry creates succeed without duplicates; conflicting payloads return 409.

## Loading and change detection

The browser bootstraps entries and transfers through /api/ledger?paged=1 with a maximum of 500 rows per collection per page. Opaque record IDs act as keyset cursors. Account balances and planning metadata arrive on the first page. No partial snapshot is displayed or cached.

Migration 0004 adds per-owner ledger versions and triggers covering inserts, updates and deletes on every ledger table. Each page reads its version in the same D1 batch as its data. The client checks versions across pages and at completion, restarting up to three times if records change. This prevents combining inconsistent pages.

Online, visible tabs check the lightweight /api/ledger/version endpoint every minute and on focus or reconnection. Unchanged ledgers do not download history or rewrite the IndexedDB snapshot. A local mutation forces a reload. Entry and transfer indexes support account totals and cursor reads. The full ledger remains in browser memory for cross-month search, annual summaries, offline use and exports; pagination bounds transfer size rather than total browser memory.

The unpaged endpoint remains available for full exports and integration consumers. It is authenticated and owner-scoped like the paginated endpoint.

## Offline operation

A versioned service worker precaches the app shell and excludes /api/ and /auth/. IndexedDB stores owner-scoped snapshots and pending entry creates. Offline edits, transfers, planning changes and restores are not supported.

Queued entries use stable IDs. Reconnection retries network failures, HTTP 408/425/429 and server errors; a temporary failure stops the current pass to avoid hammering the server. Permanent validation/conflict errors remain visible for review, export or discard. Legacy queue errors without a status are retried. HTTP 401 locks the cache while retaining pending entries for reauthentication. Sign-out explicitly clears private data.

## Backup and restore

Version 1 JSON includes accounts, entries, transfers, budgets, plans, goals and allocations. Export and restore share limits: 8,000,000 UTF-8 bytes and 25,000 total records. Exports are compact JSON and validate before download, so the app does not produce a backup that exceeds its own restore contract. Oversized ledgers require an independent D1 database export. The restore request envelope has an additional 1,024-byte allowance.

Restore validates ownership, IDs, amounts, dates, links, duplicate monthly keys and conflicts before writing. It merges missing records and never replaces changed records. Inserts use JSON chunks of at most 1,000 records in one atomic D1 batch, avoiding oversized individual SQL parameters. CSV and lazily loaded Excel reports support review; JSON is the app recovery format.

## Environments and release checks

Local development uses .wrangler/state; browser tests use separate .wrangler/e2e and .wrangler/pwa-e2e databases. The personal environment intentionally retains the original database named monthwise-staging. The unused production database is not the personal ledger. See PERSONAL-DEPLOYMENT.md before any cloud change.

GitHub Actions runs formatting, type checking, unit/integration tests, the production build, Edge browser tests and the offline PWA test using Node 22.21.0. It does not deploy or use cloud secrets. Run npm run check locally for the same checks.

Physical iPhone installation, standalone cookie behavior and real owner sign-in still require device/release verification. These checks are separate from the automated local tests.

## Public access safeguards

Migration 0005 adds durable read/export/restore counters, indexed session ownership and issuance timestamps, and per-owner ledger usage with database-enforced quotas. Public mode requires its Cloudflare edge limiter and verified ingress IP before handling API/auth requests. Detailed settings and their limits are documented in PUBLIC-LAUNCH.md.

All user sessions can be revoked through account deletion, which requires a sign-in within ten minutes. At most ten sessions are retained per user. Deletion removes only that user?s live database rows atomically; backups and other devices have independent retention. Static and Worker responses receive security headers including CSP and frame blocking.

The browser locks a prior owner?s cache before loading a different authenticated owner and never falls back to that prior snapshot after a failed load. Saving a new snapshot atomically replaces cached snapshots and selects the current owner. Pending entries remain owner-scoped.
