# Sunbird Spark Mobile App
## Tech Overview

The Spark mobile app is built on **React + Ionic 8** with **Capacitor 8** as the native bridge. It runs natively on Android (minSdkVersion 26 / Android 8.0).

### Key Architectural Decisions

- **Vite as the build tool** — The app uses Vite 7 for fast hot module replacement during web development and faster production builds.
- **Offline-first design** — Content is downloaded as `.ecar` files (content packages) to device filesystem storage, with metadata tracked in SQLite. PDF, Video, ePub, and QuML players can render content from local files without any network connection.
- **Telemetry sync** — Telemetry events are staged in SQLite when offline and synced to the server in batches when connectivity is restored.
- **Multilingual support** — The app ships with translations for English, French, Portuguese, and Arabic. Arabic includes RTL layout support, and language preference is persisted in browser localStorage across sessions.

---

## Developer Setup

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | Ionic | 8.x |
| UI Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Native Bridge | Capacitor | 8.x |
| Language | TypeScript | 5.x |
| Testing | Vitest + Testing Library | — |

### Prerequisites

Before cloning, ensure you have the following installed.

#### All Platforms

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x | Recommended for compatibility |
| npm | 10.x | Bundled with Node 22 |
| Git | Any recent | — |

#### Android Builds Only

| Tool | Version | Notes |
|---|---|---|
| Android Studio | Latest stable | — |
| Android SDK | compileSdk 36 (Android 15) | — |
| JDK | 17+ | Required by Gradle 8.11 |
| Gradle | 8.11.1 | Managed by the wrapper — no manual install needed |

> **Note:** iOS is not currently supported. The `ios/` platform has not been added to this project.

---

### Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd sunbird-spark-mobile-app
```

### Step 2 — Install Dependencies

```bash
npm install
```

This also runs two postinstall scripts automatically:

- **`copy-assets.js`** — Copies PDF, Video, ePub, and QuML player assets from `node_modules/@project-sunbird/*` into:
  - `public/assets/`
  - `public/content/assets/`
- **`scripts/copyContentPlayer.js`** — Assembles `@project-sunbird/content-player` into `public/content-player/` with any local overrides applied on top.

> ⚠️ If either script fails, check that all `@project-sunbird/*` packages were installed correctly before proceeding.

### Step 3 — Configure Environment Variables (Android)

Copy the example gradle properties file and fill in your backend credentials:

```bash
cp android/gradle.properties.example android/gradle.properties
```

Open `android/gradle.properties` and update the placeholder values:

```properties
base_url=https://your-sunbird-backend.org
mobile_app_consumer=mobile_device
mobile_app_key=<your-api-key>
mobile_app_secret=<your-api-secret>
producer_id=dev.sunbirded.org
```

> **Note:** `gradle.properties` is added to `.gitignore` and should never be committed. It contains sensitive credentials.

These values are injected as Android string resources at build time and read at runtime via the `capacitor-read-native-setting` plugin.

> ⚠️ The app will not connect to a backend without these values.

### Step 4 — Add Google Services for Push Notifications

Place your `google-services.json` file in:

```
android/app/
```

> **Note:** `google-services.json` is added to `.gitignore` and should never be committed. It contains sensitive Firebase credentials.

The build system checks for this file and applies the Google Services Gradle plugin conditionally.

### Step 5 — Build and Run on Android

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug && cd ..
```

| Command | Purpose |
|---|---|
| `npm run build` | Compiles TypeScript and bundles web assets into `dist/` |
| `npx cap sync android` | Copies `dist/` into the Android project and syncs native plugins |
| `./gradlew assembleDebug` | Builds the debug APK |

The output APK will be available at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

> **Tip:** Use `./gradlew clean assembleDebug` only when you suspect stale build artifacts (e.g., after changing native dependencies or syncing new Capacitor plugins).

### Open in Android Studio

```bash
npx cap open android
```

In Android Studio: Select a device/emulator from the dropdown and click the Run button (green play icon)

---

## How to Change the App ID

A script is provided to update the app ID across all required files automatically.

```bash
node scripts/update-app-id.js com.your.new.id
```

This will update the following files in one shot and run `npx cap sync android` at the end:

| File | What changes |
|---|---|
| `capacitor.config.ts` | `appId` |
| `android/app/build.gradle` | `namespace` + `applicationId` |
| `android/app/src/main/assets/capacitor.config.json` | `appId` |
| `android/app/src/main/res/values/strings.xml` | `package_name` + `custom_url_scheme` |
| `android/app/src/main/java/...` | Moves all `.java` files to the new package path + updates `package` declaration |

If anything fails mid-run, all file changes are rolled back automatically.

### Play Console Warning

> **The first AAB you upload to Play Console permanently locks the signing keystore for that app ID. Never change the keystore after the first upload.**

If you changed the keystore and got rejected by Play Console, the only fix is to register a new app ID and run the script above with the new ID.