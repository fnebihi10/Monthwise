import { expect, it } from 'vitest';
import { makeBackup, serializeBackup, validateBackup } from './backup';
import { MAX_BACKUP_BYTES, MAX_BACKUP_RECORDS } from './backupLimits';
import { emptySnapshot, type Snapshot } from './models';

function ledger(count: number): Snapshot {
  const accountId = crypto.randomUUID();
  return {
    ...emptySnapshot,
    user: { id: 'owner', email: 'owner@test', local: false },
    accounts: [
      { id: accountId, name: 'Bank', kind: 'bank', openingBalanceCents: 0, balanceCents: -count },
    ],
    entries: Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      accountId,
      kind: 'expense',
      amountCents: 1,
      date: '2026-10-28',
      merchant: 'Shop',
      category: 'Other',
      note: 'x'.repeat(250),
      revision: 1,
    })),
  };
}

it('exports a restorable ledger beyond the old 5,000-record and 2 MB limits', () => {
  const data = ledger(5100);
  const serialized = serializeBackup(data);
  expect(new TextEncoder().encode(serialized).length).toBeGreaterThan(2_000_000);
  expect(validateBackup(JSON.parse(serialized)).entries).toHaveLength(5100);
});

it('applies the same record limit during export and restore', () => {
  const data = ledger(1);
  data.entries = Array(MAX_BACKUP_RECORDS + 1).fill(data.entries[0]);
  // Keep the payload under the byte limit so the record limit is exercised.
  data.entries = data.entries.map((e) => ({ ...e, note: '' }));
  expect(() => makeBackup(data)).toThrow('25,000');
  expect(() =>
    validateBackup({
      ...data,
      format: 'monthwise',
      version: 1,
      ownerId: 'owner',
      createdAt: new Date().toISOString(),
    }),
  ).toThrow('25,000');
});

it('applies a UTF-8 byte limit before exporting or restoring oversized data', () => {
  const data = ledger(1);
  data.entries[0].note = '€'.repeat(MAX_BACKUP_BYTES / 3 + 1);
  expect(() => serializeBackup(data)).toThrow('8 MB');
  expect(() => validateBackup({ ...data })).toThrow('8 MB');
});
