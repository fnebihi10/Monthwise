# How Monthwise works

The interface is built with React, TypeScript and Vite. A Cloudflare Worker serves it and handles requests to a D1 database. The browser, running Worker and database are separate.

1. Google confirms your identity. The Worker issues its own session cookie and uses the Google account's verified subject to identify your ledger. The separate personal deployment also checks its configured owner email.
2. When you enter an expense, the Worker validates it and saves it to D1. The app calculates monthly and yearly summaries from the ledger. Opening balances and transfers stay separate from income and spending.
3. After an online visit, the installed app can open cached records. IndexedDB stores new offline entries on that device until they sync. An offline copy depends on browser storage. Download a separate JSON backup to keep a recovery copy.

## Environments

- **Public:** [monthwise.online](https://monthwise.online/) is the live app. It runs on Worker `monthwise-public` and uses the D1 database `monthwise-production`.
- **Personal:** Worker `monthwise` is owner-only and uses the database with the historical name `monthwise-staging`. Keep its binding separate from the public database.
- **Local:** `npm run dev` starts the frontend and a local Worker with a development identity and a local D1 database.

Pushing code to GitHub runs checks. Deploying to Cloudflare updates the hosted app in a separate step tracked in [Deployment status](PUBLIC-DEPLOYMENT.md). See [Architecture](ARCHITECTURE.md) for the implementation and the [release checklist](RELEASE-CHECKLIST.md) for the procedure.
