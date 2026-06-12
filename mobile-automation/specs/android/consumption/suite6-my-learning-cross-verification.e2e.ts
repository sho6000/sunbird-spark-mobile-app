import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

// Phase 1 bottom nav format: "<name> <name> Completed: <N>%"
function extractPhase1Course(buttonText: string): { name: string; progress: number } | null {
    const match = buttonText.match(/^(.+?)\s+\1\s+Completed:\s+(\d+)%$/);
    return match ? { name: match[1].trim(), progress: parseInt(match[2], 10) } : null;
}

async function scrollToAndTap(
  browser: WebdriverIO.Browser,
  selector: string,
  label: string,
  tap: boolean = true
): Promise<WebdriverIO.Element> {
  const { width, height } = await browser.getWindowSize();
  const swipeX = Math.round(width / 2);

  const safeTop    = Math.round(height * 0.10);
  const safeBottom = Math.round(height * 0.85);
  const maxSwipes  = 15;

  for (let i = 0; i < maxSwipes; i++) {
    const el = await browser.$(selector);

    if (await el.isExisting()) {
      const loc  = await el.getLocation();
      const size = await el.getSize();

      const elTop     = loc.y;
      const elBottom  = loc.y + size.height;
      const elCenter  = loc.y + Math.round(size.height / 2);
      const elCenterX = Math.round(loc.x + size.width / 2);

      console.log(`  "${label}" found at Y=${elTop}–${elBottom} (safe zone: ${safeTop}–${safeBottom})`);

      if (elTop >= safeTop && elBottom <= safeBottom) {
        if (tap) {
          console.log(`  "${label}" fully visible, tapping...`);
          const tapAction = browser.action('pointer');
          tapAction.move({ x: elCenterX, y: elCenter, origin: 'viewport' });
          tapAction.down();
          tapAction.pause(80);
          tapAction.up();
          await tapAction.perform();
          await browser.pause(2000);
        } else {
          console.log(`  "${label}" fully visible, returning without tap...`);
        }
        return el;
      }

      if (elBottom > safeBottom) {
        const overlap = elBottom - safeBottom + 40;
        const nudge = browser.action('pointer');
        nudge.move({ x: swipeX, y: Math.round(height * 0.6), origin: 'viewport' });
        nudge.down();
        nudge.pause(100);
        nudge.move({ x: swipeX, y: Math.round(height * 0.6) - overlap, origin: 'viewport', duration: 600 });
        nudge.up();
        await nudge.perform();
        await browser.pause(800);
        continue;
      }

      if (elTop < safeTop) {
        const overlap = safeTop - elTop + 40;
        const nudge = browser.action('pointer');
        nudge.move({ x: swipeX, y: Math.round(height * 0.4), origin: 'viewport' });
        nudge.down();
        nudge.pause(100);
        nudge.move({ x: swipeX, y: Math.round(height * 0.4) + overlap, origin: 'viewport', duration: 600 });
        nudge.up();
        await nudge.perform();
        await browser.pause(800);
        continue;
      }
    }

    console.log(`  "${label}" not found, swiping up (${i + 1}/${maxSwipes})...`);
    const swipe = browser.action('pointer');
    swipe.move({ x: swipeX, y: Math.round(height * 0.7), origin: 'viewport' });
    swipe.down();
    swipe.pause(100);
    swipe.move({ x: swipeX, y: Math.round(height * 0.3), origin: 'viewport', duration: 500 });
    swipe.up();
    await swipe.perform();
    await browser.pause(1000);
  }

  throw new Error(`"${label}" not visible in safe zone after ${maxSwipes} attempts`);
}

// Phase 2 profile filter format:
//   <status> <name> [extra] progressRingLabel <N>% <name> [suffix]
// Strategy: extract name as the common prefix of the text before
// progressRingLabel and the text after the percentage. This naturally
// discards intermediate text (e.g. "Due Date") and trailing suffixes
// (e.g. "No Certificate") without needing to know the exact keywords.
 function extractPhase2Course(buttonText: string): { status: string; name: string; progress: number } | null {
    const match = buttonText.match(/^(Ongoing|Completed|Not Started)\s+(.+?)\s+progressRingLabel\s+(\d+)%\s+(.+)$/);
    if (!match) return null;

    const status = match[1];
    const progress = parseInt(match[3], 10);
    let after = match[4].trim();

    // Remove known trailing suffixes
    for (const suffix of ['Download Certificate', 'No Certificate']) {
        if (after.endsWith(suffix)) {
            after = after.substring(0, after.length - suffix.length).trim();
            break;
        }
    }

    return after.length > 0 ? { status, name: after, progress } : null;
}

