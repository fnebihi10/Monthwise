# Monthwise

Personal app: https://monthwise.fnebihi10.workers.dev

React 19, TypeScript, Vite, Cloudflare Workers and D1. Owner-only Google sign-in; the personal deployment retains the original ledger database.

New to the project? Read [How Monthwise works](docs/PROJECT-GUIDE.md) for a plain-language explanation of the stack, Google sign-in, database and deployment.

## Daily use

1. Open Accounts and create your cash/bank/savings accounts with opening balances. Opening balances are not income.
2. Add salary and expenses with their actual dates. Select any month or year to review history; History searches across months.
3. Plan contains category budgets, expected income, bills and savings goals. Marking a bill paid creates its actual expense once. Transfers and goal allocations do not count as expenses.
4. Use previous month's plan copies budgets and repeating planned items only. It does not copy purchases or paid status.
5. In Backup & app, download a JSON backup regularly; CSV is for reviewing transactions. Restore merges missing records for the same owner and rejects conflicting existing records. It does not replace your ledger.

On iPhone, open the link in Safari, sign in, then Share > Add to Home Screen. Open it online once so the app and ledger are cached. Offline entry creation is supported; pending entries sync on reconnection. Edits, transfers, planning changes and restores need internet. Check that no entries are waiting to sync before signing out or clearing browser data. Browser storage can be removed by the device; it is not a backup.

Unassigned money means all current account balances minus the selected month's unpaid bills and all goal allocations. Expected income and budget limits are not subtracted. This is a planning figure, not a historical account balance.

## Development

Requires Node.js 22.21+.

```sh
npm install
npm run dev
npm run build
npm test
npm run test:e2e
npx playwright test --config playwright.pwa.config.ts
npm run format:check
npm run check
```

Local development uses a shared development identity and a separate local D1 database; use sample data on a trusted network. Browser checks use installed Microsoft Edge and isolated databases under .wrangler/e2e and .wrangler/pwa-e2e. Build before running the PWA check.

GitHub Actions runs these checks on each push and pull request without deploying or accessing cloud secrets. See [Architecture](docs/ARCHITECTURE.md) for data loading and recovery behavior, and [Release checklist](docs/RELEASE-CHECKLIST.md) for the repository and deployment handoff.

JSON backups support up to 8 MB and 25,000 records per collection. Export and restore enforce the same limits; use a D1 database export for larger ledgers. Temporary sync failures remain queued and can be retried without creating duplicate entries.

## Personal deployment

```sh
npx wrangler d1 export DB --env personal --remote --output .wrangler/backups/before-update.sql
npx wrangler d1 migrations apply DB --env personal --remote
npm run deploy:personal
```

Apply pending migrations, including `0004_ledger_versions.sql`, before deploying the updated Worker.

The personal environment deliberately uses the original database named monthwise-staging. Do not switch it to the unused monthwise-production database. Secrets remain in Cloudflare; never commit OAuth credentials or backups.

Version 1 includes month/year ledger, accounts/transfers, planning, goals, full history, JSON/CSV export, conservative restore, and an installable offline shell. Automated checks cover accounting, ownership, authentication, restore, duplicate prevention and offline reconnection. Physical iPhone installation and real owner sign-in should be checked on the device after release.
