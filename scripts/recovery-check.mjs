import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !fs.existsSync(file))
  throw Error('Usage: npm run recovery:check -- path/to/backup.sql');
const input = path.resolve(file);
if (fs.existsSync(input + '.manifest.json')) {
  const manifest = JSON.parse(fs.readFileSync(input + '.manifest.json', 'utf8'));
  if (createHash('sha256').update(fs.readFileSync(input)).digest('hex') !== manifest.sha256)
    throw Error('Backup checksum does not match its manifest.');
}
const directory = path.resolve('.wrangler/recovery', randomUUID());
fs.mkdirSync(directory, { recursive: true });
const run = (args) => {
  // This script never accepts or constructs --remote. Each drill uses a fresh local directory.
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--env',
      'local',
      '--local',
      '--persist-to',
      directory,
      '--yes',
      ...args,
    ],
    {
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      maxBuffer: 10_000_000,
    },
  );
  if (result.status !== 0)
    throw Error('Local recovery check failed. No remote database was accessed.');
  return result.stdout;
};
run(['--file', input]);
const checks = JSON.parse(
  run([
    '--command',
    'PRAGMA quick_check; PRAGMA foreign_key_check; SELECT count(*) AS accounts FROM accounts; SELECT count(*) AS entries FROM transactions; SELECT 1 AS mismatch FROM users u LEFT JOIN ledger_usage l ON l.owner_id=u.id WHERE coalesce(l.record_count,0) <> (SELECT count(*) FROM accounts WHERE owner_id=u.id)+(SELECT count(*) FROM transactions WHERE owner_id=u.id)+(SELECT count(*) FROM transfers WHERE owner_id=u.id)+(SELECT count(*) FROM budgets WHERE owner_id=u.id)+(SELECT count(*) FROM plans WHERE owner_id=u.id)+(SELECT count(*) FROM goals WHERE owner_id=u.id)+(SELECT count(*) FROM allocations WHERE owner_id=u.id);',
    '--json',
  ]),
);
if (
  !checks[0].results.every((row) => Object.values(row).includes('ok')) ||
  checks[1].results.length ||
  checks[4].results.length
)
  throw Error('Recovered database failed integrity or foreign-key checks.');
const report = {
  checkedAt: new Date().toISOString(),
  localOnly: true,
  integrity: 'ok',
  foreignKeyViolations: 0,
  usageCounters: 'consistent',
  accounts: checks[2].results[0].accounts,
  entries: checks[3].results[0].entries,
};
fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  'Local recovery succeeded. Integrity and record links passed. Report: ' +
    path.join(directory, 'report.json'),
);
