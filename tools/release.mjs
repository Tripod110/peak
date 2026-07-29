#!/usr/bin/env node
/* Peak release tool — keeps the version strings in sync.
 *
 * A release touches the version in four places, and getting them out of step
 * fails in ways that are hard to spot:
 *
 *   app.js     const APP_VERSION = 'vNN'      → what Settings reports
 *   index.html ?v=NN  (×10)                   → what the browser requests
 *   sw.js      const CACHE = 'peak-vNN'       → forces a fresh cache on activate
 *   sw.js      SHELL  ?v=NN  (×9)             → what gets pre-cached on install
 *
 * The nasty one: the service worker is cache-first for versioned assets. If
 * index.html asks for ?v=28 but SHELL still pre-caches ?v=27, the pre-cache is
 * dead weight and first paint waits on the network. If CACHE doesn't change,
 * activate() never clears the old entries and users keep the previous build.
 *
 * Usage:
 *   node tools/release.mjs --check     verify everything agrees (exit 1 if not)
 *   node tools/release.mjs 28          bump every reference to v28
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);

function currentVersions() {
  const app = read('app.js'), html = read('index.html'), sw = read('sw.js');
  return {
    appVersion: (app.match(/const APP_VERSION = 'v(\d+)'/) || [])[1] ?? null,
    htmlAssets: [...new Set([...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]))],
    htmlCount: [...html.matchAll(/\?v=(\d+)/g)].length,
    swCache: (sw.match(/const CACHE = 'peak-v(\d+)'/) || [])[1] ?? null,
    swShell: [...new Set([...sw.matchAll(/\?v=(\d+)/g)].map(m => m[1]))],
    swCount: [...sw.matchAll(/\?v=(\d+)/g)].length
  };
}

function check() {
  const v = currentVersions();
  const all = new Set([v.appVersion, v.swCache, ...v.htmlAssets, ...v.swShell].filter(Boolean));
  const ok = all.size === 1 && v.appVersion && v.swCache;

  console.log(`app.js     APP_VERSION   v${v.appVersion}`);
  console.log(`index.html ?v=           ${v.htmlAssets.map(x => 'v' + x).join(', ')}  (${v.htmlCount} refs)`);
  console.log(`sw.js      CACHE         peak-v${v.swCache}`);
  console.log(`sw.js      SHELL ?v=     ${v.swShell.map(x => 'v' + x).join(', ')}  (${v.swCount} refs)`);

  // the SHELL list must name every script index.html loads, or the pre-cache misses files
  const htmlFiles = [...read('index.html').matchAll(/(?:src|href)="([\w.]+\.(?:js|css))\?v=\d+"/g)].map(m => m[1]);
  const shellFiles = [...read('sw.js').matchAll(/'([\w.]+\.(?:js|css))\?v=\d+'/g)].map(m => m[1]);
  const missing = htmlFiles.filter(f => !shellFiles.includes(f));
  const extra = shellFiles.filter(f => !htmlFiles.includes(f));

  if (missing.length) console.log(`\n✗ in index.html but not pre-cached by sw.js: ${missing.join(', ')}`);
  if (extra.length) console.log(`\n✗ pre-cached by sw.js but not loaded by index.html: ${extra.join(', ')}`);

  if (!ok) {
    console.log(`\n✗ version mismatch — found ${[...all].map(x => 'v' + x).join(' and ')}`);
    return false;
  }
  if (missing.length || extra.length) return false;
  console.log(`\n✓ all ${v.htmlCount + v.swCount + 2} references agree on v${v.appVersion}`);
  return true;
}

function bump(next) {
  const from = currentVersions().appVersion;
  if (!from) { console.error('✗ could not find APP_VERSION in app.js'); process.exit(1); }
  if (Number(next) <= Number(from)) {
    console.error(`✗ v${next} is not ahead of the current v${from} — the service worker only`);
    console.error('  clears its cache when CACHE changes, so versions must move forward.');
    process.exit(1);
  }

  write('app.js', read('app.js').replace(/const APP_VERSION = 'v\d+'/, `const APP_VERSION = 'v${next}'`));
  write('index.html', read('index.html').replace(/\?v=\d+/g, `?v=${next}`));
  write('sw.js', read('sw.js')
    .replace(/const CACHE = 'peak-v\d+'/, `const CACHE = 'peak-v${next}'`)
    .replace(/\?v=\d+/g, `?v=${next}`));

  console.log(`Bumped v${from} → v${next}\n`);
  return check();
}

const arg = process.argv[2];
if (!arg || arg === '--check') {
  process.exit(check() ? 0 : 1);
} else if (/^\d+$/.test(arg.replace(/^v/, ''))) {
  process.exit(bump(arg.replace(/^v/, '')) ? 0 : 1);
} else {
  console.error('Usage: node tools/release.mjs [--check | <version number>]');
  process.exit(1);
}
