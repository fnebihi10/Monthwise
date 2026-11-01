import { describe, expect, it } from 'vitest';
import { entriesForMonth, parseCents, summarize, type Entry } from './finance';
import { signedCents } from './formUtils';
const entry = (date: string, kind: Entry['kind'], amountCents: number): Entry => ({
  id: date + kind,
  date,
  kind,
  amountCents,
  merchant: 'Test',
  category: 'Test',
  note: '',
});
describe('ledger calculations', () => {
  it('keeps historical months and years separate', () => {
    const records = [
      entry('2026-10-31', 'expense', 100),
      entry('2026-11-01', 'expense', 200),
      entry('2025-10-01', 'expense', 300),
    ];
    expect(entriesForMonth(records, 2026, 9)).toEqual([records[0]]);
  });
  it('calculates retained income using integer cents, including overspending', () => {
    expect(
      summarize([entry('2026-10-01', 'income', 10000), entry('2026-10-02', 'expense', 12501)]),
    ).toEqual({ income: 10000, spent: 12501, retained: -2501 });
  });
  it('parses decimal money exactly and rejects invalid amounts', () => {
    expect(parseCents('12.50')).toBe(1250);
    expect(parseCents('0.01')).toBe(1);
    expect(parseCents('0,01')).toBe(1);
    expect(parseCents('12,50')).toBe(1250);
    expect(parseCents('1000000,00')).toBe(100000000);
    for (const value of ['1,001', '1.000,50', '1,000.50', '1,,2', ',01', '1000000,01'])
      expect(parseCents(value)).toBeNull();
    for (const value of ['0', '-1', '1.001', 'NaN', '1e3', '', '1000001', '9007199254740991'])
      expect(parseCents(value)).toBeNull();
  });
  it('accepts decimal commas in signed opening balances without accepting grouping separators', () => {
    expect(signedCents('-12,50')).toBe(-1250);
    expect(signedCents('0,00')).toBe(0);
    expect(signedCents('-0,01')).toBe(-1);
    expect(signedCents('12.50')).toBe(1250);
    for (const value of ['1.000,50', '1,000.50', '-1,001', '1,,2', ''])
      expect(signedCents(value)).toBeNull();
  });
});
