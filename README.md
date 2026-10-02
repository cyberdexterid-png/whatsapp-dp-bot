# WhatsApp DP Bot 📸

Set **your** WhatsApp profile photo from any image — full size, **nothing cropped** —
through a simple website. No QR codes: you link with a WhatsApp **pairing code**.

## Run it (website)

You need **Node.js 18+**. Either:

**A. In your browser — GitHub Codespaces (easiest, nothing to install)**
1. On this repo's page: green **Code** button → **Codespaces** → **Create codespace on main**.
2. In the terminal at the bottom: `npm start`
3. Open the forwarded website URL (Codespaces shows a popup / see the Ports tab).

**B. On your own computer**
```bash
npm install
npm start
```
Then open http://localhost:3000

## Use it

1. **Link WhatsApp** — on the site, enter your number (with country code, e.g.
   `94763398318`) and tap *Get pairing code*. On your phone:
   **WhatsApp → ⋮ → Linked devices → Link a device → “Link with phone number instead”**,
   then type the 8-character code.
2. **Set your DP** — choose any photo on the site. You'll see an exact preview of
   the DP (whole photo visible, blurred background fills the rest), then tap
   *Set as my WhatsApp DP*.

Bonus: any photo you send to your own **“Message yourself”** chat also becomes
your DP automatically while the site is running.

## Terminal mode (optional)

```bash
node index.js            # bot mode in this terminal
node index.js --set <f>  # set DP once from an image file
```
First-time linking is done via the website; the login is saved in `auth/`.

## Cloud backup of uploaded photos (optional, free)

Every photo you set as DP is saved in the local `uploads/` folder. To also keep
a copy in the cloud, use **Cloudinary** (free tier ≈ 25 GB):

1. Sign up free at https://cloudinary.com
2. From your dashboard get **Cloud name**, **API Key**, **API Secret**.
3. Before `npm start`, set (never commit this):
   ```bash
   export CLOUDINARY_URL='cloudinary://<api_key>:<api_secret>@<cloud_name>'
   ```
4. `npm start` — uploads now also go to Cloudinary (`whatsapp-dp-bot` folder)
   in the background. Without the variable, photos are only saved locally.

### Encrypting saved photos (optional)

Set `UPLOADS_ENCRYPTION_KEY` to any passphrase before `npm start`:

```bash
export UPLOADS_ENCRYPTION_KEY='a-long-random-passphrase-only-you-know'
```

Saved copies (local `uploads/` + Cloudinary) are then AES-256-GCM encrypted —
unreadable without the key (Cloudinary will show them as raw files, not images).
Decrypt a copy later with:

```bash
UPLOADS_ENCRYPTION_KEY='...' node tools/decrypt_upload.js uploads/<file>.enc
```

⚠️ Lose the key = lose the photos. There is no recovery.

## Hiding the code (obfuscation, optional)

`npm run build` obfuscates `server.js`, `bot.js`, `dp.js`, `index.js` into
`dist/` (unreadable, uneditable) — deploy that copy with `node dist/server.js`.
On hosts like Render/Railway set the build command to
`npm install && npm run build` and the start command to `node dist/server.js`.

Note: the readable source stays in this repo and its git history — obfuscation
only hides the deployed copy. Make the repo private if the source itself must
not be seen.

## Notes

- Your photo is processed **on the machine running the site**, saved in the
  local `uploads/` folder (and to Cloudinary if you set it up) — and sent to
  WhatsApp when you set it as your DP.
- The login session is saved in the `auth/` folder. To unlink, delete that folder
  (or remove the device in WhatsApp → Linked devices) and pair again.
- ⚠️ This uses an unofficial WhatsApp library. WhatsApp sometimes logs out such
  linked devices on its own — occasionally right after a photo change. If that
  happens, just pair again with a fresh code (≈20 seconds). Use at your own risk.
