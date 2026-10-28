# Product contract

Monthwise helps its owner answer: what came in, what went out, what is committed, and what stayed?

## Essential workflows

1. Record salary or another received income.
2. Record a purchase with date, amount, account, category, merchant and optional note.
3. Review any month of any year and inspect every transaction.
4. Compare all 12 months without deleting or resetting old records.
5. Plan bills and budgets separately from recorded transactions.
6. Use the deployed app from an iPhone Home Screen.

## Financial rules

- Initial currency: EUR. Store money as integer cents, never floating-point currency values.
- Dates are local calendar dates (YYYY-MM-DD); timestamps for audit/sync are UTC.
- Monthly views filter by transaction date, not insertion date.
- Monthly retained income = actual income - actual expenses. It can be negative.
- Account balance = opening balance + income - expenses + incoming transfers - outgoing transfers.
- Moving money between owned accounts is a transfer, not income or expense.
- Received income and expected income are different records.
- Planned bills become actual expenses only on explicit payment.
- A monthly surplus is not automatically goal funding or bank savings.
- History belongs to transactions across all years; months are views, not separate databases.
- Historical edits recompute summaries; templates must not retroactively rewrite past paid bills.
- Do not label a forecast as a verified bank balance.

## Privacy and release

This initial preview contains synthetic records and session-only changes. Real finance use waits for authenticated cloud persistence and tested recovery. Public portfolio demonstrations must use separate fictional data. Never put credentials or real financial records in Git.
