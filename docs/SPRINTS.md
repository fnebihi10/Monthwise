# Monthwise — five-sprint delivery plan

Each sprint ends with a working demonstration and an updated status. Sprints are milestones, not fixed calendar promises.

## Sprint 1 — Foundation and visual identity

Goal: make the monthly experience concrete before adding personal data.

- React/TypeScript setup and responsive design system.
- Distinctive ledger layout, 12-month navigation, year navigation and year overview.
- Fictional transaction dataset, search, type filters and spending breakdown.
- Session-only entry form and exact integer-cent calculations.
- Document accounting rules, architecture and remaining scope.
  Acceptance: October can be reopened after December; years remain separate; empty months work; narrow-screen layout is usable; calculation tests and production build pass.
  Status: complete as a local demo. Production build and 3 finance tests passed. Edge desktop and 390px mobile browser checks passed for month/year navigation, empty states, search, decimal entry, session reset, dialog behavior and horizontal overflow. Desktop/mobile screenshots reviewed. Physical iPhone verification remains for Sprint 4.

## Sprint 2 — Private accounts and durable ledger

Goal: replace demo state with a private, persistent ledger.

- Cloudflare Worker API and D1 migrations; separate development and production databases.
- Choose and implement an established authentication integration; no homemade password storage.
- Ownership checks on every request; authenticated session protection, validation and rate limits.
- Accounts for cash, bank and savings; explicit opening balances.
- Create, edit and delete income/expenses with confirmation and accessible feedback.
- Account transfers committed atomically and excluded from income/expenses.
  Acceptance: data survives reload and another-device sign-in; a second user cannot access the first user's records; transfers preserve combined balances; API integration tests pass.
  Deliverable: private online ledger with real data entry.
  Status: local implementation complete, with Worker/D1 integration, owner-scoped CRUD, atomic transfers, owner-only Google OAuth and revocable sessions and automated checks. Staging is deployed, databases are provisioned, and real owner Google sign-in was confirmed by the user on desktop on 2026-10-23. Physical iPhone/cross-device sign-in and production release remain pending. See SPRINT-2-VERIFICATION.md and CLOUDFLARE.md.

## Sprint 3 — Monthly planning and meaningful history

Goal: show what happened and what is still committed.

- Category budgets per month, with explicit copying to a new month.
- Expected income, recurring bill templates and monthly bill occurrences.
- Paid/unpaid states; paying a bill links one actual expense and cannot double count.
- Savings goals and explicit allocations; transfers remain separate.
- Explain available-to-spend calculation and avoid subtracting overlapping reservations twice.
- Search across all dates; monthly comparisons and yearly totals.
  Acceptance: editing a recurring template does not rewrite paid history; planned income is excluded from actual income; budget changes affect only intended months; unpaid bills never appear as paid expenses.
  Deliverable: useful monthly planning alongside complete historical detail.

## Sprint 4 — iPhone PWA, offline entry and recovery

Goal: safely use Monthwise daily on a phone.

- Manifest, original icons, standalone launch and service-worker app-shell caching.
- IndexedDB cache scoped to the signed-in user; pending offline operation queue.
- Stable operation IDs, idempotent sync, retry and explicit sync status.
- Handle expired sessions and conflicting edits without silent overwrites.
- Clear private cache and pending-operation handling on sign-out/account switch.
- Versioned full-fidelity JSON backup/restore, CSV export, validation and restore preview.
  Acceptance: airplane-mode entry syncs exactly once after reconnection; expired authentication does not lose queued entries; account switching leaks no private data; backup round trip preserves IDs, cents, dates, relationships and totals.
  Deliverable: installable iPhone experience plus recoverable records.
  Important: manual iPhone checks required; browser storage is never the sole backup.

## Sprint 5 — Production release and portfolio

Goal: launch a dependable personal tool with an honest public demonstration.

- Production Cloudflare configuration, migrations, secrets and deployment documentation.
- Security, accessibility and performance checks; meaningful browser end-to-end tests.
- Automated database backups with a documented and tested restoration procedure.
- Review offline updates, failure states, empty states and money calculation edge cases.
- Optional Albanian interface with explicit language choice if approved.
- Separate fictional public demo from private personal finances.
- README, architecture diagram, screenshots, short walkthrough and measured technical case study.
  Acceptance: personal data requires sign-in; backup restoration passes; January–December historical navigation works across years; iPhone installation and offline flows are verified; production URL and rollback instructions are documented.
  Deliverable: production PWA and internship-ready project evidence.

## Scope boundaries

Manual entry first. Bank connections, payments, investment advice, receipt OCR and AI categorization are outside these five sprints. Receipt attachments can be reconsidered after the core release.
