import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const vite = resolve('node_modules/vite/bin/vite.js');
if (!existsSync('dist')) mkdirSync('dist');
const children = new Set();
const persistence = process.env.MONTHWISE_STATE_DIR
  ? ['--persist-to', process.env.MONTHWISE_STATE_DIR]
  : [];
const apiPort = process.env.MONTHWISE_API_PORT || '8787';
if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1024 || Number(apiPort) > 65535)
  throw new Error('Invalid development API port.');
let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function run(file, args) {
  const child = spawn(process.execPath, [file, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  children.add(child);
  child.on('exit', () => children.delete(child));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  return child;
}
const migration = run(wrangler, [
  'd1',
  'migrations',
  'apply',
  'DB',
  '--local',
  '--env',
  'local',
  ...persistence,
]);
migration.on('exit', async (code) => {
  if (ending) return;
  if (code !== 0) {
    stop(code || 1);
    return;
  }
  const backend = run(wrangler, [
    'dev',
    '--env',
    'local',
    '--ip',
    '127.0.0.1',
    '--port',
    apiPort,
    ...persistence,
  ]);
  backend.on('exit', (code) => stop(code || 0));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ending; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:' + apiPort + '/api/ledger', {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (ending) return;
    if (!ready)
      throw new Error('The local backend did not start. Check the Wrangler output above.');
    const frontend = run(vite, ['--host', '127.0.0.1', ...process.argv.slice(2)]);
    frontend.on('exit', (code) => stop(code || 0));
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
});
