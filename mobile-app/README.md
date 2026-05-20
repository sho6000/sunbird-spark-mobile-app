# E2E Test Suites - Consolidated from Individual Test Cases

## Overview
This document consolidates 29 individual test cases into **8 comprehensive E2E test suites** that reduce script count while maintaining full test coverage.



---

## **E2E Suite 1: Continue Learning Journey (Home → Resume Content)**
**Covers:** TC_01, TC_02  
**Flow:** Personalised Content - In-Progress Items  
**Status:** PASS

### Combined Test Steps:
1. Login to the application
2. Navigate to Home tab
3. Verify in-progress items are displayed in "Continue Learning" section (TC_01, TC_02)
4. Inspect the in-progress course card showing correct progress/status (TC_02)
5. Click on the in-progress course to open it (TC_01)
6. Verify user lands on the last active content (TC_01)

### Expected Results:
- Continue Learning shows correct in-progress content ✓
- Course card displays accurate progress state ✓
- Course opens at last active position ✓

---

## **E2E Suite 2: Content Discovery & Filtering**
**Covers:** TC_03, TC_04  
**Flow:** Explore Page Filters + Content Display  
**Status:** PASS / NA

### Combined Test Steps:
1. Login to the application
2. Navigate to Explore tab
3. Inspect content cards for title, metadata, and controls (TC_04)
4. Scroll through available content
5. Click on filter icon
6. Apply "Content Type" filters (TC_03)
7. Verify filtered results display correctly
8. Verify filtered content cards still render with all details (TC_04)

### Expected Results:
- Content cards display complete information ✓
- Filters successfully narrow content list ✓
- Filtered cards maintain quality display ✓

---

## **E2E Suite 3: Multi-Format Content Player Validation**
**Covers:** TC_05, TC_06, TC_07, TC_08, TC_09, TC_10, TC_11, TC_12, TC_13  
**Flow:** Content Player for all formats  
**Status:** NA (can be run for available formats)

### Combined Test Steps:
1. Login and open a course with multiple content types
2. **PDF Content (TC_05):**
   - Open PDF content
   - Navigate through pages/slides
   - Reach the end and verify completion
3. **ePub Content (TC_06):**
   - Open ePub item
   - Navigate through sections
   - Finish and verify completion
4. **Video Content - MP4 (TC_07):**
   - Open MP4 video
   - Start playback and wait until end
   - Verify completion status
5. **Video Content - webm (TC_11):**
   - Open webm video
   - Play and complete
   - Verify status update
6. **HTML.zip (TC_08):**
   - Open HTML package
   - Interact with content
   - Complete and verify status
7. **YouTube (TC_09):**
   - Open YouTube content
   - Play video to completion
   - Verify tracking
8. **H5P Interactive (TC_10):**
   - Open H5P content
   - Complete interactions
   - Verify activity completion
9. **ECML (TC_12):**
   - Open ECML content
   - Navigate and complete
   - Verify status
10. **Quml (TC_13):**
    - Open Quml item
    - Complete content
    - Verify completion recording

### Expected Results:
- All content types load without errors ✓
- Completion status updates correctly for each format ✓
- Player controls work properly for each format ✓

**Note:** This suite can be split by content type availability or run selectively based on platform support.

---

## **E2E Suite 4: Course Enrollment, Progress & Management Flow**
**Covers:** TC_14, TC_15, TC_17, TC_18  
**Flow:** Batch Selection → Content Consumption → Progress Tracking → Course Management  
**Status:** NA

### Combined Test Steps:
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

### Expected Results:
- Batch selection and enrollment successful ✓
- Course progress updates correctly after content consumption ✓
- Lesson status reflects completion state ✓
- Sync progress available for completed courses ✓
- Leave course available for active courses ✓

---

## **E2E Suite 5: Certificate Complete Flow (Preview → Download → Verify)**
**Covers:** TC_19, TC_23, TC_24, TC_28, TC_29  
**Flow:** Certificate Preview + Multiple Download Formats + Verification  
**Status:** NA / BLOCKED

### Combined Test Steps:
1. Complete a course to 100% that supports certificates
2. **Preview Certificate (TC_19):**
   - Open the completed course page
   - Locate certificate section
   - Click "Preview certificate"
   - Verify preview opens successfully
3. Navigate to Profile → My Learning
4. Locate the completed course (100%)
5. **Download Certificate as PDF (TC_23, TC_28):**
   - Click "Download Certificate"
   - Select "Download as PDF"
   - Verify PDF downloads successfully
