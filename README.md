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

## Notes

- Your photo is processed **on the machine running the site** — nothing is
  uploaded to any server except WhatsApp itself.
- The login session is saved in the `auth/` folder. To unlink, delete that folder
  (or remove the device in WhatsApp → Linked devices) and pair again.
- ⚠️ This uses an unofficial WhatsApp library. WhatsApp sometimes logs out such
  linked devices on its own — occasionally right after a photo change. If that
  happens, just pair again with a fresh code (≈20 seconds). Use at your own risk.
