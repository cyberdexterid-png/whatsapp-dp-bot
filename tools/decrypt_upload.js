#!/usr/bin/env node
/*
 * Decrypt a file saved by server.js when UPLOADS_ENCRYPTION_KEY was set.
 *
 *   UPLOADS_ENCRYPTION_KEY=<key> node tools/decrypt_upload.js <file.enc> [out]
 *
 * Without [out], writes next to the input with .dec + original guess.
 * The key is the same value you set as UPLOADS_ENCRYPTION_KEY.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , inFile, outArg] = process.argv;
const keyRaw = process.env.UPLOADS_ENCRYPTION_KEY;
if (!keyRaw) {
  console.error('Set UPLOADS_ENCRYPTION_KEY first.');
  process.exit(1);
}
if (!inFile) {
  console.error('Usage: UPLOADS_ENCRYPTION_KEY=<key> node tools/decrypt_upload.js <file.enc> [out]');
  process.exit(1);
}
const key = crypto.createHash('sha256').update(keyRaw).digest();
const buf = fs.readFileSync(inFile);
try {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  const out = outArg || inFile.replace(/\.enc$/, '') + '.dec.jpg';
  fs.writeFileSync(out, plain);
  console.log('decrypted ->', out, `(${plain.length} bytes)`);
} catch (err) {
  console.error('decrypt failed (wrong key or not an encrypted file):', err.message);
  process.exit(1);
}
