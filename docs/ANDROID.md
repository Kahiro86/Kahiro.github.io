# Installing & distributing Kahiro on Android

Kahiro is a **Progressive Web App (PWA)** — a single static build hosted on
GitHub Pages. There is no server and no shared database: every person who
opens the app gets their **own private data**, stored only in their browser
(and, if they turn it on, their own cloud account). The app file itself
contains none of your data, so handing it to someone always gives them a
fresh, empty install.

There are three ways to get it onto a phone, easiest first.

---

## 1. Install as a PWA (no APK, 20 seconds) — recommended

This is how most people should "install" it.

1. Open the app link in **Chrome** (Android) or **Safari** (iOS).
   - In the app: **Settings → Share a Clean Copy → Copy app link / Share app**.
2. Open the browser menu → **Add to Home Screen** (Android) / **Share → Add
   to Home Screen** (iOS).
3. It now appears as an icon, launches full-screen, and works offline.

Each device keeps its own separate data. Your brother's habits, streaks and
journal never touch yours.

---

## 2. Send the standalone app file

**Settings → Share a Clean Copy → Download clean copy** saves `Kahiro.html`.
Send that file (WhatsApp, email, USB). Opening it in a phone browser runs the
whole app locally. Data is still per-device and private. (The home-screen
PWA install above is smoother, but this works with zero internet.)

---

## 3. Build a signed Android APK / publish to the Play Store

For a real Play Store listing you wrap the PWA in a **Trusted Web Activity
(TWA)**. This must be done on your own machine — it needs a signing keystore
and a Google Play Console account, neither of which can live in this repo.

### Option A — PWABuilder (no local tooling)

1. Go to <https://www.pwabuilder.com>.
2. Paste your app URL (the GitHub Pages link).
3. It validates the manifest (already set up: name, icons 192/512, standalone,
   `start_url`) → **Package for stores → Android**.
4. Download the generated **`.apk`** (for sideloading) and **`.aab`** (for the
   Play Store), plus the signing key it creates — **back that key up**; you
   need the same key for every future update.

### Option B — Bubblewrap (command line)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<your-username>.github.io/<repo>/manifest-<hash>.webmanifest
#   (grab the exact manifest URL from index.html's <link rel="manifest">)
bubblewrap build          # produces app-release-signed.apk and .aab
```

Bubblewrap will prompt to create a keystore on first run — **keep it safe and
reuse it** for updates.

### Publish

1. Create an app in the **Google Play Console** (one-time \$25 developer fee).
2. Upload the **`.aab`**, fill in the store listing, content rating and privacy
   policy, then submit for review.
3. To verify the TWA opens without a browser bar, host a
   **Digital Asset Links** file at
   `https://<your-domain>/.well-known/assetlinks.json` containing your app's
   SHA-256 signing fingerprint (PWABuilder/Bubblewrap print it for you).

### Privacy & independence (already true)

- **Each user's data is isolated** — it lives in their own device storage /
  their own cloud account. No user can see or overwrite another's data.
- **App updates never touch user data** — an update replaces code only;
  stored data persists across versions.
- Because the build carries no personal data, the same APK/link can be shared
  with anyone and each install is a clean slate.

---

## Updating later

Push a new build to GitHub Pages as usual. PWA installs pick it up
automatically. For a Play Store APK/AAB, re-run PWABuilder or
`bubblewrap build` **with the same keystore**, bump the version, and upload the
new `.aab` to the Play Console.
