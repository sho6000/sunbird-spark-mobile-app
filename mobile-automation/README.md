# Mobile App E2E Test Automation

End-to-end test suite for Android mobile apps using WebdriverIO + Appium. Designed for the Sunbird Spark app but configurable for any Android app via `.env`.

---

> Emulator Recommendation: Use a Pixel 3 API 35 image for best compatibility. Real devices can be used but ensure correct `DEVICE_NAME`, `PLATFORM_VERSION`, and `APP_UDID` in `.env`.

---

## Running Tests

### Option 1 — GitHub Actions (CI)

```bash
# 1. Fork the repo on GitHub

# 2. Clone your fork and run:
mkdir -p .github/workflows
cp mobile-automation/.github/workflows/e2e-tests.yml .github/workflows/
git add .github/workflows/e2e-tests.yml
git commit -m "add E2E test workflow"
git push

# 3. Add your APK
git add -f mobile-automation/app/android/app-debug.apk
git commit -m "add APK"
git push
```

**4.** Add 3 secrets in `Settings → Secrets and variables → Actions`:
- `SUNBIRD_EMAIL`
- `SUNBIRD_PASSWORD`
- `SUNBIRD_USERNAME`

**5.** Go to **Actions** → **"Automation E2E Tests"** → **"Run workflow"**

Pick scope (`all` / `anonymous` / `consumption`) or enter a shortcut (e.g. `consumption/suite4`). Results render inline on the run summary page.

### Option 2 — Locally

```bash
chmod +x install.sh && ./install.sh
# Edit .env with your credentials
cd config && npm run test
```

### Session Handling

The app session is **preserved across suites** (`appium:noReset: true`). The login state is kept between consumption suites — `login()` is called in each suite but skips if already authenticated. Anonymous suites automatically log out if a previous session is found, ensuring a clean guest state.

---

## Project Structure

```
mobile-automation/
├── app/
│   └── android/app-debug.apk      # Android app binary
├── config/
│   ├── package.json                # Dependencies & scripts
│   ├── tsconfig.json               # TypeScript config
│   └── wdio.conf.ts                # WebdriverIO config
├── data/
│   ├── .envExample                 # Template for .env
│   ├── users.ts                    # Test user definitions
│   └── testdata.ts                 # Course/content test data
├── fixtures/
│   ├── login.fixture.ts            # Login + verify helpers
│   ├── logout.fixture.ts           # Logout helper
│   └── scroll.fixture.ts           # Scroll-until-text helper
├── specs/
│   └── android/
│       ├── anonymous_user_consumption/  # [Guest-mode tests](specs/android/anonymous_user_consumption/README.md)
│       └── consumption/                 # [Authenticated consumption tests](specs/android/consumption/README.md)
├── reports/
│   └── android/
│       ├── test-results/               # Test output &
│       └── screenshots/            # Screenshots captured during tests
|
├── install.sh                       # One-click setup
└── README.md                        # This file
```


## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime for tests |
| Java JDK | 17+ | Android SDK toolchain |
| Android Studio | Latest | Emulator / SDK manager |
| Appium | 2.x | Mobile automation server |

### Environment Variables

Set these after installing Android Studio:

| Variable | Path |
|----------|------|
| `ANDROID_HOME` | `~/Android/Sdk` (Linux/macOS) or `%LOCALAPPDATA%\Android\Sdk` (Windows) |
| `JAVA_HOME` | JDK installation directory |

---

## Manual Setup

```bash
# Install JS dependencies
cd config
npm install

# Create .env from example
cp ../data/.envExample ../.env

# Create report directories
mkdir -p ../reports/android/test-results
mkdir -p ../reports/android/screenshots
```

---

## Configuration

### `.env` file (at project root)

```ini
# ── App Credentials ──
SUNBIRD_EMAIL=your-email@example.com
SUNBIRD_PASSWORD=your-password
SUNBIRD_USERNAME=YourUserName

# ── Appium / Device Config ──
APPIUM_PORT=4723
DEVICE_NAME=Pixel_3_API_35
PLATFORM_VERSION=15
APP_PATH=./app/android/app-debug.apk
```

Replace the values with your own:
- `SUNBIRD_EMAIL` / `SUNBIRD_PASSWORD` / `SUNBIRD_USERNAME` — login credentials
- `DEVICE_NAME` — your emulator name (`adb devices`) or real device name
- `PLATFORM_VERSION` — Android version (e.g. `14`, `15`)
- `APP_PATH` — path to your APK relative to the project root

### Custom capabilities

For additional Appium capabilities (e.g. `appium:udid`, `appium:noReset`), edit `config/wdio.conf.ts` in the `capabilities` array.

---

### Reports

After a run, check:
- `reports/android/test-results/` — console logs and `.gitkeep`
- `reports/android/screenshots/` — screenshots captured during tests
- `reports/junit-results/junit-results.xml` — JUnit XML (usable by CI tools)
- `reports/md-report/Test-Report-YYYY-MM-DD.md` — **Markdown summary** with pass/fail counts per suite, failed test details with error messages, and screenshot paths

---

## Adapting for Your Own App

1. Replace `app/android/app-debug.apk` with your own APK
2. Update `.env` with your credentials and device specs
3. Adjust locators in `fixtures/*.ts` and `specs/**/*.ts` to match your app's UI
4. If your app uses different navigation (no bottom tabs), update the login fixture accordingly

The fixture files in `fixtures/` are the main extension points:
- **`login.fixture.ts`** — adapt the login flow to your app's auth screen
- **`scroll.fixture.ts`** — works for any app (generic scroll-until-text)
- **`logout.fixture.ts`** — adapt to your app's logout location

---

## App Setup Cmds

To install the application
```bash
adb install -r .\app\android\app-debug.apk

#unix
adb install -r ./app/android/app-debug.apk 
```

To test activity start:
```bash
#windows
adb shell dumpsys activity activities | findstr /i "org.sunbird.spark.app"
#Unix
adb shell dumpsys activity activities | grep -i "org.sunbird.spark.app"
```


