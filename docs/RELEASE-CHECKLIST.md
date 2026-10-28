# Release checklist

## Local verification

Use Node 22.21 or newer and install the locked dependencies with npm ci. Run npm run check. Microsoft Edge must be installed for browser tests. Both browser suites apply all migrations to isolated local databases; they do not access the hosted ledger.

The GitHub Actions workflow runs the same checks on Windows and uploads browser traces when a check fails. Its first hosted run can only be verified after the repository is pushed.

The Excel library is loaded only when exporting. Its separate approximately 943 KB minified chunk causes Vite's size advisory; it is excluded from the initial bundle and shell precache. A smaller export implementation would need to preserve the workbook formatting and literal-cell protections verified by the export tests.

## Repository preparation

Use Git with main as the initial branch. Review git status and git diff --cached before the first commit. Dependencies, generated builds, browser results, local databases, environment files and common financial export names are ignored. Keep independently named financial backups outside the repository as well.

The local repository and workflow can be prepared before creating the GitHub repository. Do not publish the existing ledger data or cloud secrets. Google client IDs and D1 binding IDs in Wrangler configuration are identifiers, not client secrets.

## Deployment handoff

No deployment is part of these local fixes. Before a later deployment:

1. Export the existing personal D1 database to an independent backup under .wrangler/backups.
2. Apply all pending migrations to the personal environment, including 0004_ledger_versions.sql, before deploying code that reads the new version table.
3. Build and deploy using the personal environment. Preserve its existing monthwise-staging database binding.
4. Verify real owner login, sign-out, account totals, planning, JSON export and restore on disposable records.
5. Verify iPhone installation, standalone sign-in, offline reload, queued entry creation and reconnection exactly once.

The JSON recovery contract is 8 MB and 25,000 total records. Both exporting and importing enforce it. Use D1 database exports for ledgers exceeding that contract. Keep regular independent backups even while using provider recovery.
