// Public checks only: never sign in or download ledger records.
const origin = 'https://monthwise.online';
async function check(path, expected, verify = () => true) {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== expected || !(await verify(response)))
    throw Error(`${path}: unexpected response (HTTP ${response.status})`);
  console.log(`${path}: passed`);
}
await check('/api/health', 200, async (r) => (await r.json()).status === 'ok');
await check('/api/ledger', 401, (r) => r.headers.get('cache-control') === 'no-store');
await check('/auth/google', 303, (r) => {
  const url = new URL(r.headers.get('location'));
  return url.origin === 'https://accounts.google.com';
});
const response = await fetch(origin + '/api/version', { signal: AbortSignal.timeout(15000) });
if (response.status === 401) {
  console.log('Version endpoint unavailable on this older release. Run npm run deployment:status.');
} else {
  if (!response.ok) throw Error('Version check failed: HTTP ' + response.status);
  const { version } = await response.json();
  if (!version?.id) throw Error('Deployed Worker version metadata is missing.');
  console.log('Deployed version: ' + version.id);
  console.log('Release tag: ' + (version.tag || '(not tagged)'));
}
