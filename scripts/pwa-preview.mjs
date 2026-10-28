import { spawnSync, spawn } from 'node:child_process';
const cli = 'node_modules/wrangler/bin/wrangler.js';
const common = ['--env', 'local', '--persist-to', '.wrangler/pwa-e2e'];
const result = spawnSync(
  process.execPath,
  [cli, 'd1', 'migrations', 'apply', 'DB', '--local', ...common],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status || 1);
const child = spawn(
  process.execPath,
  [cli, 'dev', '--ip', '127.0.0.1', '--port', '5179', ...common],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
child.on('exit', (code) => process.exit(code || 0));
