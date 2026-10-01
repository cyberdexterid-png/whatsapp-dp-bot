/*
 * WhatsApp DP Bot — auto-changes YOUR profile photo. No cropping, no manual steps.
 *
 * USE:
 *   npm start                  Link your WhatsApp (QR code) and run the bot.
 *                              Then send ANY photo to your "Message yourself"
 *                              chat — the bot sets it as your DP automatically.
 *
 *   node index.js --set <img>  Set your DP directly from an image file.
 *
 * LINKING (first run):
 *   A QR code prints in this terminal. On your phone open WhatsApp >
 *   menu (⋮) > Linked devices > Link a device, and scan it.
 *
 * NOTE: this uses an unofficial WhatsApp library. WhatsApp may temporarily
 * restrict numbers that use unofficial clients. Use at your own risk.
 */

const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const { HttpsProxyAgent } = require('https-proxy-agent');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');

const { makeFullSizeDp } = require('./dp');

const AUTH_DIR = path.join(__dirname, 'auth'); // login session is saved here
const DP_SIZE = 640; // WhatsApp profile photo size

/**
 * This computer reaches the internet through a proxy — route WhatsApp's
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

async function showQr(qr) {
  console.log('\nScan this QR with WhatsApp:');
  console.log('  WhatsApp > menu (top-right ⋮) > Linked devices > Link a device\n');
  qrcode.generate(qr, { small: true });
  // also save a scannable image (qr.png) — refreshed every time the code renews
  try {
    await QRCode.toFile(path.join(__dirname, 'qr.png'), qr, { width: 440, margin: 2 });
    console.log('QR image saved to qr.png');
  } catch (e) {
    console.error('Could not save QR image:', e.message);
  }
}

/** Convert any image to a full-size, no-crop DP and set it as my profile photo. */
async function setMyDp(sock, imageBuffer) {
  const dp = await makeFullSizeDp(imageBuffer, DP_SIZE);
  await sock.updateProfilePicture(sock.user.id, { img: dp });
}

/** Connect (or reconnect) to WhatsApp as a linked device. Resolves with the socket. */
function connect() {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const proxyAgent = getProxyAgent();
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }), // keep the terminal clean
      browser: ['DP Bot', 'Chrome', '120.0'],
      agent: proxyAgent, // websocket via proxy
      fetchAgent: proxyAgent, // media up/download via proxy
    });

    sock.ev.on('creds.update', saveCreds);

    let done = false;
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !done) await showQr(qr);

      if (connection === 'open' && !done) {
        done = true;
        console.log('Linked as', sock.user.id);
        resolve(sock);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        if (!done) {
          done = true;
          reject(
            new Error(
              loggedOut
                ? 'Logged out of WhatsApp. Delete the "auth" folder and scan the QR again.'
                : 'Could not connect to WhatsApp. Check your internet and try again.'
            )
          );
        } else {
          // tell the running bot the connection dropped
          sock.ev.emit('dpbot.closed', { loggedOut });
        }
      }
    });
  });
}

/** Bot mode: watch for photos YOU send, auto-set each one as your DP. */
async function runBot(sock) {
  console.log('Bot running.');
  console.log('Send any photo to your "Message yourself" chat and it becomes your DP automatically.\n');

  const onMessage = async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const m of messages) {
      try {
        if (!m.message || !m.message.imageMessage) continue;
        if (!m.key.fromMe) continue; // only photos you send yourself

        const chat = m.key.remoteJid;
        await sock.sendMessage(chat, { text: 'Making your full-size DP…' }, { quoted: m });

        const imgBuffer = await downloadMediaMessage(m, 'buffer', {});
        await setMyDp(sock, imgBuffer);

        await sock.sendMessage(
          chat,
          { text: 'Done! Your profile photo is updated — full image, nothing cropped.' },
          { quoted: m }
        );
      } catch (err) {
        console.error('Could not update DP:', err.message);
        try {
          await sock.sendMessage(m.key.remoteJid, {
            text: 'Could not update your DP: ' + err.message,
          });
        } catch (_) {
          /* ignore */
        }
      }
    }
  };

  sock.ev.on('messages.upsert', onMessage);

  // wait until the connection drops, then clean up and return
  const { loggedOut } = await new Promise((resolve) => {
    sock.ev.once('dpbot.closed', resolve);
  });
  sock.ev.off('messages.upsert', onMessage);
  return { loggedOut };
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h') {
    console.log('\n  npm start                  Run the bot (send it a photo to auto-set your DP)');
    console.log('  node index.js --set <img>  Set your DP directly from an image file\n');
    return;
  }

  // --- one-shot mode: set DP from a file, then exit ---
  if (args[0] === '--set') {
    const file = args[1];
    if (!file || !fs.existsSync(file)) {
      console.error('Give an image file:  node index.js --set ./myphoto.jpg');
      process.exit(1);
    }
    const sock = await connect();
    console.log('Setting your DP…');
    await setMyDp(sock, fs.readFileSync(file));
    console.log('Done! Your profile photo is updated — full image, nothing cropped.');
    process.exit(0);
  }

  // --- bot mode (default): stay linked, auto-set every photo you send ---
  for (;;) {
    try {
      const sock = await connect();
      const { loggedOut } = await runBot(sock);
      if (loggedOut) {
        console.log('Logged out. Delete the "auth" folder and run again to re-link.');
        process.exit(1);
      }
      console.log('Connection lost. Reconnecting…');
    } catch (err) {
      console.error(err.message);
      console.log('Retrying in 5 seconds… (Ctrl+C to stop)');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
