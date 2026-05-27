# Mobile App E2E Test Automation

End-to-end test suite for Android mobile apps using WebdriverIO + Appium. Designed for the Sunbird Spark app but configurable for any Android app via `.env`.

---

## Quick Start

```bash
# 1. Run the setup script
./install.sh

# 2. Edit your .env file with credentials and device settings
#    (install.sh creates .env from data/.envExample)

# 3. Start Appium
npx appium

# 4. Run all tests
cd config && npm run wdio
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
│       ├── anonymous_user_consumption/  # Guest-mode tests
│       └── consumption/
│           ├── suite1-continue-learning.e2e.ts
│           ├── suite2-content-discovery.e2e.ts
│           ├── suite3-content-player.e2e.ts
│           ├── suite4-enrollment-progress.e2e.ts
│           ├── suite5-certificate-flow.e2e.ts
│           └── suite6-learning-dashboard.e2e.ts
├── reports/
│   └── android/
│       ├── test-results/               # Test output & screenshots
│       └── screenshots/
├── install.sh                       # One-click setup
└── README.md                        # This file
```

---

## Suite Explanations

### Suite 1 — Continue Learning Journey

**File:** `specs/android/consumption/suite1-continue-learning.e2e.ts`
**Covers:** TC_01, TC_02
**Flow:** Personalised Content - In-Progress Items
**Status:** PASS

Verifies the Home tab's "Continue from where you left" and "In Progress Courses" sections. Logs in, scrolls to find all in-progress course cards, opens each course detail page, and checks that the course name and progress percentage match.

**Test Steps:**
1. Login to the application
2. Navigate to Home tab
3. Verify in-progress items are displayed in "Continue Learning" section (TC_01, TC_02)
4. Inspect the in-progress course card showing correct progress/status (TC_02)
5. Click on the in-progress course to open it (TC_01)
6. Verify user lands on the last active content (TC_01)

### Suite 2 — Content Discovery & Filtering

**File:** `specs/android/consumption/suite2-content-discovery.e2e.ts`
**Covers:** TC_03, TC_04
**Flow:** Explore Page Filters + Content Display
**Status:** PASS / NA

Navigates to the Explore tab, opens the Filters dialog, and cycles through each content type filter (Video, Audio, PDF, EPUB, HTML, Interactive). Verifies filtered results display correctly and cards remain properly rendered.

**Test Steps:**
1. Login to the application
2. Navigate to Explore tab
3. Inspect content cards for title, metadata, and controls (TC_04)
4. Scroll through available content
5. Click on filter icon
6. Apply "Content Type" filters (TC_03)
7. Verify filtered results display correctly
8. Verify filtered content cards still render with all details (TC_04)

### Suite 3 — Multi-Format Content Player

**File:** `specs/android/consumption/suite3-content-player.e2e.ts`
**Covers:** TC_05–TC_13
**Flow:** Content Player for all formats
**Status:** NA (can be run for available formats)

Opens a course with multiple content types (PDF, EPUB, Video, HTML, YouTube, H5P, ECML, Quml) and validates each player. Tests navigation controls, completion detection, and progress tracking for every format.

**Test Steps:**
1. Login and open Explore tab
2. Filter to different Content types
3. Filter out Courses
4. **PDF (TC_05):** Navigate through pages/slides, reach end, verify completion
5. **ePub (TC_06):** Navigate through sections, finish, verify completion
6. **Video MP4 (TC_07):** Start playback, wait until end, verify completion
7. **Video webm (TC_11):** Play and complete, verify status update
8. **HTML.zip (TC_08):** Interact with content, complete, verify status
9. **YouTube (TC_09):** Play video to completion, verify tracking
10. **H5P (TC_10):** Complete interactions, verify activity completion
11. **ECML (TC_12):** Navigate and complete, verify status
12. ~~**Quml (TC_13):**~~ — Yet to be added

### Suite 4 — Course Enrollment & Progress

**File:** `specs/android/consumption/suite4-enrollment-progress.e2e.ts`
**Covers:** TC_14, TC_15, TC_17, TC_18
**Flow:** Batch Selection → Content Consumption → Progress Tracking → Course Management
**Prerequisite:** Has to be a new unenrolled course
**Status:** NA

Joins a course via batch selection, tracks progress before/after content consumption, syncs progress, and tests the "Leave course" flow.

**Test Steps:**
1. Login to the application
2. Navigate to a course with multiple batches (TC_14)
3. Open batch selection dialog
4. Select a specific batch
5. Join the course successfully
6. **Track initial progress** (TC_15)
7. Consume one or more lessons/content items (TC_15)
8. Reopen course and verify progress percentage has increased (TC_15)
9. Verify lesson shows updated completion status (TC_15)
10. Continue consuming until reaching 100% completion
11. Open course actions menu
12. Click "Sync progress" and verify confirmation (TC_17)
13. Navigate to another active course (< 100%)
14. Open course actions menu
15. Click "Leave course" (TC_18)
16. Verify unenrollment success

### Suite 5 — Certificate Flow

