# Consumption Test Suites

End-to-end test suites for authenticated content consumption flows in the Sunbird Spark Android app.

**Session handling:** Login state is preserved across suites (`appium:noReset: true`). Each suite calls `login()` but it skips if already authenticated (checks for "Hi" greeting). Anonymous suites auto-logout before starting to ensure a clean guest state.

---

## Suite Explanations

### Suite 1 — Home In-Progress Courses

**File:** `suite1-home-in-progress-courses.e2e.ts`
**Covers:** TC_01, TC_02
**Flow:** Personalised Content - In-Progress Items
**Status:** PASS

Verifies the Home tab's "Continue from where you left" and "In Progress Courses" sections. Logs in, scrolls to find all in-progress course cards, opens each course detail page, and checks that the course name and progress percentage match. Bottom nav overlap is checked before clicking course cards (nudged up if within 100px of bottom). Ends with a summary of all processed courses.

**Test Steps:**
1. Login to the application
2. Navigate to Home tab
3. Verify in-progress items are displayed in "Continue Learning" section (TC_01, TC_02)
4. Inspect the in-progress course card showing correct progress/status (TC_02)
5. Click on the in-progress course to open it (TC_01)
6. Verify user lands on the last active content (TC_01)

### Suite 2 — Explore Content Filtering

**File:** `suite2-explore-content-filtering.e2e.ts`
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

**File:** `suite3-multi-format-content-player.e2e.ts`
**Covers:** TC_05–TC_13
**Flow:** Content Player for all formats
**Status:** NA (can be run for available formats)

Opens a course with multiple content types (PDF, EPUB, Video, HTML, YouTube, H5P, ECML, Quml) and validates each player. Tests navigation controls, completion detection, and progress tracking for every format.

**Test Steps:**
1. Login and open Explore tab
2. Filter to different Content types
3. Filter out Courses
4. **PDF (TC_05):** Navigate through pages/slides, reach end, verify completion — loops up to 100× clicking next arrow (200ms pause, no page count)
5. **ePub (TC_06):** Navigate through sections, finish, verify completion — up to 20 next-arrow clicks with 2s pauses
6. **Video MP4/Webm (TC_07/TC_11):** Start playback and wait for "You just completed" screen (120s timeout, non-fatal on expiry)
7. **YouTube (TC_09):** Double-tap at (75%×50%) up to 500× (~83min skip capacity) to fast-forward, then wait for completion
8. **HTML.zip (TC_08):** Interact with content, complete, verify status
9. **H5P (TC_10):** Uses Search (not filter) to find H5P cards, fills blank fields via ADB shell `input text`, verifies player opens (no completion wait)
10. **ECML (TC_12):** Taps at (95.7%×52.7%) up to 15× with 3s pauses, clicks Submit button if present
11. ~~**Quml (TC_13):**~~ — Yet to be added

**Implementation notes:**
- Content cards found by scanning all buttons and filtering out navigation labels (Home, Explore, My Learning, etc.)
- Filter tracking uses `previouslySelected` variable to avoid overlapping selections
- Play button tried with 3 fallback XPath patterns (content-desc → text → generic contains)
- `waitForCompletion` polls for "You just completed" up to 120s, closes rating dialog, does not throw on timeout

### Suite 4 — Course Enrollment and Progress

**File:** `suite4-course-enrollment-and-progress.e2e.ts`
**Covers:** TC_14, TC_15, TC_17, TC_18
**Flow:** Batch Selection → Content Consumption → Progress Tracking → Course Management
**Prerequisite:** Has to be a new unenrolled course
**Status:** NA

Joins a course via batch selection, consumes a single content item, verifies progress increased, then leaves the course.

**Test Steps:**
1. Login to the application
2. Navigate to Explore and apply "Courses" filter (TC_14)
3. Scroll to find an unenrolled course card, sorted left-to-right, top-to-bottom
4. Card is nudged up if hidden behind bottom nav (Y > 85% screen height)
5. Open course, click "Join the Course", select first enabled batch
6. Verify initial progress shows "Completed: 0%" (TC_15)
7. Expand curriculum accordion, detect content type via two-step method (item metadata → player UI, defaults to 'video')
8. Navigate content to completion using type-specific handler (PDF: 100× next-arrow, EPUB: 20× next-arrow, YouTube: double-tap, ECML: coordinate-tap, HTML: 2s pause, video: YouTube double-tap skip)
9. Wait for "You just completed" screen, verify progress increased
10. Open course actions menu, click "Leave course" — skipped if progress ≥ 100% (completed courses may hide the button) (TC_18)
11. Verify "Join the Course" button is now visible (unenrollment success), or log skip if at 100%

**Note:** TC_17 (Sync Progress) is currently not working — progress sync does not trigger as expected during test execution.

### Suite 5 — Certificate Preview and Download

**File:** `suite5-certificate-preview-and-download.e2e.ts`
**Covers:** TC_19, TC_23, TC_24, TC_28, TC_29
**Flow:** Certificate Preview + Multiple Download Formats + Verification
**Status:** PASS

Opens a completed course, verifies the certificate preview dialog, and checks the download options (PDF and PNG format buttons). Dialog container is `//android.app.AlertDialog`.

