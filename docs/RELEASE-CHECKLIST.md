# Release checklist

## Local verification

Use Node 22.21 or newer and install the locked dependencies with npm ci. Run npm run check. Microsoft Edge must be installed for browser tests. Both browser suites apply all migrations to isolated local databases; they do not access the hosted ledger.

The GitHub Actions workflow runs checks on Windows and cross-browser checks on Linux, uploading browser traces on failure. Inspect the current commit's Actions results separately from local results.

The Excel library is loaded only when exporting. Its separate approximately 943 KB minified chunk causes Vite's size advisory; it is excluded from the initial bundle and shell precache. A smaller export implementation would need to preserve the workbook formatting and literal-cell protections verified by the export tests.

## Repository preparation

Main contains the merged public implementation. Review git status and the diff before each commit. Dependencies, generated builds, browser results, local databases, environment files and common financial export names are ignored. Keep independently named financial backups outside the repository as well.

Do not publish ledger data or cloud secrets. Google client IDs and D1 binding IDs in Wrangler configuration are identifiers, not client secrets.

## Deployment handoff

No deployment is part of these local fixes. Before a later deployment:

1. Record the source commit, local checks and hosted CI result.
2. With authorization to copy private data, back up the public database and verify local recovery. Keep an encrypted independent copy. Never substitute the personal database binding.
3. Inspect pending public migrations before applying any. This maintenance change adds no migration.
4. Build and deploy using `npm run deploy:public`. Record the active Worker version with `npm run deployment:status` and `/api/version`.
5. Run `npm run check:hosted` and complete [ACCEPTANCE.md](ACCEPTANCE.md) with real accounts and a physical iPhone.

The JSON recovery contract is 8 MB and 25,000 total records. Both exporting and importing enforce it. Use D1 database exports for ledgers exceeding that contract. Keep regular independent backups even while using provider recovery.
