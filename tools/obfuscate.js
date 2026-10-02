#!/usr/bin/env node
/*
 * Obfuscate the bot's JS so the deployed copy can't be read or edited.
 *
 *   npm run build
 *
 * Uses the javascript-obfuscator CLI via npx (pinned version, fetched at
 * build time — not a project dependency, so package-lock.json stays clean).
 * Reads server.js, bot.js, dp.js, index.js -> writes obfuscated copies to
 * dist/ (same relative layout, so require('./bot') etc. keep working).
 * Also copies public/, assets/, package.json, README.md into dist/.
 * Run the hidden copy with:  node dist/server.js
 *
 * NOTE: this only hides the DEPLOYED copy. The readable source stays in
 * this repo (and in git history) — make the repo private if the source
 * itself must not be seen.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FILES = ['server.js', 'bot.js', 'dp.js', 'index.js'];
const COPY_DIRS = ['public', 'assets'];
const COPY_FILES = ['package.json', 'README.md'];
const OBFUSCATOR = 'javascript-obfuscator@4.1.1';

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const args = (input, output) => [
  '-y', '-p', OBFUSCATOR, 'javascript-obfuscator',
  input,
  '--output', output,
  '--compact', 'true',
  '--control-flow-flattening', 'true',
  '--control-flow-flattening-threshold', '0.75',
  '--dead-code-injection', 'true',
  '--dead-code-injection-threshold', '0.3',
  '--identifier-names-generator', 'hexadecimal',
  '--rename-globals', 'false',
  '--string-array', 'true',
  '--string-array-rotate', 'true',
  '--string-array-shuffle', 'true',
  '--string-array-threshold', '0.75',
  '--unicode-escape-sequence', 'true',
];

for (const f of FILES) {
  execFileSync('npx', args(path.join(ROOT, f), path.join(DIST, f)), { stdio: 'pipe' });
  const kb = (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0);
  console.log('obfuscated:', f, `(${kb} KB)`);
}
for (const d of COPY_DIRS) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) copyRecursive(src, path.join(DIST, d));
}
for (const f of COPY_FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
}
// dist runs standalone: its own auth/uploads live under dist/
console.log('\ndone -> dist/. run with: node dist/server.js');
