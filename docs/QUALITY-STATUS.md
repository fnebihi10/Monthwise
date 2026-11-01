# Quality evidence and remaining release work

## Independent verification — November 1, 2026

The local `npm run check` gate passed formatting, TypeScript, 58 unit/integration tests, the 25,000-record capacity test, synthetic SQL export/import recovery, production build, nine Edge UI tests, one Edge PWA test, twenty Chromium/iPhone-emulated WebKit UI tests and two cross-browser PWA tests. The cross-browser UI run included the newly added full-ledger browser benchmark. A separate Edge run passed that benchmark and the new successful identity-switching test; the latter also passed separately in Chromium and iPhone-emulated WebKit. These runs total 36 browser test executions. `npm audit --audit-level=moderate` reported zero known vulnerabilities.

`e2e/capacity.spec.ts` serves 24,999 synthetic entries and one account through 50 mocked API pages at 390×844. It verifies all entries load, History initially renders only 30 rows, the final entry is searchable, and the page has no horizontal overflow. Chromium/Edge use 4× CPU slowdown; WebKit runs without CPU slowdown. Startup plus opening History stayed below 30 seconds and search below 5 seconds. This complements the real local D1 capacity test; mocked networking and host-relative CPU throttling do not reproduce older-phone hardware or production latency. Backend measurements for this run were 894 ms restore, 1,956 ms pagination, 73 ms reports/validation and 226 ms for twenty concurrent version reads.

`e2e/identity.spec.ts` switches Alice → Bob → Alice in one browser with synthetic authenticated API responses. Each switch verifies that IndexedDB contains only the current owner's snapshot and that simulated API disconnection/reload displays only that owner's account. Existing tests separately exercise failed switching, backend ownership, backup rejection and exactly-once sync. These are automated isolation checks, not two real Google sign-ins.

Hosted health, anonymous ledger denial and Google redirect passed. Live version metadata matches Cloudflare's deployment history; see PUBLIC-DEPLOYMENT.md. This supersedes earlier statements that the version endpoint still needs deployment. No code was deployed or production ledger data copied during this verification. The operator reports having no independent encrypted backup destination or alert destination, so storage provisioning and notification delivery remain open. No physical-device or first-time-user sessions were performed.

## Maintenance verification — October 31, 2026

This working-tree maintenance pass passed 57 unit/integration tests, TypeScript and production build, the synthetic SQL export/import recovery drill, the 25,000-record capacity test, and a public Worker deployment dry run including the version metadata binding. Earlier in the same review, all nine Edge browser tests passed before the maintenance changes. Cross-browser and physical-device checks were not rerun for this pass.

Public endpoint checks passed health, anonymous ledger protection and the Google redirect. The active hosted version is recorded in PUBLIC-DEPLOYMENT.md. This pass did not deploy code, export production records, provision independent backup storage, configure notification recipients, or conduct real-account/device/user acceptance. The user chose synthetic recovery only. The health workflow and version endpoint need pushing/deployment before they become active. See ACCEPTANCE.md for the remaining checks.

## Local evidence

`npm run check` covers TypeScript, formatting, unit/integration tests, capacity testing, synthetic SQL recovery, Edge, Chromium and iPhone-emulated WebKit, WCAG A/AA scans, and offline PWA reconnection. GitHub runs these categories on Windows and Linux.

The completed local gate passed 56 unit/integration tests, one capacity test, the SQL recovery script, and 27 browser/PWA tests (including accessibility scans across all three engines). A Wrangler deployment dry run also accepted the diagnostics configuration. Hosted CI results remain a separate verification step.

The capacity check restores 25,000 synthetic ledger records, loads every page without duplicate IDs or mixed revisions, builds monthly/yearly summaries, validates a backup and performs twenty concurrent version reads. Metrics are saved in `.wrangler/performance/latest.json` and uploaded as synthetic-only CI artifacts. These are local regression measurements, not production SLAs or thousands-of-users load tests.

The first run measured about 849 ms for restore, 2,344 ms for 49 pages, 194 ms for reports plus validation, and 432 ms for twenty concurrent version reads. Machine/runtime conditions affect results.

Accessibility scans found and fixed muted-text/month-number contrast and a brand-link accessible-name mismatch. They cover six main views and the entry dialog. Manual screen-reader, zoom, keyboard and touch-target evaluation remain useful; zero automated violations is not certification.

The first expanded hosted CI run also caught a missing chart role on an empty ledger. The chart now exposes an image role with either a full category/amount description or an explicit empty-state name. A dedicated empty-ledger fixture covers this case independently of persistent local test data.

The frontend separates monthly/yearly views, entry forms and account management. A memoized one-pass index replaces repeated full-ledger scans for reports and Excel summaries. Unchanged snapshots preserve entry-array identity. Full history still resides in browser memory within the 25,000-record cap.

The dependency audit reports zero known advisories after updating Wrangler and patching transitive HTTP/UUID dependencies. Audit results are time-specific and checked again in CI.

## Hosted and operator evidence

The operator confirmed Google sign-in on monthwise.online, JSON migration with matching records/totals, and installation/use of the new domain on physical iPhone. These are operator reports, not independent reproduction by the coding agent.

The last observed Google publishing status was Testing. Production publishing, a second real account's independent hosted ledger, and the complete physical-iPhone offline-create/reconnect-exactly-once flow have not been confirmed. Automated browsers test the offline flow locally.

The quality-pass changes require a separate public deployment. The prior public deployment remains usable. No live records or production schema were modified by this pass.

## Remaining public-readiness work

- Confirm Google's production audience/publishing and any remaining brand/domain requirements.
- Complete two-real-account and physical-iPhone offline/reconnection acceptance checks.
- Deploy and verify diagnostics/health, then configure alerts and independent encrypted backups.
- Public pull request #1 is merged into main (`1accfe8`). Deployment is separate from merging.
- Collect real usage/performance evidence and conduct broader security/accessibility review before stronger claims.

A score is subjective. The evidence supports a stronger tested beta, not a promise of perfection or a 9.5–10 rating.
