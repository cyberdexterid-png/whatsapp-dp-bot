# WhatsApp DP Bot 🤖

Automatically sets **your** WhatsApp profile photo from any image — full size, **nothing cropped**, no manual steps.

## What you need

- Your phone with WhatsApp
- A computer with **Node.js 18 or newer** → https://nodejs.org
  — **or** run it free in your browser with GitHub Codespaces (no install needed,
  see below)

## Option A — run in your browser (GitHub Codespaces, easiest)

1. On this repo's page, click the green **Code** button → **Codespaces** tab →
   **Create codespace on main**. (Dependencies install automatically.)
2. In the terminal at the bottom, run:

   ```bash
   npm start
   ```

3. A **QR code** appears in the terminal (a `qr.png` image is also saved —
   click it in the file explorer on the left to view it big). On your phone:
   **WhatsApp → menu (⋮ top-right) → Linked devices → Link a device** → scan it.
4. Leave the Codespace running while you want the bot active.

## Option B — run on your own computer

1. Download this folder and unzip it (or `git clone` it).
2. Open a terminal **inside the folder** and run:

   ```bash
   npm install
   ```

3. Start the bot:

   ```bash
   npm start
   ```

4. A **QR code** appears in the terminal. On your phone:
   **WhatsApp → menu (⋮ top-right) → Linked devices → Link a device** → scan the QR.

## Use it

Just send **any photo** to your own **"Message yourself"** chat on WhatsApp.
The bot converts it (whole photo visible, blurred background fill) and sets it
as your profile photo **automatically**. ✅

## Set a DP directly from a file

```bash
node index.js --set ./myphoto.jpg
```

## Notes

- Your photo is processed **on your own computer** — nothing is uploaded to any server.
- The login session is saved in the `auth/` folder. To unlink, delete that folder
  (or remove the device in WhatsApp → Linked devices) and scan again.
- ⚠️ This uses an unofficial WhatsApp library. WhatsApp may temporarily restrict
  numbers that use unofficial clients. Use at your own risk.
