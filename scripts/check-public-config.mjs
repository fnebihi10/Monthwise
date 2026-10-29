import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
const env = config.env?.public;
const errors = [];
if (env?.vars?.ACCESS_MODE !== 'public')
  errors.push('Set the public environment ACCESS_MODE to public.');
try {
  const origin = new URL(env.vars.APP_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.vars.APP_ORIGIN) throw Error();
} catch {
  errors.push('Set APP_ORIGIN to the exact public HTTPS origin without a trailing slash.');
}
if (!env?.vars?.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com'))
  errors.push('Configure a production Google OAuth client ID for the public environment.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env?.vars?.SUPPORT_EMAIL || ''))
  errors.push('Configure a public support email.');
if (
  env?.name === config.env.personal.name ||
  env?.d1_databases?.[0]?.database_id === config.env.personal.d1_databases[0].database_id
)
  errors.push('Public hosting and database must be separate from the existing personal ledger.');
if (!env?.ratelimits?.some((binding) => binding.name === 'EDGE_LIMITER'))
  errors.push('Configure the EDGE_LIMITER binding.');
if (errors.length) {
  console.error(
    'Public deployment is not ready:\n' + errors.map((error) => '- ' + error).join('\n'),
  );
  process.exit(1);
}
console.log(
  'Local public configuration passed. Before deploying, complete docs/PUBLIC-LAUNCH.md: review the Google audience/callback, add GOOGLE_CLIENT_SECRET securely, and back up/apply database migrations.',
);
