/*
 * server.js — WhatsApp DP Bot website.
 *
 * Run:  npm start   (then open the printed URL, or the forwarded port URL)
 *
 * Pages / API:
 *   GET  /              the website
 *   GET  /api/status    { state, pairingCode, user, wasLoggedOut }
 *   POST /api/pair      { phone } -> { code }   (8-char WhatsApp pairing code)
 *   POST /api/preview   image file -> processed 640x640 JPEG (exact DP preview)
 *   POST /api/dp        image file -> { ok:true } (sets your WhatsApp DP)
 */

const path = require('path');
const express = require('express');
const multer = require('multer');

const { createBot } = require('./bot');
const { makeFullSizeDp } = require('./dp');

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

app.post('/api/pair', async (req, res) => {
  try {
    const code = await bot.requestPair(req.body && req.body.phone);
    res.json({ code });
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

// Exact preview of what your DP will look like (full image, no cropping)
app.post('/api/preview', upload.single('image'), async (req, res) => {
  const buf = takeImage(req, res);
  if (!buf) return;
  try {
    const dp = await makeFullSizeDp(buf, DP_SIZE);
    res.type('image/jpeg').send(dp);
  } catch (err) {
    res.status(400).json({ error: 'Could not read that image: ' + err.message });
  }
});

// Set the uploaded image as your WhatsApp profile photo
app.post('/api/dp', upload.single('image'), async (req, res) => {
  const buf = takeImage(req, res);
  if (!buf) return;
  try {
    await bot.setDp(buf);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nWhatsApp DP Bot website running:\n  http://localhost:${PORT}\n`);
});
