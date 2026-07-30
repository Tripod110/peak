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

/* Only ever match a version query inside a quoted asset reference —
   "app.js?v=28" or 'app.js?v=28'. A blanket /\?v=\d+/ also rewrites prose, which
   really happened: it silently edited a code comment that mentioned ?v=NN,
   turning the explanation into nonsense and inflating the reference count. */
const ASSET_REF = /(["'])([\w.\/-]+\.(?:js|css))\?v=(\d+)\1/g;

function refs(src) {
  return [...src.matchAll(ASSET_REF)].map(m => ({ file: m[2], version: m[3] }));
}
function bumpRefs(src, next) {
  return src.replace(ASSET_REF, (_, q, file) => `${q}${file}?v=${next}${q}`);
}

function currentVersions() {
  const app = read('app.js'), html = read('index.html'), sw = read('sw.js');
  const htmlRefs = refs(html), swRefs = refs(sw);
  return {
    appVersion: (app.match(/const APP_VERSION = 'v(\d+)'/) || [])[1] ?? null,
    htmlAssets: [...new Set(htmlRefs.map(r => r.version))],
    htmlCount: htmlRefs.length,
    htmlFiles: htmlRefs.map(r => r.file),
    swCache: (sw.match(/const CACHE = 'peak-v(\d+)'/) || [])[1] ?? null,
    swShell: [...new Set(swRefs.map(r => r.version))],
    swCount: swRefs.length,
    swFiles: swRefs.map(r => r.file)
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
  const missing = v.htmlFiles.filter(f => !v.swFiles.includes(f));
  const extra = v.swFiles.filter(f => !v.htmlFiles.includes(f));

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
  write('index.html', bumpRefs(read('index.html'), next));
  write('sw.js', bumpRefs(
    read('sw.js').replace(/const CACHE = 'peak-v\d+'/, `const CACHE = 'peak-v${next}'`), next));

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
