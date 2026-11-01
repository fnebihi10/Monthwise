# Hosted acceptance and usability

Use fictional disposable records. Record date, Worker version, device/browser, observed result and tester for each check. Leave unchecked until actually observed; automated local tests do not establish hosted results.

## Two real Google accounts

- [ ] Account A signs in and creates a uniquely named test account and entry.
- [ ] Sign out, then sign in as B in the same browser. A's accounts, entries, planning and totals never appear, including during loading and after reload.
- [ ] B creates its own disposable entry; sign back in as A and confirm B's data is absent.
- [ ] Export JSON for A and attempt to select it for restore as B: reject as another owner's backup. Keep the file private and remove it after testing.
- [ ] Repeat switching with an interrupted connection; neither identity sees the other's cached ledger.
- [ ] Confirm Google's intended production audience in Google Auth Platform. A second successful sign-in alone does not establish publishing status.

## Physical iPhone

- [ ] In Safari sign in, install with Share → Add to Home Screen, open online and create a disposable account.
- [ ] Enable airplane mode, disable Wi-Fi, reopen the installed app and confirm cached history is usable.
- [ ] Create one expense with a unique name and amount. Confirm pending status and the expected local balance.
- [ ] Restore connectivity, wait for sync, and confirm pending count becomes zero.
- [ ] Reload twice and check in another online browser: exactly one entry exists, with one balance effect. Record any error reference, without sharing financial data.
- [ ] Repeat with connectivity interrupted during saving. Verify exactly one entry after reconnection.

## Recovery and operations

- [ ] Keep a recent encrypted SQL backup outside this computer and the hosting account; record the storage location privately.
- [ ] With explicit authorization to copy production data locally, run recovery:check on that backup. Record the private report location and date; do not attach the SQL or record counts to public issues.
- [ ] Enable GitHub Actions notifications for failed Public site health runs and manually run the workflow after pushing it to main. Scheduled runs can be delayed and are not an uptime SLA.
- [ ] Configure Cloudflare Worker error and billing/usage notifications in the account with the desired recipient. The health workflow detects public endpoint failures, not every authenticated API error.

Synthetic recovery validates the procedure only. It does not establish that an independent production backup exists or is restorable.

## First-time users

Invite 3–5 consenting testers yourself. Let each use fictional data and attempt these tasks without coaching: create an account with an opening balance; record income and an expense; explain the remaining balance; plan and pay a bill; export a backup.

Record one row per task using this template:

| Tester alias | Task | Completed unaided? | Time | Hesitation or error | Suggested change |
| ------------ | ---- | ------------------ | ---- | ------------------- | ---------------- |
|              |      |                    |      |                     |                  |

Ask: What do you think “unassigned” means? What would make you return next week? Which task felt difficult? Avoid collecting real balances, emails or exported ledgers. Prioritize repeated blockers before adding features.

## Capacity decision

The current limit is 25,000 records per owner, loaded into browser memory. Keep that explicit limit for this release. Before raising it, measure startup time, memory and history filtering on a physical older phone with a synthetic full ledger. Server-side history filtering/pagination and summary endpoints are a later architectural change, with offline and export behavior to preserve.
