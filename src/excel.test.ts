import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { excelWorkbook } from './excel';
import { emptySnapshot } from './models';
it('round-trips readable Excel sheets with accurate totals and literal user text', async () => {
  const data = {
    ...emptySnapshot,
    accounts: [
      {
        id: 'a',
        name: 'My Bank',
        kind: 'bank' as const,
        openingBalanceCents: 0,
        balanceCents: 23000,
      },
    ],
    entries: [
      {
        id: 'e1',
        accountId: 'a',
        revision: 1,
        date: '2026-10-24',
        kind: 'income' as const,
        amountCents: 33500,
        merchant: '=1+1',
        category: 'Income',
        note: 'Notes, with commas',
      },
      {
        id: 'e2',
        accountId: 'a',
        revision: 1,
        date: '2026-10-23',
        kind: 'expense' as const,
        amountCents: 10500,
        merchant: 'Food',
        category: 'Groceries',
        note: '',
      },
    ],
  };
  const book = await excelWorkbook(data);
  const bytes = await book.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  expect(restored.worksheets.map((s) => s.name)).toEqual([
    'Monthly summary',
    'Transactions',
    'Accounts',
  ]);
  const rows = restored.getWorksheet('Transactions')!;
  expect(rows.getColumn(1).width).toBeGreaterThanOrEqual(16);
  expect(rows.getCell('A2').value).toEqual(new Date('2026-10-24T00:00:00Z'));
  expect(rows.getCell('D2').value).toBe('=1+1');
  expect(rows.getCell('D2').type).toBe(ExcelJS.ValueType.String);
  expect(rows.getCell('F2').value).toBe(335);
  expect(rows.getCell('F2').numFmt).toContain('\u20ac');
  expect(rows.autoFilter).toBe('A1:G3');
  const summary = restored.getWorksheet('Monthly summary')!;
  expect(summary.getCell('B2').value).toBe(335);
  expect(summary.getCell('C2').value).toBe(105);
  expect(summary.getCell('D2').value).toBe(230);
  expect(restored.getWorksheet('Accounts')!.getCell('D2').value).toBe(230);
});
it('exports a valid workbook when the ledger is empty', async () => {
  const book = await excelWorkbook(emptySnapshot);
  expect(book.getWorksheet('Monthly summary')!.getCell('B2').value).toBe(0);
  expect((await book.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0);
});
