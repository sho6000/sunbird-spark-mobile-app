# Anonymous User Consumption Test Suites

End-to-end test suites for logged out users content consumption flows in the Sunbird Spark Android app.

**Session handling:** Each suite auto-detects if a user is already logged in via `ensureAnonymous()` and logs out before running, ensuring a clean guest state regardless of previous test runs (`appium:noReset: true` preserves session data between suites).

---

## **E2E Suite 1: Anonymous Home Page Discovery (Content Playlists & Browse)**
**Covers:** TC_01, TC_04  
**Flow:** Home Page Display → Explore Page Display  
**Status:** NA / PASS

### Test Scenario:
Anonymous user discovers available content across Home and Explore pages without authentication.

### Combined Test Steps:

**Part A: Home Page Playlist Verification (TC_01)**
1. Access application without logging in
2. Verify Home page loads successfully
3. Locate "Content playlists" section on Home page
4. Inspect visible playlist cards
5. Verify each playlist card displays:
   - Content title
   - Thumbnail/image
   - Metadata (duration, content type, etc.)
   - Status/availability indicator

**Part B: Explore Page Content Display (TC_04)**

6. Navigate to Explore tab
7. Verify Explore page loads successfully
8. Inspect available content cards
9. Verify content cards display correctly:
   - Content title
   - Thumbnail/image
   - Metadata (category, type, duration)
   - Interaction elements (enabled, clickable)
10. Compare content quality between Home playlists and Explore listings
11. Verify no login prompt appears on either page

### Expected Results:
- Content playlists visible on Home page ✓
- Explore page displays all available content ✓
- All cards render with complete information ✓
- No authentication required to view content ✓

### Manual Checks:
- Visual design consistency between pages
- Proper image loading and rendering
- Responsive layout on different screen sizes

---

## **E2E Suite 2: Multi-Format Content Consumption from Explore (PDF + ECML + General)**
**Covers:** TC_02, TC_03, TC_05  
**Flow:** Explore → Filter by Content Type → Open Player → Consume Content  
**Status:** Partially NA (depends on content availability)

### Test Scenario:
Anonymous user filters and consumes multiple content formats from Explore page without logging in.

### Combined Test Steps:

**Scope:** 3 content types only — PDF, ECML, Video (no H5P, EPUB, YouTube, HTML)

**Part A: PDF Content Consumption (TC_02)**
1. Access Explore page as anonymous user
2. Click Filter option, select "PDF" content type
3. Tap on first PDF card, tap Play
4. PDF navigation reads actual page count from "/" indicator, clicks next-arrow exactly that many times
5. Wait for "You just completed" screen, exit
6. Assert no login prompt appeared

**Part B: ECML Content Consumption (TC_03)**
7. Apply "Interactive" filter, find ECML card
8. Navigate via coordinate taps (95.7%×52.7%) up to 15×, click Submit if present
9. Wait for completion, exit

**Part C: Video Content Consumption (TC_05)**
10. Apply "Video" filter, find video card
11. Play and wait for completion (no fast-forward navigation)
12. Exit (no login prompt assertion)

### Expected Results:
- All 3 format players work without login ✓
- PDF: reads actual page count for precise navigation ✓
- ECML: coordinate-tap progression to end ✓
- Video: passive playback completion ✓
- No login prompt at any step ✓ (asserted in Part A only)

### Data-Driven Approach:
- Test multiple PDF files if available
- Test different ECML interactions
- Test various content formats as fallback

---

## **E2E Suite 3: Content Details Page - Discovery to Consumption**
**Covers:** TC_09, TC_07, TC_08, T~~C_06 (06-pending)~~
**Flow:** Explore → Course Details → Login Redirect → Profile Verification → Content Playlist
**Status:** NA

### Test Scenario:
Anonymous user explores course details, verifies login redirect, checks profile for My Learning absence, and browses collection content.

### Test Execution Order:
**Part A → Part C → Part B** (as written in file)

### Combined Test Steps:

**Part A: Course Details → Login Redirect (TC_09)**
1. Ensure anonymous, verify state, navigate to Explore
2. Check "Courses" checkbox in filter (without explicitly clicking Collections tab)
3. Click the first course card found
4. Verify "Course Overview" heading and "Let's Get Started" button (enabled)
5. Click "Let's Get Started"
6. Assert redirect to Sign In page: email field, password field, "Welcome to Sunbird!" heading present
7. Navigate back

**Part C: Profile My Learning Absence (TC_08)**
8. Tap Profile tab
9. Verify "Guest" label and "Sign in to access your learning journey" text
10. Count all "My Learning" buttons — expects exactly 1 (only bottom nav tab, no duplicate in profile content area)

**Part B: Content Playlist (TC_07)**
11. Tap Explore, check "Content Playlist" filter
12. Find playlist cards (tagged "Content Playlist"), click first card
13. Verify Collection Details page: "Collection Overview", Units, Lessons, "Best Suited For", "Collection Curriculum"
14. Iterate over all curriculum items: click → verify player loads → Back → re-enter collection
15. No actual content consumption/playback — only verifies player screen appears

