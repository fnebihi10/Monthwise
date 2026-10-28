import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
const db = config.env.public.d1_databases[0];
if (db.database_id === config.env.personal.d1_databases[0].database_id)
  throw Error('Refusing to use the personal database as the public backup source.');
const directory = path.resolve('.wrangler/backups');
fs.mkdirSync(directory, { recursive: true });
const file = path.join(
  directory,
  'public-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '.sql',
);
// Capture CLI output: exports can print signed download URLs; do not copy those into logs.
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'export',
    'DB',
    '--env',
    'public',
    '--remote',
    '--skip-confirmation',
    '--output',
    file,
  ],
  { encoding: 'utf8', timeout: 180000, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
);
if (result.status !== 0 || !fs.existsSync(file))
  throw Error('Public backup failed. Check Cloudflare authentication and database access.');
const data = fs.readFileSync(file);
if (!data.length) throw Error('Public backup is empty.');
const manifest = {
  createdAt: new Date().toISOString(),
  database: db.database_name,
  file: path.basename(file),
  bytes: data.length,
  sha256: createHash('sha256').update(data).digest('hex'),
};
fs.writeFileSync(file + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Public backup saved: ' + file);
console.log('Checksum manifest saved. Keep an encrypted copy outside this computer and Git.');
