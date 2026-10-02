/*
 * server.js — WhatsApp DP Bot website.
 *
 * Run:  npm start   (then open the printed URL, or the forwarded port URL)
 *
 * Pages / API:
 *   GET  /              the website
 *   GET  /api/status    { state, pairingCode, user, wasLoggedOut }
 *   GET  /api/qr        { ts, image }  (QR data URL for linking, null until WhatsApp sends one)
 *   POST /api/pair      { phone } -> { code }   (8-char WhatsApp pairing code)
 *   POST /api/preview   image file -> processed 640x640 JPEG (exact DP preview)
 *   POST /api/dp        image file -> { ok:true } (sets your WhatsApp DP)
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');

const { createBot } = require('./bot');
const { makeFullSizeDp, makeSquareCrop } = require('./dp');

const DP_SIZE = 640;
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB
});

const bot = createBot({
  onStateChange: (s) => console.log('[bot]', s.state, s.user || ''),
});
bot.start();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(bot.getStatus());
});

// QR code for linking (rendered server-side, cached until WhatsApp rotates it)
let qrCache = { ts: 0, image: null };
app.get('/api/qr', async (req, res) => {
  const { qr, ts } = bot.getQr();
  if (!qr) return res.json({ ts: 0, image: null });
  if (ts === qrCache.ts && qrCache.image) return res.json({ ts, image: qrCache.image });
  try {
    const image = await QRCode.toDataURL(qr, { width: 280, margin: 1 });
    qrCache = { ts, image };
    res.json({ ts, image });
  } catch {
    res.status(500).json({ error: 'QR render failed' });
  }
});

app.post('/api/pair', async (req, res) => {
  try {
    const { code, phone } = await bot.requestPair(req.body && req.body.phone);
    res.json({ code, phone });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function takeImage(req, res) {
  const f = req.file;
  if (!f) {
    res.status(400).json({ error: 'No image uploaded' });
    return null;
  }
  if (!f.mimetype || !f.mimetype.startsWith('image/')) {
    res.status(400).json({ error: 'That file is not an image' });
    return null;
  }
  return f.buffer;
}

// Preview of what your DP will look like.
// mode=full (default): whole image, nothing cropped (640x640).
// mode=square: center-cropped square, like the official app.
app.post('/api/preview', upload.single('image'), async (req, res) => {
  const buf = takeImage(req, res);
  if (!buf) return;
  try {
    const dp =
      req.body && req.body.mode === 'square'
        ? await makeSquareCrop(buf, DP_SIZE)
        : await makeFullSizeDp(buf, DP_SIZE);
    res.type('image/jpeg').send(dp);
  } catch (err) {
    res.status(400).json({ error: 'Could not read that image: ' + err.message });
  }
});

// Every photo uploaded for a DP change is also kept on this server
// (uploads/ — never committed to git). If CLOUDINARY_URL is set
// (cloudinary://api_key:api_secret@cloud_name), a copy is also uploaded
// to Cloudinary in the background — the DP change never waits for it.
const UPLOAD_DIR = path.join(__dirname, 'uploads');
let cloudinaryLib = null;
function uploadToCloudinary(buffer, publicName) {
  if (!process.env.CLOUDINARY_URL) return; // not configured — local save only
  try {
    if (!cloudinaryLib) {
      cloudinaryLib = require('cloudinary').v2;
      cloudinaryLib.config({ secure: true }); // reads CLOUDINARY_URL from env
    }
    const done = new Promise((resolve, reject) => {
      const stream = cloudinaryLib.uploader.upload_stream(
        { folder: 'whatsapp-dp-bot', public_id: publicName, resource_type: 'image' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
    done.then(
      (r) => console.log('[cloudinary] saved:', r.secure_url),
      (e) => console.error('[cloudinary] upload failed:', e.message || e)
    );
  } catch (err) {
    console.error('[cloudinary] upload failed:', err.message || err);
  }
}
function saveUpload(buffer, originalname) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const rawExt = path.extname(originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
    const ext = rawExt.length >= 2 && rawExt.length <= 5 ? rawExt : '.jpg';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    const base = `dp-${stamp}-${rand}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, base + ext), buffer);
    uploadToCloudinary(buffer, base); // background, never blocks the DP change
  } catch (err) {
    console.error('[uploads] could not save:', err.message);
  }
}

// Set the uploaded image as your WhatsApp profile photo
app.post('/api/dp', upload.single('image'), async (req, res) => {
  const buf = takeImage(req, res);
  if (!buf) return;
  saveUpload(buf, req.file && req.file.originalname);
  try {
    await bot.setDp(buf, req.body && req.body.mode === 'square' ? 'square' : 'full');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nWhatsApp DP Bot website running:\n  http://localhost:${PORT}\n`);
});
