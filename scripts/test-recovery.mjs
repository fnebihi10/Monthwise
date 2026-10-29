import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const directory = path.resolve('.wrangler/recovery-fixtures', randomUUID());
fs.mkdirSync(directory, { recursive: true });
const config = path.join(directory, 'wrangler.json');
fs.writeFileSync(
  config,
  JSON.stringify({
    name: 'recovery-fixture',
    compatibility_date: '2026-10-19',
    d1_databases: [
      { binding: 'DB', database_name: 'synthetic-recovery', database_id: randomUUID() },
    ],
  }),
);
const fixture = path.join(directory, 'fixture.sql');
const schemas = fs
  .readdirSync('migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => fs.readFileSync('migrations/' + file, 'utf8'))
  .join('\n');
fs.writeFileSync(
  fixture,
  schemas +
    `\nINSERT INTO users(id) VALUES('recovery-test');\nINSERT INTO accounts(id,owner_id,name,kind,opening_balance_cents) VALUES('a','recovery-test','Synthetic','bank',1000);\nINSERT INTO transactions(id,owner_id,account_id,kind,amount_cents,date,merchant,category,note) VALUES('e','recovery-test','a','expense',250,'2026-10-28','Synthetic','Other','');\n`,
);
const run = (args) => {
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw Error('Synthetic recovery drill failed.');
  }
  return result.stdout;
};
const cli = 'node_modules/wrangler/bin/wrangler.js';
run([cli, 'd1', 'execute', 'DB', '--config', config, '--local', '--file', fixture, '--yes']);
const backup = path.join(directory, 'synthetic.sql');
run([cli, 'd1', 'export', 'DB', '--config', config, '--local', '--output', backup]);
const output = run(['scripts/recovery-check.mjs', backup]).trim();
const report = JSON.parse(fs.readFileSync(output.match(/Report: (.+)/)[1].trim(), 'utf8'));
if (report.accounts !== 1 || report.entries !== 1) throw Error('Recovery lost synthetic records.');
console.log(output);
console.log('Synthetic SQL export/import drill passed. No cloud data or credentials used.');
