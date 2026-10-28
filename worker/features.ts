import { ApiError, json, text, uuid, amount, date, accountExists } from './common';
import { expenseCategories, type Snapshot } from '../src/models';
import { makeBackup, validateBackup, type Backup } from '../src/backup';
import type { Identity } from './auth';
export function planningQueries(db: D1Database, owner: string) {
  return [
    db
      .prepare(
        'SELECT id,month,category,amount_cents AS amountCents FROM budgets WHERE owner_id=? ORDER BY id',
      )
      .bind(owner),
    db
      .prepare(
        'SELECT p.id,p.kind,p.title,p.amount_cents AS amountCents,p.due_date AS dueDate,p.category,p.recurring,(SELECT t.id FROM transactions t WHERE t.owner_id=p.owner_id AND t.id=p.paid_entry_id) AS paidEntryId FROM plans p WHERE p.owner_id=? ORDER BY p.due_date,p.id',
      )
      .bind(owner),
    db
      .prepare('SELECT id,name,target_cents AS targetCents FROM goals WHERE owner_id=? ORDER BY id')
      .bind(owner),
    db
      .prepare(
        'SELECT id,goal_id AS goalId,amount_cents AS amountCents,date FROM allocations WHERE owner_id=? ORDER BY id',
      )
      .bind(owner),
  ];
}
function month(value: unknown) {
  const m = text(value, 'month', 7);
  date(m + '-01');
  return m;
}
function category(value: unknown) {
  const c = text(value, 'category', 40);
  if (!expenseCategories.includes(c)) throw new ApiError(400, 'Choose a category.');
  return c;
}
const columns = {
  accounts: ['id', 'name', 'kind', 'opening_balance_cents'],
  entries: [
    'id',
    'account_id',
    'kind',
    'amount_cents',
    'date',
    'merchant',
    'category',
    'note',
    'revision',
  ],
  transfers: ['id', 'source_account_id', 'destination_account_id', 'amount_cents', 'date', 'note'],
  budgets: ['id', 'month', 'category', 'amount_cents'],
  plans: [
    'id',
    'kind',
    'title',
    'amount_cents',
    'due_date',
    'category',
    'recurring',
    'paid_entry_id',
  ],
  goals: ['id', 'name', 'target_cents'],
  allocations: ['id', 'goal_id', 'amount_cents', 'date'],
};
const fields = {
  accounts: ['id', 'name', 'kind', 'openingBalanceCents'],
  entries: [
    'id',
    'accountId',
    'kind',
    'amountCents',
    'date',
    'merchant',
    'category',
    'note',
    'revision',
  ],
  transfers: ['id', 'sourceAccountId', 'destinationAccountId', 'amountCents', 'date', 'note'],
  budgets: ['id', 'month', 'category', 'amountCents'],
  plans: ['id', 'kind', 'title', 'amountCents', 'dueDate', 'category', 'recurring', 'paidEntryId'],
  goals: ['id', 'name', 'targetCents'],
  allocations: ['id', 'goalId', 'amountCents', 'date'],
};
const keys = Object.keys(columns) as (keyof typeof columns)[];
export async function restoreMissing(
  db: D1Database,
  user: Identity,
  value: unknown,
  current: Snapshot,
) {
  let backup: Backup;
  try {
    backup = validateBackup(value);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : 'Invalid backup.');
  }
  if (backup.ownerId !== user.id)
    throw new ApiError(403, 'This backup belongs to a different account.');
  // Validate before any write. Never overwrite newer records or remove anything.
  for (const key of keys) {
    const existing = new Map(current[key].map((row) => [row.id, row]));
    for (const row of backup[key]) {
      const previous = existing.get(row.id);
      if (
        previous &&
        fields[key].some(
          (field) =>
            (previous as unknown as Record<string, unknown>)[field] !==
            (row as unknown as Record<string, unknown>)[field],
        )
      )
        throw new ApiError(
          409,
          'A record has changed since this backup. Nothing was imported; keep your current ledger.',
        );
    }
  }
  const statements = keys.flatMap((key) => {
    const table = key === 'entries' ? 'transactions' : key;
    const extracted = fields[key]
      .map((field) => "json_extract(j.value,'$." + field + "')")
      .join(',');
    // Keep individual JSON parameters small while committing the entire restore atomically.
    const chunks: D1PreparedStatement[] = [];
    let rows: unknown[] = [],
      bytes = 2;
    const flush = () => {
      if (!rows.length) return;
      chunks.push(
        db
          .prepare(
            `INSERT INTO ${table}(owner_id,${columns[key].join(',')}) SELECT ?,${extracted} FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM ${table} existing WHERE existing.owner_id=? AND existing.id=json_extract(j.value,'$.id'))`,
          )
          .bind(user.id, JSON.stringify(rows), user.id),
      );
      rows = [];
      bytes = 2;
    };
    for (const row of backup[key]) {
      const size = new TextEncoder().encode(JSON.stringify(row)).byteLength + 1;
      if (rows.length >= 1000 || bytes + size > 1_500_000) flush();
      rows.push(row);
      bytes += size;
    }
    flush();
    return chunks;
  });
  if (statements.length) await db.batch(statements);
  return json({ restored: true });
}
export async function featureRoute(
  path: string,
  method: string,
  data: Record<string, unknown>,
  db: D1Database,
  user: Identity,
  current: () => Promise<Snapshot>,
): Promise<Response | null> {
  if (path === '/api/restore' && method === 'POST')
    return restoreMissing(db, user, data.backup, await current());
  if (path === '/api/budgets' && method === 'POST') {
    const id = uuid(data.id),
      m = month(data.month),
      c = category(data.category);
    await db
      .prepare(
        'INSERT INTO budgets(id,owner_id,month,category,amount_cents) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,month,category) DO UPDATE SET amount_cents=excluded.amount_cents',
      )
      .bind(id, user.id, m, c, amount(data.amountCents))
      .run();
    return json({ id }, 201);
  }
  if (path === '/api/plans' && method === 'POST') {
    if (data.kind !== 'bill' && data.kind !== 'income')
      throw new ApiError(400, 'Choose a bill or expected income.');
    const id = uuid(data.id);
    await db
      .prepare(
        'INSERT INTO plans(id,owner_id,kind,title,amount_cents,due_date,category,recurring) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        user.id,
        data.kind,
        text(data.title, 'title', 100),
        amount(data.amountCents),
        date(data.dueDate),
        data.kind === 'income' ? 'Income' : category(data.category),
        data.recurring === true ? 1 : 0,
      )
      .run();
    return json({ id }, 201);
  }
  const pay = path.match(/^\/api\/plans\/([0-9a-f-]+)\/pay$/i);
  if (pay && method === 'POST') {
    const id = uuid(pay[1]),
      entryId = uuid(data.entryId),
      accountId = uuid(data.accountId),
      paidDate = date(data.date);
    await accountExists(db, user.id, accountId);
    if (
      !(await db
        .prepare('SELECT id FROM plans WHERE id=? AND owner_id=?')
        .bind(id, user.id)
        .first())
    )
      throw new ApiError(404, 'Planned item not found.');
    await db.batch([
      db
        .prepare(
          `INSERT INTO transactions(id,owner_id,account_id,kind,amount_cents,date,merchant,category,note)
    SELECT ?,owner_id,?,CASE WHEN kind='bill' THEN 'expense' ELSE 'income' END,amount_cents,?,title,category,'From monthly plan'
    FROM plans p WHERE p.id=? AND p.owner_id=? AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.id=p.paid_entry_id AND t.owner_id=p.owner_id)`,
        )
        .bind(entryId, accountId, paidDate, id, user.id),
      db
        .prepare(
          `UPDATE plans SET paid_entry_id=? WHERE id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.id=plans.paid_entry_id AND t.owner_id=plans.owner_id)`,
        )
        .bind(entryId, id, user.id),
    ]);
    return json({ id });
  }
  if (path === '/api/goals' && method === 'POST') {
    const id = uuid(data.id);
    await db
      .prepare('INSERT INTO goals(id,owner_id,name,target_cents) VALUES(?,?,?,?)')
      .bind(id, user.id, text(data.name, 'goal name', 60), amount(data.targetCents))
      .run();
    return json({ id }, 201);
  }
  if (path === '/api/allocations' && method === 'POST') {
    const id = uuid(data.id),
      goalId = uuid(data.goalId);
    if (
      !(await db
        .prepare('SELECT id FROM goals WHERE id=? AND owner_id=?')
        .bind(goalId, user.id)
        .first())
    )
      throw new ApiError(404, 'Goal not found.');
    await db
      .prepare('INSERT INTO allocations(id,owner_id,goal_id,amount_cents,date) VALUES(?,?,?,?,?)')
      .bind(id, user.id, goalId, amount(data.amountCents), date(data.date))
      .run();
    return json({ id }, 201);
  }
  if (path === '/api/copy-month' && method === 'POST') {
    const source = month(data.source),
      destination = month(data.destination);
    if (source === destination) throw new ApiError(400, 'Choose another month.');
    // At most two statements: copy planning only, never actual transactions or paid links.
    await db.batch([
      db
        .prepare(
          `INSERT INTO budgets(id,owner_id,month,category,amount_cents)
    SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-a'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),owner_id,?,category,amount_cents FROM budgets WHERE owner_id=? AND month=? ON CONFLICT(owner_id,month,category) DO NOTHING`,
        )
        .bind(destination, user.id, source),
      db
        .prepare(
          `INSERT INTO plans(id,owner_id,kind,title,amount_cents,due_date,category,recurring)
    SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-a'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),owner_id,kind,title,amount_cents,
    ?||'-'||printf('%02d',min(CAST(substr(due_date,9,2) AS INTEGER),CAST(strftime('%d',date(?||'-01','+1 month','-1 day')) AS INTEGER))),category,recurring
    FROM plans WHERE owner_id=? AND substr(due_date,1,7)=? AND recurring=1 ON CONFLICT(owner_id,kind,title,due_date) DO NOTHING`,
        )
        .bind(destination, destination, user.id, source),
    ]);
    return json({ copied: true });
  }
  const remove = path.match(/^\/api\/(budgets|plans|goals|allocations)\/([0-9a-f-]+)$/i);
  if (remove && method === 'DELETE') {
    const result = await db
      .prepare('DELETE FROM ' + remove[1] + ' WHERE id=? AND owner_id=? RETURNING id')
      .bind(uuid(remove[2]), user.id)
      .first();
    if (!result) throw new ApiError(404, 'Item not found.');
    return json({ deleted: true });
  }
  return null;
}
export { makeBackup };
