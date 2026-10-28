import fs from 'node:fs';
import { createHash } from 'node:crypto';
const html = fs.readFileSync('dist/index.html', 'utf8');
const source = fs.readFileSync('public/sw.js', 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const version = createHash('sha256')
  .update(html + source)
  .digest('hex')
  .slice(0, 12);
const paths = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  ...assets,
];
const result = source
  .replace("'monthwise-shell-v1'", JSON.stringify('monthwise-shell-' + version))
  .replace(/const PRECACHE\s*=\s*\[[\s\S]*?\];/, 'const PRECACHE = ' + JSON.stringify(paths) + ';');
if (!assets.length || !result.includes(assets[0]))
  throw Error('App assets missing from offline shell');
fs.writeFileSync('dist/sw.js', result);
console.log('PWA shell prepared with ' + assets.length + ' versioned assets.');