### Expected Results:
- "Let's Get Started" redirects to Sign In page ✓
- Profile page shows Guest state with no content-area "My Learning" button ✓
- Collection details renders all metadata ✓
- Each curriculum item opens a player ✓
- Recovery: if Back lands on Explore, re-taps playlist card automatically ✓

---

## **E2E Suite 4: Complete Anonymous Content Journey (Browse → Filter → Select → Consume → Return)**
**Covers:** TC_01, TC_02, TC_03, TC_04, TC_05, ~~TC_06~~, TC_07, TC_08 (Integration Test)  
**Flow:** Complete user journey for anonymous content discovery and consumption  
**Status:** Comprehensive Integration Test

### Test Scenario:
Full realistic flow of anonymous user exploring, discovering, and consuming various content types.

### Combined Test Steps:

**Phase 1: Discovery (TC_01, TC_04)**
1. Access application without login
2. Navigate to Home page
3. Review content playlists displayed
4. Navigate to Explore page
5. Review all available content cards
6. Verify content variety (multiple types, categories)

**Phase 2: Exploration (TC_02, TC_03, TC_05)**
7. Test content filters on Explore page
8. Apply PDF filter → view PDF content → select one
9. Open PDF and consume it
10. Return to Explore
11. Apply ECML filter → view ECML content → select one
12. Open ECML and complete it
13. Return to Explore
14. Clear filters and select any general content item
15. Consume the general content
16. Return to Explore

**Phase 3: Details Page Journey (TC_06, TC_07, TC_08)**
17. Navigate to My Learning section
18. Select any course from available courses
19. Open course Details page
20. Review course information
21. Click "Join Course"
22. Verify player launches
23. Select and consume course content
24. Verify multiple content types work from details page
25. Try PDF/ECML specific content if available
26. Complete consumption of multiple items
27. Return to Details page and verify state

**Phase 4: Verification & Return**
28. Navigate back to Explore
29. Verify previously viewed content is still accessible
30. Verify no login prompt appeared during entire journey
31. Verify no account creation was required
32. Verify all content remained accessible and playable

### Expected Results:
- Complete flow works without authentication ✓
- All content types accessible from Home ✓
- All filters work correctly ✓
- All content formats consumable ✓
- Details page fully functional ✓
- No progress tracking or account requirements ✓
- Consistent experience across all pages ✓

### Execution Time:
- ~15-20 minutes depending on content length
- Can be run end-to-end as final validation

---

## Summary: Script Reduction

### Original Test Cases: **8 individual scripts**

### Consolidated E2E Suites: **4 comprehensive scripts**

| E2E Suite | Test Cases Covered | Reduction |
|-----------|-------------------|-----------|
| Suite 1: Home & Explore Discovery | TC_01, TC_04 | 2 → 1 |
| Suite 2: Multi-Format Consumption | TC_02, TC_03, TC_05 | 3 → 1 |
| Suite 3: Details Page Journey | TC_09, TC_07, TC_08 | 3 → 1 |
~~| Suite 4: Complete Integration | TC_01-TC_08 (All) | 8 → 1~~ |

---

## Implementation Strategy

### Execution Options:

**Option 1: Modular Execution (Recommended)**
- Run Suite 1, 2, 3 independently
- Use different test data/content for each
- Parallel execution possible
- ~30-45 minutes total

**Option 2: Full Integration (Most Realistic)**
- Run Suite 4 as single comprehensive test
- Tests actual user behavior patterns
- Catches cross-feature issues
- ~20 minutes

**Option 3: Hybrid**
- Run Suites 1-3 during daily builds (quick validation)
- Run Suite 4 during release validation (comprehensive)

---

## Test Data Requirements

1. **Content Availability:**
   - At least 3 PDF content items
   - At least 3 ECML content items
   - At least 3 general content items (video, HTML, etc.)
   - At least 3 courses in My Learning with mixed content

2. **User State:**
   - Anonymous/unregistered session
   - No cookies/cached auth
   - Fresh browser/app state recommended

3. **Feature Flags:**
   - Ensure anonymous access is enabled
   - Verify no login walls on Explore/Home
   - Confirm My Learning accessible to anonymous users


## Notes

- **TC_08 Duplication:** Original note indicated TC_02 & TC_03 covers TC_08 - confirmed that PDF/ECML consumption works identically whether accessed from Home/Explore (Suite 2) or Details page (Suite 3)
- **Suite 3 Part C:** Validates "My Learning" button absence by counting buttons (expects exactly 1 = bottom nav only), not by `isExisting()` which would match the bottom nav tab
- **Content Filtering:** Assumes content type filters exist on Explore page. If not available, tests should use scroll/search instead.
- **Login Requirements:** All suites should be run with anonymous/unregistered user session throughout entire flow.