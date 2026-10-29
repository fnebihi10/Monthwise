import {
  expenseCategories,
  type Snapshot,
  type Account,
  type LedgerEntry,
  type Transfer,
} from './models';
import type { Budget, Plan, Goal, Allocation } from './planning';
import { assertBackupSize, MAX_BACKUP_RECORDS, MAX_LEDGER_RECORDS } from './backupLimits';
export type Backup = {
  format: 'monthwise';
  version: 1;
  createdAt: string;
  ownerId: string;
  accounts: Account[];
  entries: LedgerEntry[];
  transfers: Transfer[];
  budgets: Budget[];
  plans: Plan[];
  goals: Goal[];
  allocations: Allocation[];
};
export function makeBackup(data: Snapshot): Backup {
  const backup: Backup = {
    format: 'monthwise',
    version: 1,
    createdAt: new Date().toISOString(),
    ownerId: data.user.id,
    accounts: data.accounts,
    entries: data.entries,
    transfers: data.transfers,
    budgets: data.budgets,
    plans: data.plans,
    goals: data.goals,
    allocations: data.allocations,
  };
  validateBackup(backup);
  return backup;
}
export function serializeBackup(data: Snapshot) {
  return JSON.stringify(makeBackup(data));
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid backup record.');
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 250) {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid text in backup.');
  return value;
}
function id(value: unknown) {
  const text = str(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text))
    throw Error('Invalid record ID.');
  return text;
}
function cents(value: unknown, signed = false) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    Math.abs(value) > 100000000 ||
    (!signed && value <= 0)
  )
    throw Error('Invalid money amount.');
  return value;
}
function date(value: unknown) {
  const d = str(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    d < '1900-01-01' ||
    d > '9999-12-31' ||
    !Number.isFinite(Date.parse(d + 'T12:00:00Z')) ||
    new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) !== d
  )
    throw Error('Invalid date.');
  return d;
}
function category(value: unknown) {
  const c = str(value, 40);
  if (!expenseCategories.includes(c)) throw Error('Unknown category.');
  return c;
}
export function validateBackup(value: unknown): Backup {
  assertBackupSize(value);
  const b = object(value);
  if (b.format !== 'monthwise' || b.version !== 1)
    throw Error('Choose a Monthwise version 1 JSON backup.');
  const ownerId = str(b.ownerId, 250);
  if (!ownerId) throw Error('Missing backup owner.');
  const createdAt = str(b.createdAt, 40);
  if (!Number.isFinite(Date.parse(createdAt))) throw Error('Invalid backup date.');
  function rows<T>(name: string, map: (r: Record<string, unknown>) => T): T[] {
    const values = b[name];
    if (!Array.isArray(values) || values.length > MAX_BACKUP_RECORDS)
      throw Error(
        'Invalid ' + name + ' collection. Backups support up to 25,000 records per collection.',
      );
    const mapped = values.map((v) => map(object(v)));
    const ids = mapped.map((v) => (v as { id: string }).id);
    if (new Set(ids).size !== ids.length) throw Error('Duplicate IDs in ' + name + '.');
    return mapped;
  }
  const accounts = rows<Account>('accounts', (r) => {
    const kind = str(r.kind, 10);
    if (!['cash', 'bank', 'savings'].includes(kind)) throw Error('Invalid account type.');
    const name = str(r.name, 60);
    if (!name.trim()) throw Error('Missing account name.');
    return {
      id: id(r.id),
      name,
      kind: kind as Account['kind'],
      openingBalanceCents: cents(r.openingBalanceCents, true),
      balanceCents: 0,
    };
  });
  const entries = rows<LedgerEntry>('entries', (r) => {
    if (r.kind !== 'income' && r.kind !== 'expense') throw Error('Invalid transaction type.');
    const revision = r.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
      throw Error('Invalid revision.');
    const merchant = str(r.merchant, 100);
    if (!merchant.trim()) throw Error('Missing transaction name.');
    return {
      id: id(r.id),
      accountId: id(r.accountId),
      kind: r.kind,
      amountCents: cents(r.amountCents),
      date: date(r.date),
      merchant,
      category: r.kind === 'income' ? 'Income' : category(r.category),
      note: str(r.note),
      revision,
    };
  });
  const transfers = rows<Transfer>('transfers', (r) => ({
    id: id(r.id),
    sourceAccountId: id(r.sourceAccountId),
    destinationAccountId: id(r.destinationAccountId),
    amountCents: cents(r.amountCents),
    date: date(r.date),
    note: str(r.note),
  }));
  const budgets = rows<Budget>('budgets', (r) => {
    const month = str(r.month, 7);
    date(month + '-01');
    return {
      id: id(r.id),
      month,
      category: category(r.category),
      amountCents: cents(r.amountCents),
    };
  });
  const plans = rows<Plan>('plans', (r) => {
    if (r.kind !== 'bill' && r.kind !== 'income') throw Error('Invalid planned item.');
    const title = str(r.title, 100);
    if (!title.trim() || typeof r.recurring !== 'boolean') throw Error('Invalid planned item.');
    return {
      id: id(r.id),
      kind: r.kind,
      title,
      amountCents: cents(r.amountCents),
      dueDate: date(r.dueDate),
      category: r.kind === 'income' ? 'Income' : category(r.category),
      recurring: r.recurring,
      paidEntryId: r.paidEntryId === null ? null : id(r.paidEntryId),
    };
  });
  const goals = rows<Goal>('goals', (r) => {
    const name = str(r.name, 60);
    if (!name.trim()) throw Error('Missing goal name.');
    return { id: id(r.id), name, targetCents: cents(r.targetCents) };
  });
  const allocations = rows<Allocation>('allocations', (r) => ({
    id: id(r.id),
    goalId: id(r.goalId),
    amountCents: cents(r.amountCents),
    date: date(r.date),
  }));
  if (
    accounts.length +
      entries.length +
      transfers.length +
      budgets.length +
      plans.length +
      goals.length +
      allocations.length >
    MAX_LEDGER_RECORDS
  )
    throw Error('Backups support up to 25,000 total ledger records.');
  const accountIds = new Set(accounts.map((a) => a.id)),
    entryIds = new Set(entries.map((e) => e.id)),
    goalIds = new Set(goals.map((g) => g.id));
  if (
    entries.some((e) => !accountIds.has(e.accountId)) ||
    transfers.some(
      (t) =>
        !accountIds.has(t.sourceAccountId) ||
        !accountIds.has(t.destinationAccountId) ||
        t.sourceAccountId === t.destinationAccountId,
    ) ||
    plans.some((p) => p.paidEntryId && !entryIds.has(p.paidEntryId)) ||
    allocations.some((a) => !goalIds.has(a.goalId))
  )
    throw Error('Backup contains broken record links.');
  if (
    new Set(budgets.map((b) => b.month + '|' + b.category)).size !== budgets.length ||
    new Set(plans.map((p) => p.kind + '|' + p.title + '|' + p.dueDate)).size !== plans.length
  )
    throw Error('Backup contains duplicate monthly items.');
  return {
    format: 'monthwise',
    version: 1,
    createdAt,
    ownerId,
    accounts,
    entries,
    transfers,
    budgets,
    plans,
    goals,
    allocations,
  };
}
export function transactionCsv(data: Snapshot) {
  const cell = (value: string) =>
    '"' + (/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    [
      ['Date', 'Type', 'Account', 'Name', 'Category', 'Amount EUR', 'Note'],
      ...data.entries.map((e) => [
        e.date,
        e.kind,
        data.accounts.find((a) => a.id === e.accountId)?.name || '',
        e.merchant,
        e.category,
        (e.amountCents / 100).toFixed(2),
        e.note,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}
