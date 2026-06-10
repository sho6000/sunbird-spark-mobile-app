# Mobile App E2E Test Automation

End-to-end test suite for Android mobile apps using WebdriverIO + Appium. Designed for the Sunbird Spark app but configurable for any Android app via `.env`.

---

> Emulator Recommendation: Use a Pixel 3 API 35 image for best compatibility. Real devices can be used but ensure correct `DEVICE_NAME`, `PLATFORM_VERSION`, and `APP_UDID` in `.env`.

---

## Quick Start

```bash
# 1. Run the setup script
chmod +x install.sh && ./install.sh

# 2. Edit your .env file with credentials and device settings
Update the .env file with your credentials.

# 3. Run all tests (Appium is auto-managed)
cd config && npm run test
```
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
│       ├── anonymous_user_consumption/  # Guest-mode tests (see README.md inside)
│       └── consumption/                 # Authenticated consumption tests (see README.md inside)
│           ├── suite1-home-in-progress-courses.e2e.ts
│           ├── suite2-explore-content-filtering.e2e.ts
│           ├── suite3-multi-format-content-player.e2e.ts
│           ├── suite4-course-enrollment-and-progress.e2e.ts
│           ├── suite5-certificate-preview-and-download.e2e.ts
│           └── suite6-my-learning-cross-verification.e2e.ts
├── reports/
│   └── android/
│       ├── test-results/               # Test output & screenshots
│       └── screenshots/
├── install.sh                       # One-click setup
└── README.md                        # This file
```



---

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

## Manual Setup (if not using install.sh)

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
DEVICE_NAME=Android GoogleAPI Emulator
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

## Running Tests

```bash
# All Android suites + generate report (recommended)
cd config && npm run test

# All Android suites only
cd config && npm run wdio

# Generate Markdown report from last run (without re-running tests)
cd config && npm run report

# Single suite (temporary — edit specs array in wdio.conf.ts)
# or use --spec flag:
cd config

npx wdio run ./wdio.conf.ts --spec ../specs/android/consumption/suite1-home-in-progress-courses.e2e.ts

npx wdio run ./wdio.conf.ts --spec ../specs/android/anonymous_user_consumption/suite1-guest-home-and-explore-browsing.e2e.ts

# If you want individual reports run the script seperately and
# run the ``npm run report`` after the script is executed
```

### Session Handling

The app session is **preserved across suites** (`appium:noReset: true`). The login state is kept between consumption suites — `login()` is called in each suite but skips if already authenticated. Anonymous suites automatically log out if a previous session is found, ensuring a clean guest state.

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


