# Public readiness: evidence needed

Reviewed November 1, 2026. A rating is subjective; these are practical release criteria,
not a guarantee of a score or a security certification. Existing automated tests are
valuable evidence. Missing real-world evidence is not a demonstrated failure.

| Priority | Gap                              | Existing evidence                                                                                   | What closes the gap                                                                                                                                                                                                                                                                                |
| -------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Independent recovery             | Public SQL export/checksum script and synthetic SQL recovery drill                                  | Export a current public backup, store it encrypted outside this PC and Cloudflare, retrieve/decrypt it, and pass an isolated local recovery check. Record date and result privately. Establish a daily backup routine with an owner, retention policy and failure alert.                           |
| 1        | Alert delivery                   | Scheduled public health workflow and sanitized Worker diagnostics                                   | Confirm the workflow is active on main; prove a controlled test failure reaches the operator, then confirm recovery. Configure and test available Worker error and usage/billing notifications. Record recipient privately and define a response routine. Never break production to test an alert. |
| 1        | Real hosted identity isolation   | Backend ownership tests and synthetic Alice/Bob browser switching, including offline cache checks   | Complete the two-real-account checklist in ACCEPTANCE.md on the deployed version, including interrupted switching and cross-owner backup rejection. Use disposable data.                                                                                                                           |
| 1        | Physical iPhone offline behavior | Automated PWA reconnect and duplicate-prevention checks, plus prior operator report of installation | On an installed physical iPhone app, create one uniquely named offline entry, reconnect, and verify exactly one record and balance effect after two reloads and from another browser. Repeat with an interrupted save. Record iOS/browser/version and results.                                     |
| 2        | Google public audience           | Configured Google redirect and prior operator report of sign-in                                     | Inspect the actual Google audience/publishing settings and confirm the intended public audience can sign in. Record the observed setting; a mocked exchange or redirect alone does not prove it.                                                                                                   |
| 2        | Release traceability             | Deployed Worker version endpoint                                                                    | Associate the released source commit and clean/passing CI result with the active Worker version. The currently documented untagged Worker version does not establish its source commit.                                                                                                            |
| 2        | First-use clarity                | Automated accessibility scans and browser checks                                                    | Have 3–5 consenting testers complete the fictional-data tasks in ACCEPTANCE.md without coaching; fix repeated blockers. Include keyboard, zoom and screen-reader review.                                                                                                                           |
| 2        | Real-device capacity             | Synthetic 25,000-record server and browser benchmarks                                               | Measure a disposable full ledger on an older physical phone. Record startup/search responsiveness and storage behavior. Keep the current cap until evidence supports a change.                                                                                                                     |

## Concrete work in this pass

The local sign-in screen now says "Sign in to open your ledger." and shows connection
recovery instructions only for a load error. Previously an ordinary first visit was
presented with "Sign in again" and connection-error wording. This UI fix does not
establish Google sign-in or session behavior, and requires deployment to reach users.

## How to record acceptance

Operator update, November 1, 2026: two real Google accounts were used. The original
account retained its ledger and the new account began empty with account setup.
Record this as partial hosted identity evidence, not completion of every isolation
step. The operator has an iPhone but no independent encrypted backup location yet.
An alert destination has not been confirmed.

The operator subsequently reported that a EUR 1 expense created offline saved after
Wi-Fi returned. This is partial physical-device/offline-flow evidence; installed-app
mode and exactly-once checks across reloads and a second browser remain unconfirmed.

Fresh checks after the decimal-comma fix: TypeScript passed, all 59 unit/integration tests passed,
and the hosted health, anonymous-ledger protection and Google-redirect checks passed.
The hosted version is still `66d52362-7b19-4b42-a8df-de23bf1a7298`, with no release
tag. The targeted Edge account/entry/transfer workflow passed with a decimal-comma
amount; full browser suites were not rerun for this fix. The sign-in wording and
decimal-comma fixes remain local until deployed.

For each check, record date, tester alias, device/browser, source commit when known,
deployed Worker version, steps, expected result, observed result and pass/fail.
Do not commit real emails, SQL backups, tokens, screenshots of financial records,
or notification destinations. Leave unobserved checks open.

Use [ACCEPTANCE.md](ACCEPTANCE.md) for the account/device steps and
[OPERATIONS.md](OPERATIONS.md) for existing backup/recovery commands. Exporting
production data, selecting external storage, configuring notification recipients,
and real Google/device sessions remain operator-dependent work. No production
backup, alert delivery, deployment or real-device check was performed by this pass.

## Basis for reassessment

Closing priority 1 establishes evidence for the largest public-readiness concerns.
Closing priority 2 adds release confidence, usability and capacity evidence. A 9–9.5
assessment would also need a fresh review of the resulting deployment and evidence,
including any newly discovered issues; adding documentation alone does not earn it.
