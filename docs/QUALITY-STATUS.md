# Quality evidence and remaining release work

## Local evidence

`npm run check` covers TypeScript, formatting, unit/integration tests, capacity testing, synthetic SQL recovery, Edge, Chromium and iPhone-emulated WebKit, WCAG A/AA scans, and offline PWA reconnection. GitHub runs these categories on Windows and Linux.

The completed local gate passed 56 unit/integration tests, one capacity test, the SQL recovery script, and 27 browser/PWA tests (including accessibility scans across all three engines). A Wrangler deployment dry run also accepted the diagnostics configuration. Hosted CI results remain a separate verification step.

The capacity check restores 25,000 synthetic ledger records, loads every page without duplicate IDs or mixed revisions, builds monthly/yearly summaries, validates a backup and performs twenty concurrent version reads. Metrics are saved in `.wrangler/performance/latest.json` and uploaded as synthetic-only CI artifacts. These are local regression measurements, not production SLAs or thousands-of-users load tests.

The first run measured about 849 ms for restore, 2,344 ms for 49 pages, 194 ms for reports plus validation, and 432 ms for twenty concurrent version reads. Machine/runtime conditions affect results.

Accessibility scans found and fixed muted-text/month-number contrast and a brand-link accessible-name mismatch. They cover six main views and the entry dialog. Manual screen-reader, zoom, keyboard and touch-target evaluation remain useful; zero automated violations is not certification.

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
- Review/merge the public pull request so main reflects the released product.
- Collect real usage/performance evidence and conduct broader security/accessibility review before stronger claims.

A score is subjective. The evidence supports a stronger tested beta, not a promise of perfection or a 9.5–10 rating.
