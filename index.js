/*
 * index.js — terminal mode for the WhatsApp DP Bot.
 *
 *   node index.js            Run the bot in this terminal (auto-sets every photo
 *                            you send to your "Message yourself" chat).
 *   node index.js --set <f>  Set your DP once from an image file, then exit.
 *
 * First-time linking is done through the website (npm start) with a WhatsApp
 * pairing code — no QR. The login is saved in auth/, so this works after that.
 */

const fs = require('fs');
const { createBot, State } = require('./bot');

async function waitForLink(bot, timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    if (bot.getStatus().state === State.LINKED) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        'Not linked yet. Run "npm start", open the website and link with a pairing code first.'
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h') {
    console.log('\n  npm start                Run the website (pair with a code, upload photos)');
    console.log('  node index.js            Terminal bot mode (auto-DP from your self-chat)');
    console.log('  node index.js --set <f>  Set your DP once from an image file\n');
    return;
  }

  const bot = createBot({
    onStateChange: (s) => console.log('[bot]', s.state, s.user || ''),
  });
  bot.start();

  if (args[0] === '--set') {
    const file = args[1];
    if (!file || !fs.existsSync(file)) {
      console.error('Give an image file:  node index.js --set ./myphoto.jpg');
      process.exit(1);
    }
    await waitForLink(bot);
    console.log('Setting your DP…');
    await bot.setDp(fs.readFileSync(file));
    console.log('Done! Your profile photo is updated — full image, nothing cropped.');
    process.exit(0);
  }

  console.log('Terminal bot running. Send any photo to your "Message yourself" chat.');
  console.log('(Ctrl+C to stop)\n');
  await waitForLink(bot, 10 * 60 * 1000);
  // stay alive; the bot core handles messages and reconnects
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
