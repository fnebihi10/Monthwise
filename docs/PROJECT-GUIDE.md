# How Monthwise works

Monthwise is your private budgeting app. The live app, source code and financial database are three separate things.

| Part                | Technology                    | Purpose                                                                 |
| ------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| App interface       | React 19, TypeScript, CSS     | The screens and forms you use                                           |
| Build tooling       | Vite                          | Turns the source into files a browser can run                           |
| Hosting and backend | Cloudflare Workers            | Serves the app, checks sign-in and handles requests                     |
| Financial database  | Cloudflare D1, using SQL      | Stores accounts, transactions, transfers, budgets, bills and goals      |
| Sign-in             | Google OAuth / OpenID Connect | Confirms who you are; the backend permits only the configured owner     |
| Offline support     | Service worker and IndexedDB  | Keeps a local copy and queues new entries until you reconnect           |
| Tests               | Vitest and Playwright         | Checks calculations, API behavior, sign-in protection and browser flows |
| Source history      | Git and GitHub                | Keeps versions of the code and runs automated checks                    |

## What happens when you use it

1. Your browser opens the app hosted on Cloudflare.
2. Google confirms your identity. Monthwise checks that the verified email matches its owner setting.
3. Monthwise creates its own session and sends a protected cookie to your browser.
4. When you add an expense, the browser sends it to the Worker backend. The backend checks it and saves it in D1.
5. The interface loads your updated records and calculates the displayed summaries. Opening balances and transfers are kept separate from income and spending.

Google handles identity; it does not store your financial records. Offline copies live in your browser and are not an independent backup.

## Your current setup

The project configuration and deployment notes identify the personal app as https://monthwise.fnebihi10.workers.dev. Its Cloudflare Worker is named `monthwise`.

Its configured database is named `monthwise-staging`. That is a historical name: the personal environment intentionally uses this database for your existing ledger. The separate database named `monthwise-production` is not configured as the personal ledger. Do not switch between them just because of their names.

The owner email in the configuration controls who may sign in. The Google client secret is managed separately in Cloudflare. Source files describe the intended configuration; checking the live Cloudflare account is a separate step. You reported that owner Google sign-in currently works.

## Code changes versus deployment

Pushing to GitHub saves the code. The included GitHub Actions workflow runs tests; it does not deploy to Cloudflare.

The latest local fixes therefore need a separate release to reach the live app. That release must back up the existing database, apply pending migrations, then deploy the updated Worker and interface. Migration `0004_ledger_versions.sql` adds change tracking and indexes without intentionally replacing ledger records.

Database migrations describe the database structure. They do not contain your actual financial records. Private database copies, local secrets and common financial export filenames are excluded from Git.

See [Release checklist](RELEASE-CHECKLIST.md) for the later deployment steps and [Architecture](ARCHITECTURE.md) for implementation details.