**Test Steps:**
1. Complete a course to 100% that supports certificates
2. **Preview Certificate (TC_19):** Open completed course, locate certificate section, click "Preview certificate", verify preview opens
3. Navigate to Profile → My Learning, locate completed course (100%)
4. Tap bottom of card to open download dialog (AlertDialog)
5. **Download as PDF (TC_23, TC_28):** Click "Download as PDF" → verify toast: "Certificate saved to Documents"
6. Re-tap card to re-open dialog
7. **Download as PNG (TC_24):** Click "Download as PNG" → verify toast: "Certificate saved to Gallery"
8. Toast checks are soft warnings — missing toast does not block the other format

### Suite 6 — My Learning Cross-Verification

**File:** `suite6-my-learning-cross-verification.e2e.ts`
**Covers:** TC_20, TC_21, TC_22
**Flow:** My Learning Page with all course states
**Status:** NA

Traverses the My Learning bottom-nav tab (Active / Completed / Upcoming) and the Profile → My Learning filter (Ongoing / Completed / Not Started). Cross-verifies that courses appear in the correct status sections across both views.

**Test Steps:**
1. Login with a user having courses in multiple states
2. Navigate to My Learning page
3. **Active Courses (TC_20):** Locate < 100% completion courses in "Active" section, parse via `extractPhase1Course` (format: "Name Name Completed: XX%")
4. **Completed Courses (TC_20):** Locate 100% completion courses in "Completed" section
5. **Upcoming Batches (TC_21):** Check for "No upcoming courses yet." — non-fatal
6. **Profile verification (TC_22):** Navigate to Profile → "My Learning", apply Ongoing/Completed/Not Started filters

**Implementation notes:**
- Phase 2 (`extractPhase2Course`) strips "Download Certificate"/"No Certificate" suffixes from course names
- `exhaustFilter` starts with `scrollUp()` then scrolls down until no new courses (max 15 scrolls)
- `scrollToAndTap` uses precision overlap calculation (nudges exact distance) instead of full-page swipes
- Cross-verification is one-directional: Phase 1 courses must appear in Phase 2

### Suite 7 — User Reports

**Covers:** TC_25, TC_26, TC_27
**Flow:** User Reports (Course Progress + Assessment + Download)
**Status:** *Only Applicable for **Portal***

### Suite 8 — Profile Data Consent Toggle

**File:** `suite8-profile-data-consent-toggle.e2e.ts`
**Covers:** TC_16
**Flow:** User Consent for Data Sharing
**Status:** PASS (native elements only)

Tests the user consent prompt for data sharing when joining a course with a Personal Information section. Dialog container is `//android.app.AlertDialog`.

**Note:** User ID, Mobile Number, and Email fields are HTML-only inside a WebView — not accessible via native Appium locators. Only native elements are verified:
- Consent checkbox
- "Do not share" button (enabled)
- "Share" button (initially disabled)

**Test Steps:**
1. Login to the application
2. Open a course with Personal Information section
3. Tap "Update" to open consent dialog
4. Verify checkbox and buttons are present
5. Save screenshot

---

## Implementation Notes

1. **Suite 3 (Multi-Format Player)** can be further split if needed:
   - Video formats suite (MP4, webm, YouTube)
   - Document formats suite (PDF, ePub, HTML.zip)
   - Interactive formats suite (H5P, ECML, Quml)

2. **Data-driven approach recommended** for Suite 3 to test available content types dynamically

3. **Suite 4 content type detection:** Two-step method — first checks item metadata/keywords, then after tapping Play rechecks player UI elements (navigation arrows, YouTube elements, Submit button). Defaults to `'video'` if no player UI matches.

4. **Suite 4 course selection:** Cards are sorted visually (Y then X) before clicking. Bottom nav overlap is handled by nudging the card up if within 85% of screen height.

5. **Suite 4 100% guard:** If the single consumed content item brings progress to 100%, the "Leave Course" step is skipped since completed courses typically hide this option. The test logs the reason and passes without asserting unenrollment.

6. **Suite 6 cross-verification:** One-directional (Phase 1 courses must appear in Phase 2). Phase 2 course names strip "Download Certificate" and "No Certificate" suffixes. `scrollToAndTap` uses precision overlap calculation instead of full-page swipes.

6. **Prerequisites:**
   - Test data setup required for users with various course states
   - Content availability for all formats in Suite 3
   - Certificate-enabled courses for Suite 5

~~7. **Parallel Execution:** Suites 1-8 are independent and can run in parallel for faster execution~~

---

## Original Test Coverage

| # | E2E Suite | Test Cases |
|---|-----------|------------|
| 1 | Home In-Progress Courses | TC_01, TC_02 |
| 2 | Explore Content Filtering | TC_03, TC_04 |
| 3 | Multi-Format Content Player | TC_05–TC_13 |
| 4 | Course Enrollment and Progress | TC_14, TC_15, TC_17, TC_18 |
| 5 | Certificate Preview and Download | TC_19, TC_23, TC_24, TC_28, TC_29 |
| 6 | My Learning Cross-Verification | TC_20, TC_21, TC_22 |
~~| 7 | User Reports | TC_25, TC_26, TC_27 |~~
| 8 | Profile Data Consent Toggle | TC_16 |