**File:** `specs/android/consumption/suite5-certificate-flow.e2e.ts`
**Covers:** TC_19, TC_23, TC_24, TC_28, TC_29
**Flow:** Certificate Preview + Multiple Download Formats + Verification
**Status:** NA / BLOCKED

Opens a completed course, verifies the certificate preview dialog, and checks the download options (PDF and PNG format buttons).

**Test Steps:**
1. Complete a course to 100% that supports certificates
2. **Preview Certificate (TC_19):** Open completed course, locate certificate section, click "Preview certificate", verify preview opens
3. Navigate to Profile → My Learning, locate completed course (100%)
4. **Download as PDF (TC_23, TC_28):** Click "Download Certificate" → "Download as PDF" → verify download
5. **Download as PNG (TC_24):** Click "Download Certificate" → "Download as PNG" → verify download
6. **Verify Certificate (TC_29):** Open Profile → certificate verification → verify valid result

**Note:** TC_28 is marked BLOCKED as TC_23 & TC_24 cover this flow.

### Suite 6 — My Learning Dashboard

**File:** `specs/android/consumption/suite6-learning-dashboard.e2e.ts`
**Covers:** TC_20, TC_21, TC_22
**Flow:** My Learning Page with all course states
**Status:** NA

Traverses the My Learning bottom-nav tab (Active / Completed / Upcoming) and the Profile → My Learning filter (Ongoing / Completed / Not Started). Cross-verifies that courses appear in the correct status sections across both views.

**Test Steps:**
1. Login with a user having courses in multiple states
2. Navigate to My Learning page
3. **Active Courses (TC_20):** Locate < 100% completion courses in "Active" section
4. **Completed Courses (TC_20):** Locate 100% completion courses in "Completed" section
5. **Upcoming Batches (TC_21):** Scroll to upcoming sections, verify cards with correct details
6. **Verify from Profile (TC_22):** Navigate to Profile → "My Learning" tab, review all course cards and status labels, verify status matches actual completion state

### Suite 7 — User Reports

**Covers:** TC_25, TC_26, TC_27
**Flow:** User Reports (Course Progress + Assessment + Download)
**Status:** *Only Applicable for **Portal***

### Suite 8 — Profile Data & Consent Management

**Covers:** TC_16
**Flow:** User Consent for Data Sharing
**Status:** NA (Yet to verify)

Tests the user consent prompt for data sharing when joining a course with a Personal Information section.

**Test Steps:**
1. Login to the application
2. Open a course with Personal Information section
3. Review consent text/prompt
4. Choose accept/reject option
5. Verify consent action displays as popup notification

---

## Running Tests

```bash
# All Android suites
cd config && npm run wdio

# Single suite (temporary — edit specs array in wdio.conf.ts)
# or use --spec flag:
npx wdio run ./config/wdio.conf.ts --spec ./specs/android/consumption/suite1-continue-learning.e2e.ts
```

### Reports

After a run, check:
- `reports/android/test-results/` — console logs and `.gitkeep`
- `reports/android/screenshots/` — screenshots captured during tests

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

## To install the application

```bash
adb install -r .\app\android\app-debug.apk
```

To test activity start:
```bash
adb shell dumpsys activity activities | findstr /i "org.sunbird.app"
```

---

## Summary: Script Reduction

### Original Test Cases: **29 individual scripts**

### **Total Reduction: 29 scripts → 8 scripts (72% reduction)**

---

## Implementation Notes

1. **Suite 3 (Multi-Format Player)** can be further split if needed:
   - Video formats suite (MP4, webm, YouTube)
   - Document formats suite (PDF, ePub, HTML.zip)
   - Interactive formats suite (H5P, ECML, Quml)

2. **Data-driven approach recommended** for Suite 3 to test available content types dynamically

3. **Prerequisites:**
   - Test data setup required for users with various course states
   - Content availability for all formats in Suite 3
   - Certificate-enabled courses for Suite 5

~~4. **Parallel Execution:** Suites 1-8 are independent and can run in parallel for faster execution~~

---

## Benefits of Consolidation

✅ **Reduced Maintenance:** 8 scripts instead of 29  
✅ **Realistic User Flows:** Tests mimic actual user behavior  
✅ **Better Coverage:** E2E flows catch integration issues  
✅ **Faster Execution:** Shared setup/teardown reduces overhead  
✅ **Easier Debugging:** Complete user journeys easier to troubleshoot

---

## Original Test Coverage

| # | E2E Suite | Test Cases |
|---|-----------|------------|
| 1 | Continue Learning Journey | TC_01, TC_02 |
| 2 | Content Discovery | TC_03, TC_04 |
| 3 | Multi-Format Player | TC_05–TC_13 |
| 4 | Enrollment & Progress | TC_14, TC_15, TC_17, TC_18 |
| 5 | Certificate Flow | TC_19, TC_23, TC_24, TC_28, TC_29 |
| 6 | My Learning Dashboard | TC_20, TC_21, TC_22 |
~~| 7 | User Reports | TC_25, TC_26, TC_27 |~~
| 8 | Data Consent | TC_16 |