describe('E2E Suite 6: My Learning Dashboard Complete View', () => {
    it('should verify all learning states across bottom nav and profile filters', async () => {
        if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
            throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
        }

        await login(browser, testCredentials.email, testCredentials.password);

        const isLoggedIn = await verifyLogin(browser, testCredentials.username);
        if (!isLoggedIn) {
            throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
        }

        const windowSize = await browser.getWindowSize();

        // ══════════════════════════════════════════
        // PHASE 1: Bottom Nav My Learning (TC_20)
        // ══════════════════════════════════════════

        const myLearningTab = await browser.$('//android.widget.Button[@content-desc="My Learning" or @text="My Learning"]');
        await myLearningTab.waitForDisplayed({ timeout: 10000 });
        await myLearningTab.click();
        await browser.pause(3000);

        // --- Active Courses Tab ---
        const activeTab = await browser.$('//android.view.View[@text="Active Courses"]');
        await activeTab.waitForDisplayed({ timeout: 5000 });
        const activeTabSelected = await activeTab.getAttribute('selected');
        if (activeTabSelected !== 'true') {
            await activeTab.click();
            await browser.pause(2000);
        }

        const activeButtons = await browser.$$('//android.widget.Button');
        const phase1ActiveCourses: { name: string; progress: number }[] = [];

        for (const btn of activeButtons) {
            const text = await btn.getText();
            const course = extractPhase1Course(text);
            if (course) {
                phase1ActiveCourses.push(course);
                console.log(`📘 Phase 1 Active: "${course.name}" (${course.progress}%)`);
            }
        }

        console.log(`✅ Phase 1 Active tab: ${phase1ActiveCourses.length} courses found`);

        // --- Completed Courses Tab ---
        const completedTab = await browser.$('//android.view.View[@text="Completed"]');
        await completedTab.click();
        await browser.pause(2000);

        const completedButtons = await browser.$$('//android.widget.Button');
        const phase1CompletedCourses: { name: string; progress: number }[] = [];

        for (const btn of completedButtons) {
            const text = await btn.getText();
            const course = extractPhase1Course(text);
            if (course) {
                phase1CompletedCourses.push(course);
                console.log(`✅ Phase 1 Completed: "${course.name}" (${course.progress}%)`);
            }
        }

        console.log(`✅ Phase 1 Completed tab: ${phase1CompletedCourses.length} courses found`);

        // --- Upcoming Tab ---
        const upcomingTab = await browser.$('//android.view.View[@text="Upcoming"]');
        await upcomingTab.click();
        await browser.pause(2000);

        const noUpcoming = await browser.$('//*[@text="No upcoming courses yet."]');
        const hasUpcoming = !(await noUpcoming.isExisting().catch(() => false));
        console.log(`📅 Phase 1 Upcoming tab: ${hasUpcoming ? 'Has upcoming courses' : 'No upcoming courses'}`);

        // ══════════════════════════════════════════
        // PHASE 2: Profile → My Learning Filters (TC_21)
        // ══════════════════════════════════════════

        const profileTab = await browser.$('//android.widget.Button[@content-desc="Profile" or @text="Profile"]');
        await profileTab.waitForDisplayed({ timeout: 10000 });
        await profileTab.click();
        await browser.pause(2000);

        // Tap My Learning in the profile list
        await scrollToAndTap(browser,'//android.widget.Button[@content-desc="My Learning" or @text="My Learning"]','My Learning');
        await browser.pause(2000);

        // const myLearningBtn = await browser.$('//android.widget.Button[@content-desc="My Learning" or @text="My Learning"]');
        // await myLearningBtn.waitForDisplayed({ timeout: 10000 });
        // await myLearningBtn.click();
        // await browser.pause(2000);

        async function scrollDown(): Promise<void> {
            await browser.action('pointer')
                .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.65) })
                .down()
                .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.20) , duration: 800 })
                .up()
                .perform();
            await browser.pause(1000);
        }

        async function scrollUp(): Promise<void> {
            await browser.action('pointer')
                .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.40) })
                .down()
                .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.65)})
                .up()
                .perform();
            await browser.pause(1000);
        }


        async function selectFilter(filterName: string): Promise<void> {
            const filtersBtn = await browser.$('//android.widget.Button[@content-desc="Filters" or @text="Filters"]');
            await filtersBtn.waitForDisplayed({ timeout: 5000 });
            await filtersBtn.click();
            await browser.pause(1500);

            const filterOption = await browser.$(`//android.widget.Button[@text="${filterName}"]`);
            await filterOption.waitForDisplayed({ timeout: 5000 });
            await filterOption.click();
            await browser.pause(2000);
        }

        async function collectVisiblePhase2Courses(): Promise<Map<string, { status: string; name: string; progress: number }>> {
            const btns = await browser.$$('//android.widget.Button');
            const courses = new Map<string, { status: string; name: string; progress: number }>();

            for (const btn of btns) {
                const text = await btn.getText();
                const course = extractPhase2Course(text);
                if (course && !courses.has(course.name)) {
                    courses.set(course.name, course);
                }
            }
            return courses;
        }

        async function exhaustFilter(filterName: string, expectedNames: string[] = []): Promise<Map<string, { status: string; name: string; progress: number }>> {
            await selectFilter(filterName);
            await browser.pause(1000);

            // Scroll to top first (ensures we're at the beginning of the list)
            await scrollUp();
            await browser.pause(1000);

            const allCourses = new Map<string, { status: string; name: string; progress: number }>();
            let prevSize = -1;

            for (let i = 0; i < 15; i++) {
                const visible = await collectVisiblePhase2Courses();
                for (const [name, data] of visible) {
                    allCourses.set(name, data);
                }

                if (expectedNames.length > 0 && expectedNames.every(n => allCourses.has(n))) {
                    console.log(`✅ "${filterName}" — all ${expectedNames.length} expected courses found (${i + 1} scrolls)`);
                    break;
                }

                if (allCourses.size === prevSize) {
                    console.log(`✅ "${filterName}" filter exhausted at ${allCourses.size} courses (${i + 1} scrolls)`);
                    break;
                }
                prevSize = allCourses.size;
                await scrollDown();
            }

            for (const [name, data] of allCourses) {
                console.log(`  ${data.status}: "${name}" (${data.progress}%)`);
            }

            return allCourses;
        }

        console.log('\n--- Phase 2: Ongoing filter ---');
        const phase2Ongoing = await exhaustFilter('Ongoing',
            phase1ActiveCourses.filter(c => c.progress > 0).map(c => c.name));

        console.log('\n--- Phase 2: Completed filter ---');
        const phase2Completed = await exhaustFilter('Completed',
            phase1CompletedCourses.map(c => c.name));

        console.log('\n--- Phase 2: Not Started filter ---');
        const phase2NotStarted = await exhaustFilter('Not Started',
            phase1ActiveCourses.filter(c => c.progress === 0).map(c => c.name));

        // ══════════════════════════════════════════
        // PHASE 3: Cross-verification (TC_22)
        // ══════════════════════════════════════════

        console.log('\n══════════════════ CROSS-VERIFICATION RESULTS ══════════════════');

        let allActiveVerified = true;
        let allCompletedVerified = true;

        console.log('\n━━━ Active Courses (>0%) → Found in Ongoing? ━━━');
        for (const course of phase1ActiveCourses) {
            if (course.progress > 0) {
                const found = phase2Ongoing.has(course.name);
                if (!found) allActiveVerified = false;
                console.log(`  ${found ? 'YES' : 'NO '}  | "${course.name}" (${course.progress}%)`);
            }
        }

        console.log('\n━━━ Zero-Progress Courses (0%) → Found in Not Started? ━━━');
        for (const course of phase1ActiveCourses) {
            if (course.progress === 0) {
                const found = phase2NotStarted.has(course.name);
                if (!found) allActiveVerified = false;
                console.log(`  ${found ? 'YES' : 'NO '}  | "${course.name}" (${course.progress}%)`);
            }
        }

        console.log('\n━━━ Completed Courses (100%) → Found in Completed filter? ━━━');
        for (const course of phase1CompletedCourses) {
            const found = phase2Completed.has(course.name);
            if (!found) allCompletedVerified = false;
            console.log(`  ${found ? 'YES' : 'NO '}  | "${course.name}" (${course.progress}%)`);
        }

        console.log('\n══════════════════════════════════════════════');
        console.log('📊 Suite 6: My Learning Dashboard Summary');
        console.log('══════════════════════════════════════════════');
        console.log(`   Phase 1 — Active courses found:     ${phase1ActiveCourses.length}`);
        console.log(`   Phase 1 — Completed courses found:  ${phase1CompletedCourses.length}`);
        console.log(`   Phase 1 — Upcoming has content:     ${hasUpcoming ? 'Yes' : 'No'}`);
        console.log(`   Phase 2 — Ongoing filter:           ${phase2Ongoing.size} courses`);
        console.log(`   Phase 2 — Completed filter:         ${phase2Completed.size} courses`);
        console.log(`   Phase 2 — Not Started filter:       ${phase2NotStarted.size} courses`);
        console.log(`   Active cross-verify:                ${allActiveVerified ? 'PASS' : 'FAIL'}`);
        console.log(`   Completed cross-verify:             ${allCompletedVerified ? 'PASS' : 'FAIL'}`);
        console.log('══════════════════════════════════════════════');

        expect(allActiveVerified).toBe(true);
        expect(allCompletedVerified).toBe(true);
    });
});