6. **Download Certificate as PNG (TC_24):**
   - Click "Download Certificate" again
   - Select "Download as PNG"
   - Verify PNG downloads successfully
7. **Verify Certificate (TC_29):**
   - Open Profile section
   - Navigate to certificate verification
   - Verify certificate returns valid result

### Expected Results:
- Certificate preview displays correctly ✓
- PDF download successful ✓
- PNG download successful ✓
- Certificate verification succeeds ✓

**Note:** TC_28 is marked BLOCKED as TC_23 & TC_24 cover this flow.

---

## **E2E Suite 6: My Learning Dashboard Complete View**
**Covers:** TC_20, TC_21, TC_22  
**Flow:** My Learning Page with all course states  
**Status:** NA

### Combined Test Steps:
1. Login with a user having courses in multiple states
2. Navigate to My Learning page
3. **Active Courses Section (TC_20):**
   - Locate courses with < 100% completion
   - Verify they appear in "Active" section
4. **Completed Courses Section (TC_20):**
   - Locate courses with 100% completion
   - Verify they appear in "Completed" section
5. **Upcoming Batches Section (TC_21):**
   - Scroll to upcoming sections
   - Verify upcoming batch cards with correct details
6. **Verify from Profile Page (TC_22):**
   - Navigate to Profile
   - Click "My Learning" tab
   - Review all course cards and status labels
   - Verify status matches actual completion state

### Expected Results:
- Courses correctly grouped by Active/Completed/Upcoming ✓
- Upcoming batches listed with proper details ✓
- Profile page shows accurate status for all courses ✓

---

## **E2E Suite 7: User Reports Complete Flow**
**Covers:** TC_25, TC_26, TC_27  
**Flow:** User Reports (Course Progress + Assessment + Download)  
**Status:** NA (Portal feature)

### Combined Test Steps:
1. Login to the application
2. Navigate to User Reports section
3. **Course Progress Report (TC_25):**
   - Select "Course progress"
   - View the report
   - Verify expected data displays
4. **Assessment History Report (TC_26):**
   - Select "Assessment history"
   - Review entries
   - Verify correct display
5. **Download Reports (TC_27):**
   - Open course progress report
   - Click "Download"
   - Verify file generation/download
   - Open assessment history report
   - Click "Download"
   - Verify file generation/download

### Expected Results:
- Course progress report loads correctly ✓
- Assessment history displays properly ✓
- Both reports download successfully ✓

---

## **E2E Suite 8: Profile Data & Consent Management**
**Covers:** TC_16  
**Flow:** User Consent for Data Sharing  
**Status:** NA (Yet to verify)

### Test Steps:
1. Login to the application
2. Open a course with Personal Information section
3. Review consent text/prompt
4. Choose accept/reject option
5. Verify consent action displays as popup notification

### Expected Results:
- Consent prompt visible and actionable ✓
- User choice recorded and confirmed ✓

---

## Summary: Script Reduction

### Original Test Cases: **29 individual scripts**

### Consolidated E2E Suites: **8 comprehensive scripts**

| E2E Suite | Test Cases Covered | Reduction |
|-----------|-------------------|-----------|
| Suite 1: Continue Learning Journey | TC_01, TC_02 | 2 → 1 |
| Suite 2: Content Discovery | TC_03, TC_04 | 2 → 1 |
| Suite 3: Multi-Format Player | TC_05-TC_13 (9 cases) | 9 → 1 |
| Suite 4: Course Enrollment & Progress | TC_14, TC_15, TC_17, TC_18 | 4 → 1 |
| Suite 5: Certificate Flow | TC_19, TC_23, TC_24, TC_28, TC_29 | 5 → 1 |
| Suite 6: My Learning Dashboard | TC_20, TC_21, TC_22 | 3 → 1 |
| Suite 7: User Reports | TC_25, TC_26, TC_27 | 3 → 1 |
| Suite 8: Data Consent | TC_16 | 1 → 1 |

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

4. **Parallel Execution:** Suites 1-8 are independent and can run in parallel for faster execution

---

## Benefits of Consolidation

✅ **Reduced Maintenance:** 8 scripts instead of 29  
✅ **Realistic User Flows:** Tests mimic actual user behavior  
✅ **Better Coverage:** E2E flows catch integration issues  
✅ **Faster Execution:** Shared setup/teardown reduces overhead  
✅ **Easier Debugging:** Complete user journeys easier to troubleshoot