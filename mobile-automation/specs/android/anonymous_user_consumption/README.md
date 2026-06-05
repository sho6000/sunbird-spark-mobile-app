# Anonymous User Consumption Test Suites

End-to-end test suites for logged out users content consumption flows in the Sunbird Spark Android app.

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

**Part A: PDF Content Consumption (TC_02)**
1. Access Explore page as anonymous user
2. Click Filter option
3. Select "PDF" content type filter
4. View filtered PDF content cards
5. Tap on any PDF content card
6. Verify PDF content player opens successfully
7. Verify PDF displays properly:
   - Pages load correctly
   - Page navigation controls present
   - Text/images render clearly
8. Navigate through 2-3 PDF pages
9. Reach end of PDF
10. Close content player and return to Explore

**Part B: ECML Content Consumption (TC_03)**
11. Click Filter option again
12. Clear previous filter and select "ECML" content type
13. View filtered ECML content cards
14. Tap on any ECML content item
15. Verify ECML content player opens
16. Interact with ECML content:
    - Complete interactions/exercises
    - Navigate through all sections
    - Verify submission or completion indicator
17. Finish ECML content
18. Return to Explore page

**Part C: General Content Consumption (TC_05)**
19. Clear all filters to show all content
20. Select a non-PDF, non-ECML content item (e.g., video, HTML, interactive)
21. Tap to open content
22. Verify player launches successfully
23. Consume content through:
    - Full playback (video)
    - Complete interaction (H5P, Quml)
    - Read/navigate (HTML, text)
24. Close content player
25. Return to Explore page

### Expected Results:
- PDF filter applies correctly ✓
- PDF content opens in appropriate player ✓
- PDF is readable and navigable ✓
- ECML filter applies correctly ✓
- ECML content launches and is interactive ✓
- General content filter and player work ✓
- No login required at any step ✓
- Content consumption works without progress tracking ✓

### Data-Driven Approach:
- Test multiple PDF files if available
- Test different ECML interactions
- Test various content formats as fallback

---

## **E2E Suite 3: Content Details Page - Discovery to Consumption**
**Covers:** TC_09, TC_07, TC_08, T~~C_06 (06-pending)~~
**Flow:** My Learning → Course Card → Details Page → Join → Player Launch → Consume  
**Status:** NA (My Learning availability for anonymous users)

### Test Scenario:
Anonymous user explores course details and consumes content from the details page without creating an account.

### Combined Test Steps:

**Setup:**
1. Access application as anonymous user
2. Navigate to "Explore" tab (or equivalent section showing available courses)
3. Verify courses are visible without login requirement

**Part A: Course player and Launch (TC_09)**

4. Click on the filter and select Collections and check "Courses"
5. Click on any course card to open the page
6. Verify Details page loads with:
   - Course title and description
   - Course metadata (Units, Lessons, Best Suited For...,  etc.)
   - Course Curriculum, Course Unit, etc...
   - "Join Course" or "Let's Get Started" button
   - Course preview/thumbnail
7. Verify "Let's Get Started" button is visible and enabled
8. Click "Let's Get Started" button
9. Verify user can join only after login 
   - validation* is done when we click on "Let's Get Started" it goes to a login page where Email ID & Password is asked.
   - thats how it should work.

**Part B: Content Playlist (TC_07)**
10. Navigate through Explore page
11. filter through Collections and select "Content Playlist"
    - Validate if its a content playlist by checking tags on each card "Content Playlist"
12. Open/play any content
13. Verify content opens without requiring login
14. Verify content controls are available by:
    - Playing individual content under the "Collection Curriculum
    - Check if individual content is able to open/play
    - Speed/Quality (if video)
    - Fullscreen (if video)
15. Consume content 
16. Close content
17. Verify no progress is being tracked (no progress bar updates)
18. Verify user can open same content again from same position (no session tracking)

**Part C: PDF/ECML from Details Page (TC_08)**
19. Return Profile page
20. Check if it contains "My Learning" button
    - If found then a logged out user can download certificate *validation failed
    - else *validation passed

### Expected Results:
- Details page loads with all course information ✓
- "Join Course" doesn't show without account creation ✓
- Content player launches on join ✓
- Content is playable without login ✓
- Multiple content types (PDF, ECML, video, etc.) work ✓
- No progress tracking visible ✓
- Content remains playable on revisit ✓

### Edge Cases to Test:
- Course with no free content (should show preview only)
- Courses with varying content formats
- Multiple join/leave scenarios

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
- **My Learning Availability:** Suite 3 assumes anonymous users can access "My Learning" section with courses. Adjust navigation if structure differs.
- **Content Filtering:** Assumes content type filters exist on Explore page. If not available, tests should use scroll/search instead.
- **Login Requirements:** All suites should be run with anonymous/unregistered user session throughout entire flow.