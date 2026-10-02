#!/usr/bin/env node
/*
 * Obfuscate the bot's JS so the deployed copy can't be read or edited.
 *
 *   npm run build
 *
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
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FILES = ['server.js', 'bot.js', 'dp.js', 'index.js'];
const COPY_DIRS = ['public', 'assets'];
const COPY_FILES = ['package.json', 'README.md'];

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

for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const out = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: true,
  }).getObfuscatedCode();
  fs.writeFileSync(path.join(DIST, f), out);
  console.log('obfuscated:', f, `(${(out.length / 1024).toFixed(0)} KB)`);
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
