/*
 * bot.js — shared WhatsApp bot core.
 *
 * Used by server.js (website) and index.js (terminal). Handles:
 *  - linked-device connection lifecycle (pairing-code based, no QR)
 *  - requesting a WhatsApp pairing code for a phone number
 *  - setting your profile photo from any image (full size, no cropping)
 *  - auto-setting every photo you send to your "Message yourself" chat
 *  - surviving drops, and recovering from WhatsApp-side logouts by
 *    wiping the dead session so a fresh pairing code can be issued
 */

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { HttpsProxyAgent } = require('https-proxy-agent');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  jidNormalizedUser,
  Browsers,
} = require('@whiskeysockets/baileys');

const { makeFullSizeDp, makeSquareCrop } = require('./dp');

const AUTH_DIR = path.join(__dirname, 'auth'); // login session is saved here
const DP_SIZE = 640; // WhatsApp profile photo size
const RECONNECT_DELAY_MS = 4000;

const State = {
  NEEDS_PAIRING: 'needs-pairing', // fresh, waiting for a phone number
  PAIRING: 'pairing', // pairing code issued, waiting for the user to enter it
  LINKED: 'linked', // connected as a linked device
  RECONNECTING: 'reconnecting', // transient drop, retrying on its own
  LOGGED_OUT: 'logged-out', // WhatsApp killed the session, needs a fresh pairing
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || 'Timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * This computer may reach the internet through a proxy — route WhatsApp's
 * connection through it too, otherwise the TLS handshake fails.
 */
function getProxyAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return undefined;
  try {
    return new HttpsProxyAgent(proxy);
  } catch {
    return undefined;
  }
}

function wipeAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) return;
  for (const f of fs.readdirSync(AUTH_DIR)) {
    fs.rmSync(path.join(AUTH_DIR, f), { recursive: true, force: true });
  }
}

