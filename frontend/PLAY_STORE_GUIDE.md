# BizKart — Android & iOS app: what's set up, and what's left

## What's already done

- The React app is wrapped with [Capacitor](https://capacitorjs.com/) — the same web code now runs as a real Android app (`frontend/android/`).
- App identity: name **BizKart**, package/bundle ID **`in.mybizkart.app`**, brand green icon + splash screen.
- `npm run build:mobile` builds the React app pointed at `https://mybizkart.in` (instead of a relative path, which only works on the website).
- `.github/workflows/android-build.yml` builds a debug APK automatically on every push, downloadable from the GitHub Actions run — no local Android Studio required.
- The Android `back` button now navigates back inside the app instead of exiting it.
- The app is also installable as a **PWA** directly from the website today (Chrome "Install app" on Android, Safari "Add to Home Screen" on iOS) — this works right now, with no store review and no developer account.

## Why the APK isn't built and attached here

Compiling an Android app requires downloading the Android SDK and Google's Maven repository — multi-gigabyte tooling that isn't available in the environment this was built in. This is normal and by design: real Android builds run in CI (GitHub Actions) or on your own machine with Android Studio, both of which have full internet access. Nothing here is missing or broken because of it — it's simply the next step, and it's a `git push` away.

## Step 1 — Get the project into GitHub

The Capacitor project isn't in a git repo yet. To use the included CI workflow:

```
cd C:\siva\ai_projects_workspace\bizkart
git init
git add .
git commit -m "Add Capacitor Android app"
```

Then create a repo on GitHub and push it. Once pushed, go to the **Actions** tab — the "Build Android App" workflow runs automatically and produces a debug APK you can download and install on any Android phone to test (`bizkart-debug-apk` under the run's Artifacts).

## Step 2 — Test the debug APK on a real phone

1. Download `app-debug.apk` from the Actions run artifacts.
2. Transfer it to an Android phone (email, Drive, USB — any method).
3. Open it on the phone; Android will prompt to allow installs from that source once.
4. Confirm: shop login, admin login, placing an order, and password reset all work end-to-end against `https://mybizkart.in`.

If anything fails only in the app (not on the website), it's almost always a CORS issue — double check `capacitor://localhost` / `https://localhost` are in the backend's allowed origins (already added to `SecurityConfig.java`).

## Step 3 — Google Play Store submission

**Account**: Create a [Google Play Console](https://play.google.com/console) developer account — **$25 one-time fee**, plus identity verification that can take a few days for new accounts. Start this early since it can be the longest step.

**Generate a signing keystore** (do this once, keep it forever — losing it means you can never update the app again under the same listing):

```
keytool -genkeypair -v -keystore bizkart-release.keystore -alias bizkart -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for a keystore password and a key password — write both down somewhere safe (a password manager, not a text file in the repo).

**Wire the keystore into CI** so `bundleRelease` produces a signed `.aab`:

1. `base64 -w0 bizkart-release.keystore > keystore.b64` (or an online base64 encoder if you're on Windows without a `base64` command — PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("bizkart-release.keystore")) | Out-File keystore.b64`)
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `ANDROID_KEYSTORE_BASE64` — contents of `keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD` — the keystore password
   - `ANDROID_KEY_ALIAS` — `bizkart` (or whatever alias you chose)
   - `ANDROID_KEY_PASSWORD` — the key password
3. Run the workflow manually (Actions tab → "Build Android App" → "Run workflow"). The signed `.aab` appears as the `bizkart-release-aab` artifact.

**Store listing requirements** (Play Console will ask for all of these):
- App name, short & full description, category (Shopping)
- At least 2 screenshots (phone size) — take these from the debug APK
- A 512×512 app icon and a 1024×500 feature graphic
- **A privacy policy URL** — mandatory even for simple apps. If you don't have a hosted one, a single page on `mybizkart.in/privacy` describing what data is collected (phone numbers, order history, location for delivery) is enough to satisfy the requirement.
- Data safety form — declare what data the app collects (phone number, name, address, order data) and that it's used for order fulfillment
- Content rating questionnaire

Upload the `.aab`, fill in the listing, submit for review. First review for a new app/account is typically **a few days to two weeks**.

## Step 4 — iOS (deferred)

Building an iOS app requires a Mac with Xcode — Apple doesn't allow iOS builds on Linux or Windows. When you have access to one:

```
cd frontend
npm install --save-dev @capacitor/ios @capacitor/cli
npx cap add ios
npx cap sync ios
npx cap open ios
```

That opens the project in Xcode, where you'll need an [Apple Developer account](https://developer.apple.com/programs/) (**$99/year**) to set up signing and submit to TestFlight/App Store. The same `capacitor.config.json`, icons, and React code you already have will carry over — this is purely the platform-specific packaging step, no app logic needs to change.
