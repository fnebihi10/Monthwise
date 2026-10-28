# Sprint 2 verification

## Implemented and checked locally

- React frontend and Cloudflare Worker compile together.
- Durable local D1 records and separate test database.
- Accounts, opening balances, transaction create/edit/delete and transfers.
- Server-side owner scope and composite foreign keys.
- Google owner-only token verification and revocable hashed sessions; explicit local-only identity.
- Request validation, same-origin mutation checks, rate limits and stale-edit checks.
- Session recovery/error screens and unchanged visual direction.

## Automated coverage

- Existing 3 pure finance tests plus an insecure-context UUID fallback test.
- Google tests: signed token, verified owner email, expiry, audience, issuer, nonce, authorized party and forged tokens.
- OAuth flow tests: PKCE, browser-bound state, callback replay, unauthorized accounts, session hashing/expiry, owner changes, CSRF-safe logout and real OAuth-library exchange with simulated Google.
- Real local D1 integration: anonymous access, cross-origin writes, owner isolation, CRUD persistence, stale revisions, derived balances, duplicate transfers, transfer rollback/removal, invalid dates/cents and write limits.
- Edge browser workflow: create accounts, create/edit/delete an expense, reload persistence, transfer balance changes, second reload, 390px horizontal overflow.
- A second browser test interrupts a successful save and verifies that a retry cannot duplicate the expense. Both workflows run with randomUUID disabled to exercise local iPhone compatibility.
- Browser fixture data lives in .wrangler/e2e and is not mixed with the local development ledger.

## Required external verification — pending

- Databases provisioned; staging schema verified. Production schema and hosted deployment remain pending.
- Real Google login, sign-out, expiry, and denial of a non-owner account.
- Cloud persistence across devices using the authenticated deployment.
- Physical iPhone testing of Sprint 2.
- Production backup/restore (scheduled in later sprints).

Results: production build and Worker type checks passed; all 20 unit/integration tests and both Edge browser workflows passed; formatting passed; npm reports zero known dependency vulnerabilities.

Sprint 2's local implementation is complete. Its hosted acceptance criteria remain pending account configuration and deployment. Do not describe the app as production-ready or cloud-synced yet.
