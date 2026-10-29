import { expect, it } from 'vitest';
import { buildReports, reportForYear } from './reports';
import type { LedgerEntry } from './models';

it('keeps years separate and preserves exact cents, categories and empty months', () => {
  const entries = [
    { id: 'salary', kind: 'income', amountCents: 10001, date: '2026-10-01', category: 'Income' },
    { id: 'food', kind: 'expense', amountCents: 1299, date: '2026-10-02', category: 'Groceries' },
    { id: 'food2', kind: 'expense', amountCents: 201, date: '2026-10-03', category: 'Groceries' },
    { id: 'past', kind: 'expense', amountCents: 50000, date: '2025-10-01', category: 'Other' },
  ] as LedgerEntry[];
  const index = buildReports(entries);
  const year = reportForYear(index, 2026);
  expect(year).toMatchObject({ income: 10001, spent: 1500, retained: 8501 });
  expect(year.months[9]).toMatchObject({
    expenseCount: 2,
    categories: [{ name: 'Groceries', amount: 1500 }],
  });
  expect(year.months[0].entries).toEqual([]);
  expect(reportForYear(index, 2025).spent).toBe(50000);
  expect(entries.map((e) => e.id)).toEqual(['salary', 'food', 'food2', 'past']);
});
