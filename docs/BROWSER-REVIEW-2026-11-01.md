# Browser review — November 1, 2026

## Live site

Opened https://monthwise.online in clean Microsoft Edge browser contexts at 1440×1000 and 390×844. Both returned HTTP 200, displayed the sign-in heading and Google link, had no horizontal page overflow, and emitted no uncaught page JavaScript errors during initial loading. Clicking the Google link reached accounts.google.com on both sizes. Anonymous ledger requests returned HTTP 401.

No real Google credentials were entered. No hosted financial records were read or written. Screenshots of the public login screen are saved locally in ignored `.wrangler/browser-review/hosted-desktop.png` and `hosted-mobile.png`.

One minor usability issue was observed: a first-time visitor sees “Sign in again to sync your ledger. Pending entries remain on this device.” and “Check your connection and try again.” even with a working connection and a fresh browser context. This is confusing recovery wording on the normal signed-out screen, not an observed sign-in failure.

## Synthetic validation

All 30 browser checks passed: nine Edge workflow/accessibility tests, one Edge offline/PWA test, eighteen Chromium/iPhone-emulated WebKit workflow/accessibility tests, and two Chromium/iPhone-emulated WebKit offline/PWA tests. These counts include the same scenarios repeated across engines; they are not thirty distinct workflows.

The production build passed. Browser suites run against local Workers/D1 using synthetic accounts and entries in `.wrangler/e2e` and `.wrangler/pwa-e2e`, separate from hosted databases. Their identity is the development identity, not real Google sign-in.

Coverage includes account creation, opening-balance edits, expense entry/editing, transfers, reload persistence, mobile layout, interrupted-save duplicate prevention, Excel workbook download, retryable sync, unchanged-ledger polling, cached-data isolation during account switching, automated accessibility scans, offline shell reload, and offline entry reconnection exactly once.

Six additional public-mode integration tests passed using synthetic Alice and Bob identities, a mocked Google exchange and isolated local D1. They verify sessions, cross-user access restrictions across ledger features/backups, rate limits, quotas and authenticated deletion. These are integration tests, not Google-account browser sign-ins.

## Interpretation

Passing tests establish the exercised workflows in this local working tree. They do not prove that the deployed version contains the same code. iPhone browser emulation does not establish physical Home Screen installation or real-device storage behavior. The operator's earlier two-real-account test remains separate evidence.
