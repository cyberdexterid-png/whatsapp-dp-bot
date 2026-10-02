# VENOM DP Bot — Android app 📱

A native Android wrapper: the bot website runs full-screen inside the app.
The Node.js server still runs on your host (Render / Railway / Codespaces…) —
the app just opens it. Photo picking works via the system gallery.

## Build it

1. Install **Android Studio** (Hedgehog or newer) with an Android SDK.
2. In Android Studio: **File → Open** → select the `android/` folder → let Gradle sync.
3. Open `app/src/main/java/com/venom/dpbot/MainActivity.kt` and set your URL:
   ```kotlin
   const val SERVER_URL = "https://your-app.onrender.com"
   ```
   (must be `https` and reachable from the phone)
4. **Run ▶** on a device/emulator, or **Build → Build App Bundle(s)/APK(s) →
   Build APK(s)** to get an installable APK (`app/build/outputs/apk/debug/`).

## Notes

- First launch needs internet (the site is remote).
- If the server URL changes, update `SERVER_URL` and rebuild.
- `minSdk 26` (Android 8.0+). Launcher icon is an adaptive vector (no PNGs needed).