function createBot({ onStateChange } = {}) {
  let sock = null;
  let state = State.NEEDS_PAIRING;
  let pairingCode = null;
  let pairingPhone = null; // number the current code was issued for
  let qrCode = null; // latest QR string from WhatsApp
  let qrTs = 0; // when the current QR was received
  let user = null;
  let registered = false; // true once this session has ever linked successfully
  let wasLoggedOut = false;
  let started = false;
  let onMessage = null;

  function getStatus() {
    return { state, pairingCode, pairingPhone, qrTs, user, wasLoggedOut };
  }

  function getQr() {
    return { qr: qrCode, ts: qrTs };
  }

  function setState(s) {
    state = s;
    if (onStateChange) {
      try {
        onStateChange(getStatus());
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Your own chat JID ("Message yourself").
   * sock.user.id includes our device id (e.g. 9476...:13@s.whatsapp.net) —
   * messages must go to the bare JID (9476...@s.whatsapp.net) or they never
   * reach the phone. (updateProfilePicture tolerates the device suffix, which
   * is why the DP changed while the message never arrived.)
   */
  function selfJid() {
    return jidNormalizedUser(sock.user.id);
  }

  function dpProgressBar(pct) {
    const filled = Math.round(pct / 10);
    return '▓'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
  }

  function dpSuccessMessage() {
    return (
      '✅ *DP UPLOAD SUCCESS* ✅\n\n' +
      'Your WhatsApp profile photo has been updated! 🎉\n\n' +
      '━━━━━━━━━━━━━━━\n' +
      '⚡ Make by *VENOM* ⚡\n' +
      '━━━━━━━━━━━━━━━'
    );
  }

  function attachMessages(s) {
    onMessage = async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        try {
          if (!m.message || !m.message.imageMessage) continue;
          if (!m.key.fromMe) continue; // only photos you send yourself

          const imgBuffer = await downloadMediaMessage(m, 'buffer', {});
          await setDp(imgBuffer, 'original', m);
        } catch (err) {
          try {
            await s.sendMessage(m.key.remoteJid, {
              text: 'Could not update your DP: ' + err.message,
            });
          } catch {
            /* ignore */
          }
        }
      }
    };
    s.ev.on('messages.upsert', onMessage);
  }

  function detachMessages(s) {
    if (s && onMessage) {
      try {
        s.ev.off('messages.upsert', onMessage);
      } catch {
        /* ignore */
      }
      onMessage = null;
    }
  }

  async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update || {};
    if (!connection && !qr) return;

    // WhatsApp sends a fresh QR for unlinked sessions (it expires, so keep the latest)
    if (qr) {
      qrCode = qr;
      qrTs = Date.now();
    }
    if (!connection) return;

    if (connection === 'open' && sock) {
      registered = true;
      user = jidNormalizedUser(sock.user.id);
      pairingCode = null;
      qrCode = null;
      wasLoggedOut = false;
      attachMessages(sock);
      setState(State.LINKED);
      return;
    }

    if (connection === 'close') {
      const dead = sock;
      sock = null;
      detachMessages(dead);

      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // WhatsApp revoked the session (this can happen after a DP change
        // with unofficial clients). Wipe it so a fresh pairing code works.
        try {
          dead.end();
        } catch {
          /* ignore */
        }
        wipeAuthDir();
        registered = false;
        const midPairing = state === State.PAIRING ? pairingPhone : null;
        pairingCode = null;
        pairingPhone = null;
        qrCode = null;
        user = null;
        wasLoggedOut = true;
        setState(State.LOGGED_OUT);
        await ensureSocket(); // fresh unregistered socket, ready to re-pair
        // if the logout killed a pairing in progress, issue a fresh code automatically
        if (midPairing) {
          try {
            await requestPair(midPairing);
          } catch {
            /* user can tap "get a new code" on the site */
          }
        }
        return;
      }

      setState(State.RECONNECTING);
      await sleep(RECONNECT_DELAY_MS);
      try {
        await ensureSocket();
        if (state === State.RECONNECTING) {
          setState(registered ? State.RECONNECTING : pairingCode ? State.PAIRING : State.NEEDS_PAIRING);
        }
      } catch {
        setState(State.RECONNECTING);
      }
    }
  }

  async function ensureSocket() {
    if (sock) return sock;
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const proxyAgent = getProxyAgent();
    const s = makeWASocket({
      auth: authState,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Safari'),
      agent: proxyAgent,
      fetchAgent: proxyAgent,
    });
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', handleConnectionUpdate);
    sock = s;
    return s;
  }

  /** Ask WhatsApp for an 8-character pairing code for this phone number. */
  async function requestPair(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(digits)) {
      throw new Error('Enter your phone number with country code, e.g. 94763398318');
    }
    const s = await ensureSocket();
    if (s.authState.creds.registered) {
      throw new Error('This device is already linked to WhatsApp');
    }
    console.log('[pair] requesting pairing code for +' + digits);
    // the pairing IQ fails if the websocket handshake isn't done yet — wait for it
    await withTimeout(s.waitForSocketOpen(), 20000, 'Could not reach WhatsApp. Check your internet and try again.');
    const code = await s.requestPairingCode(digits);
    pairingCode = code;
    pairingPhone = digits;
    wasLoggedOut = false;
    setState(State.PAIRING);
    return { code, phone: digits };
  }

  /**
   * Set your profile photo from any image buffer, with a LIVE progress
   * message that updates like a playing video (via message edits).
   * WhatsApp's server only accepts SQUARE profile pictures — anything else
   * is rejected ("not-acceptable"). So:
   * mode 'full' (default): the whole image stays visible, nothing cropped
   *   (fitted on a blurred background) — the only way to have zero cropping.
   * mode 'square': center-crop to square, like the official app does.
   */
  async function setDp(imageBuffer, mode, quotedMsg) {
    if (state !== State.LINKED || !sock) {
      throw new Error('WhatsApp is not linked yet — pair first');
    }
    const chat = selfJid();
    const quoted = quotedMsg ? { quoted: quotedMsg } : {};
    const progress = await sock.sendMessage(
      chat,
      { text: `⏳ *Uploading DP...*\n${dpProgressBar(5)}` },
      quoted
    );
    const editProgress = (text) => sock.sendMessage(chat, { text, edit: progress.key });
    try {
      const dp =
        mode === 'square'
          ? await makeSquareCrop(imageBuffer, DP_SIZE)
          : await makeFullSizeDp(imageBuffer, DP_SIZE);
      await editProgress(`⏳ *Uploading DP...*\n${dpProgressBar(45)}`);
      await sleep(500);
      // v7 takes the image buffer directly (defaults to 640x640 square)
      await sock.updateProfilePicture(selfJid(), dp);
      await editProgress(`⏳ *Uploading DP...*\n${dpProgressBar(90)}`);
      await sleep(500);
      // the grand finale — the message transforms into the success card
      await editProgress(dpSuccessMessage());
    } catch (err) {
      try {
        await editProgress(`❌ *DP upload failed*\n${err.message}`);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  async function start() {
    if (started) return;
    started = true;
    try {
      await ensureSocket();
    } catch {
      setState(State.RECONNECTING);
      await sleep(RECONNECT_DELAY_MS);
      if (!sock) {
        try {
          await ensureSocket();
        } catch {
          /* will retry on next tick via connection events */
        }
      }
    }
  }

  return { start, getStatus, getQr, requestPair, setDp, State };
}

module.exports = { createBot, State, DP_SIZE };
