import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

let enrolledCourseName: string | null = null;
let enrolledCourseProgress: number | null = null;

const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);

async function tapExploreTab(browser: WebdriverIO.Browser): Promise<void> {
  const explore = await browser.$('//android.widget.Button[@content-desc="Explore" or @text="Explore"]');
  if (await explore.isExisting()) {
    await explore.click();
    await browser.pause(3000);
  }
}

async function applyCoursesFilter(browser: WebdriverIO.Browser): Promise<void> {
  const filtersBtn = await browser.$('//android.widget.Button[@content-desc="Filters" or @text="Filters"]');
  await filtersBtn.waitForDisplayed({ timeout: 10000 });
  await filtersBtn.click();
  await browser.pause(1500);

  const collectionsTab = await browser.$('//android.view.View[@text="Collections"]');
  if (await collectionsTab.isExisting()) {
    await collectionsTab.click();
    await browser.pause(500);
  }

  const coursesCb = await browser.$('//android.widget.CheckBox[@text="Courses"]');
  await coursesCb.waitForDisplayed({ timeout: 5000 });
  await coursesCb.click();
  await browser.pause(300);

  const closeBtn = await browser.$('//android.widget.Button[@content-desc="Close" or @text="Close"]');
  await closeBtn.waitForDisplayed({ timeout: 5000 });
  await closeBtn.click();
  await browser.pause(3000);
}

interface CourseCard {
  title: string;
  x: number;
  y: number;
}

async function findAllCourseCards(browser: WebdriverIO.Browser): Promise<CourseCard[]> {
  const buttons = await browser.$$('android.widget.Button');
  const cards: CourseCard[] = [];
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('course') && !t.includes('Download')) {
      const loc = await btn.getLocation();
      cards.push({ title: t, x: loc.x, y: loc.y });
    }
  }
  cards.sort((a, b) => a.y - b.y || a.x - b.x);
  return cards;
}

async function findJoinCourseButton(browser: WebdriverIO.Browser): Promise<boolean> {
  try {
    const btn = await browser.$('//android.widget.Button[@text="Join the Course"]');
    return await btn.isExisting();
  } catch {
    return false;
  }
}

async function hasNoBatchesMessage(browser: WebdriverIO.Browser): Promise<boolean> {
  try {
    const el = await browser.$('//*[contains(@text, "No batches available")]');
    return await el.isExisting();
  } catch {
    return false;
  }
}

async function hasProgressDisplay(browser: WebdriverIO.Browser): Promise<string | null> {
  try {
    const el = await browser.$('//android.widget.TextView[starts-with(@text, "Completed:")]');
    if (await el.isExisting()) {
      return await el.getText();
    }
  } catch { /* not found */ }
  return null;
}

async function scrollExplorePage(browser: WebdriverIO.Browser): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  const startX = Math.round(width * 0.5);
  const startY = Math.round(height * 0.75);
  const endY = Math.round(height * 0.25);

  await browser.performActions([{
    type: 'pointer',
    id: 'finger1',
    parameters: { pointerType: 'touch' },
    actions: [
      { type: 'pointerMove', x: startX, y: startY, duration: 0 },
      { type: 'pointerDown', button: 0 },
      { type: 'pause', duration: 100 },
      { type: 'pointerMove', x: startX, y: endY, duration: 800 },
      { type: 'pointerUp', button: 0 },
    ]
  }]);
  await browser.releaseActions();
  await browser.pause(2000);
}

// function detectContentType(contentDesc: string): string {
//   const lower = contentDesc.toLowerCase();
//   if (lower.includes('youtube') || lower.includes('yotube')) return 'youtube';
//   if (lower.includes('pdf')) return 'pdf';
//   if (lower.includes('ecml')) return 'ecml';
//   if (lower.includes('epub')) return 'epub';
//   if (lower.includes('video')) return 'video';
//   if (lower.includes('h5p')) return 'h5p';
//   if (lower.includes('html')) return 'html';
//   return 'unknown';
// }


async function detectContentType(browser: WebdriverIO.Browser, item?: WebdriverIO.Element): Promise<string> {
    // Step 1: Check item's content-desc + text for keywords
    if (item) {
        const desc = (await item.getAttribute('content-desc') || '') + ' ' + (await item.getText() || '');
        const lower = desc.toLowerCase();
        const keywords: Record<string, string[]> = {
            youtube: ['youtube', 'yotube'],
            pdf: ['pdf'],
            ecml: ['ecml'],
            epub: ['epub'],
            video: ['video'],
            h5p: ['h5p'],
            html: ['html'],
        };
        for (const [type, list] of Object.entries(keywords)) {
            if (list.some(k => lower.includes(k))) return type;
        }
    }

    // Step 2: Player UI detection (call after tapping Play)
    await browser.pause(3000);

    const pdfArrow = await browser.$('//android.widget.Button[@content-desc="navigation-arrows-nextIcon" or @text="navigation-arrows-nextIcon"]');
    const youtubeEl = await browser.$('//android.widget.Button[contains(@content-desc, "YouTube") or contains(@text, "YouTube")]');
    const ecmlSubmit = await browser.$('//android.widget.Button[@text="Submit" or @content-desc="Submit"]');

    if (await pdfArrow.isExisting()) {
        const slashTv = await browser.$('//android.widget.TextView[@text="/"]');
        return await slashTv.isExisting() ? 'pdf' : 'epub';
    }
    if (await youtubeEl.isExisting()) return 'youtube';
    if (await ecmlSubmit.isExisting()) return 'ecml';

    return 'video';
}



async function tapPlayButton(browser: WebdriverIO.Browser): Promise<void> {
  const playBtn = await browser.$('//android.widget.Button[starts-with(@content-desc, "Play ")]');
  if (await playBtn.isExisting()) {
    await playBtn.click();
    await browser.pause(3000);
    return;
  }
  const textBtn = await browser.$('//android.widget.Button[starts-with(@text, "Play ")]');
  if (await textBtn.isExisting()) {
    await textBtn.click();
    await browser.pause(3000);
    return;
  }
  const fallback = await browser.$('//android.widget.Button[contains(@content-desc, "Play") or contains(@content-desc, "Open")]');
  if (await fallback.isExisting()) {
    await fallback.click();
    await browser.pause(3000);
  }
}

async function waitForCompletion(browser: WebdriverIO.Browser): Promise<void> {
  const maxWait = 120000;
  const pollInterval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
    if (await completed.isExisting()) {
      console.log('  "You just completed" detected');
      await browser.pause(1000);

      const ratingClose = await browser.$('//android.widget.Button[@content-desc="Close" or @text="Close"]');
      if (await ratingClose.isExisting()) {
        await ratingClose.click();
        await browser.pause(1000);
        console.log('  Rating dialog closed');
      }

      const exitCheck = await browser.$('//*[@text="Exit"]');
      if (await exitCheck.isExisting()) {
        console.log('  Completed screen with Exit button confirmed');
      }
      return;
    }
    console.log('  Waiting for content completion...');
    await browser.pause(pollInterval);
  }

  console.warn('  Content completion not detected within timeout, proceeding');
}



async function navigatePdfToLastPage(browser: WebdriverIO.Browser): Promise<void> {
  console.log('  PDF viewer loaded, navigating to last page...');
  await browser.pause(3000);

  // extract the total pages comes after slash (/) in the page indicator, if available
  // let totalPages = 2;

  for (let i = 0; i < 100; i++) {
    const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
    if (await completed.isExisting()) {
      console.log('  Completion screen reached');
      return;
    }

    const nextArrow = await browser.$(
      '//android.widget.Button[@content-desc="navigation-arrows-nextIcon" or @text="navigation-arrows-nextIcon"]'
    );
    if (!(await nextArrow.isExisting())) {
      console.log('  Next arrow not found');
      break;
    }

    console.log(`  Next arrow click (${i + 1}/100)...`);
    await nextArrow.click();
    await browser.pause(200);
  }

  console.log('  Waiting for completion after last page...');
  await browser.pause(5000);
}




async function navigateEpubToLastPage(browser: WebdriverIO.Browser): Promise<void> {
  console.log('  EPUB viewer loaded, navigating to last page...');
  await browser.pause(3000);

  for (let i = 0; i < 20; i++) {
    const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
    if (await completed.isExisting()) {
      console.log('  Completion screen reached');
      return;
    }

    const nextArrow = await browser.$('//android.widget.Button[@content-desc="navigation-arrows-nextIcon" or @text="navigation-arrows-nextIcon"]');
    if (!(await nextArrow.isExisting())) {
      console.log('  Next arrow not found, stopping');
      break;
    }

    console.log(`  Next arrow click (${i + 1})...`);
    await nextArrow.click();
    await browser.pause(2000);
  }

  console.log('  Waiting for completion after navigation...');
  await browser.pause(5000);
}

async function navigateEcmlToLastPage(browser: WebdriverIO.Browser): Promise<void> {
  console.log('  ECML content loaded, navigating via Appium tap...');
  await browser.pause(3000);

  const { width, height } = await browser.getWindowSize();
  const tapX = Math.round(width * 0.957);
  const tapY = Math.round(height * 0.527);

  for (let i = 0; i < 15; i++) {
    const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
    if (await completed.isExisting()) {
      console.log('  Completion screen reached');
      return;
    }

    console.log(`  Appium tap next (${i + 1}) at (${tapX}, ${tapY})...`);
    const action = browser.action('pointer');
    action.move({ x: tapX, y: tapY, origin: 'viewport' });
    action.down();
    action.pause(100);
    action.up();
    await action.perform();
    await browser.pause(3000);
  }

  console.log('  Waiting for completion after navigation...');
  await browser.pause(5000);
}

async function navigateYoutubeToLastPage(browser: WebdriverIO.Browser): Promise<void> {
  console.log('  YouTube player loaded, fast-forwarding via double-taps...');
  await browser.pause(3000);

  const { width, height } = await browser.getWindowSize();
  const tapX = Math.round(width * 0.75);
  const tapY = Math.round(height * 0.5);

  const MAX_TAPS = 500;
  let completed = false;

  async function doubleTap(): Promise<void> {
    const action = browser.action('pointer');
    action.move({ x: tapX, y: tapY, origin: 'viewport' });
    action.down();
    action.pause(5);
    action.up();
    action.pause(20);
    action.down();
    action.pause(5);
    action.up();
    await action.perform();
    await browser.pause(0);
  }

  async function isCompleted(): Promise<boolean> {
    const screen = await browser.$('//android.widget.TextView[@text="You just completed"]');
    return await screen.isExisting();
  }

  for (let i = 1; i <= MAX_TAPS; i++) {
    if (i % 30 === 0 && await isCompleted()) {
      console.log(`  Completion detected after ${i} double-taps (~${i * 10}s skipped)`);
      completed = true;
      break;
    }
    await doubleTap();
    if (i % 20 === 0 || i === MAX_TAPS) {
      console.log(`  ${i} taps done (~${i * 10}s skipped so far)...`);
    }
  }

  if (!completed) {
    console.warn(`  Not completed after ${MAX_TAPS} taps — video may be very long`);
  }

  await browser.pause(2000);
}

async function pressBack(browser: WebdriverIO.Browser): Promise<void> {
  const backBtn = await browser.$('//android.widget.Button[@content-desc="Back" or @text="Back"]');
  if (await backBtn.isExisting()) {
    await backBtn.click();
  } else {
    await browser.back();
  }
  await browser.pause(3000);
}

describe('E2E Suite 4: Enrollment Progress Verification', () => {
  before(async () => {
    if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
      throw new Error('Missing credentials in .env file');
    }
    await login(browser, testCredentials.email, testCredentials.password);
    const isLoggedIn = await verifyLogin(browser, testCredentials.username);
    if (!isLoggedIn) {
      throw new Error(`Login verification failed for "${testCredentials.username}"`);
    }
  });

  it('should find an unenrolled course and verify 0% after enrollment', async () => {
    console.log('\n=== Enrollment Flow ===');

    await tapExploreTab(browser);
    await applyCoursesFilter(browser);

    const triedTitles = new Set<string>();
    const maxScrolls = 5;

    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      const allCards = await findAllCourseCards(browser);
      const untried = allCards.filter(c => !triedTitles.has(c.title));

      if (untried.length === 0) {
        console.log('  No new courses — reached bottom');
        break;
      }

      untried.forEach(c => triedTitles.add(c.title));
      console.log(`\n  --- Scroll ${scroll + 1}: ${untried.length} untried course(s) ---`);

      for (const courseCard of untried) {
        console.log(`\n  Trying: "${courseCard.title.substring(0, 60)}..."`);

        const btn = await browser.$(`//android.widget.Button[@text="${courseCard.title}"]`);
        if (!(await btn.isDisplayed())) {
          console.log('  Card not visible — trying next');
          continue;
        }

        const { width, height } = await browser.getWindowSize();
        const loc = await btn.getLocation();
        const size = await btn.getSize();
        const navTop = Math.round(height * 0.85);

        if (loc.y + size.height >= navTop) {
          console.log('  Card hidden behind bottom nav — scrolling up slightly...');
          await browser.action('pointer')
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.5) })
            .down()
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.3), duration: 300 })
            .up()
            .perform();
          await browser.pause(1000);
        }

        await btn.click();
        await browser.pause(3000);

        if (await findJoinCourseButton(browser)) {
          console.log('  ✓ Found "Join the Course" — enrolling now');

          const joinBtn = await browser.$('//android.widget.Button[@text="Join the Course"]');
          await joinBtn.click();
          await browser.pause(2000);

          const noBatchesInDialog = await hasNoBatchesMessage(browser);
          if (noBatchesInDialog) {
            console.log('  ✗ No batches available in dialog — skipping');
            await browser.back();
            await browser.pause(1000);
            await browser.back();
            await browser.pause(2000);
            continue;
          }

          const batchDropdown = await browser.$('//android.view.View[@text="Select a Batch"]');
          await batchDropdown.waitForDisplayed({ timeout: 5000 });
          await batchDropdown.click();
          await browser.pause(1500);

          const batchOption = await browser.$('//android.widget.CheckedTextView[@clickable="true" and @enabled="true"]');
          if (!(await batchOption.isExisting())) {
            throw new Error('No selectable batch found in the dialog');
          }
          const batchName = await batchOption.getText();
          console.log(`  Selecting batch: "${batchName}"`);
          await batchOption.click();
          await browser.pause(1500);

          const joinBatchBtn = await browser.$('//android.widget.Button[@text="Join The Batch"]');
          await joinBatchBtn.waitForDisplayed({ timeout: 5000 });
          await joinBatchBtn.click();
          await browser.pause(3000);

          const pct = await hasProgressDisplay(browser);
          if (!pct) {
            throw new Error('Enrolled but no progress text appeared');
          }
          console.log(`  ✓ Enrollment verified — ${pct}`);

          if (pct !== 'Completed: 0%') {
            console.log(`  Already has progress (${pct}) — skipping, need 0%`);
            await browser.back();
            await browser.pause(2000);
            continue;
          }

          expect(pct).toBe('Completed: 0%');
          enrolledCourseName = courseCard.title;
          return;
        }

        const noBatches = await hasNoBatchesMessage(browser);
        if (noBatches) {
          console.log('  ✗ No batches available — skipping');
          await browser.back();
          await browser.pause(2000);
          continue;
        }

        const pct = await hasProgressDisplay(browser);
        if (pct) {
          console.log(`  Already enrolled — ${pct} — skipping`);
          await browser.back();
          await browser.pause(2000);
          continue;
        }

        console.log('  Unknown state — skipping');
        await browser.back();
        await browser.pause(2000);
      }

      if (scroll < maxScrolls - 1) {
        console.log('  Scrolling for more courses...');
        await scrollExplorePage(browser);
      }
    }

    throw new Error('No unenrolled course with available batches found');
  });

  it('should consume a content item and verify progress increases', async () => {
    if (!enrolledCourseName) {
      throw new Error('enrolledCourseName not set — it#1 did not complete successfully');
    }
    console.log('\n=== Content Consumption Flow ===');

    const initialPct = await hasProgressDisplay(browser);
    expect(initialPct).toBe('Completed: 0%');
    console.log(`  Initial progress: ${initialPct}`);

    console.log(`  Course: "${enrolledCourseName}"`);

    // Scroll unit header near top of viewport, then expand accordion
    const { height, width } = await browser.getWindowSize();
    const centerX = Math.floor(width / 2);
    const unit1Header = await browser.$('//android.view.View[@text="Course Curriculum"]//android.widget.Button[1]');
    await unit1Header.waitForDisplayed({ timeout: 5000 });
    for (let s = 0; s < 8; s++) {
      const loc = await unit1Header.getLocation();
      if (loc.y < 500) break;
      await browser.action('pointer')
        .move({ x: centerX, y: Math.floor(height * 0.7) })
        .down()
        .move({ x: centerX, y: Math.floor(height * 0.3), duration: 800 })
        .up()
        .perform();
      await browser.pause(1000);
    }
    const contentCheck = await browser.$('//android.view.View[@text="Course Curriculum"]/android.view.View/android.view.View[2]');
    if (!await contentCheck.isExisting()) {
      await unit1Header.click();
      await browser.pause(1000);
      await contentCheck.waitForDisplayed({ timeout: 5000 });
    }

    // Find and consume the first content item inside the unit
    const contentItems = await browser.$$('//android.view.View[@text="Course Curriculum"]/android.view.View/android.view.View[2]/android.widget.Button');
    if (contentItems.length === 0) {
      throw new Error('No content item found in the expanded unit');
    }
    const contentDesc = await contentItems[0].getAttribute('content-desc');
    console.log(`  Opening: "${contentDesc}"`);

    // Step 1: Detect from item attributes
    let contentType = await detectContentType(browser, contentItems[0]);
    console.log(`  Detected type from item: ${contentType}`);

    await contentItems[0].click();
    await browser.pause(3000);

    // Type-specific consumption
    await tapPlayButton(browser);

    // Step 2: If still video/unknown, redetect from player UI
    if (contentType === 'video') {
        const playerType = await detectContentType(browser);
        if (playerType !== 'video') {
            console.log(`  Re-detected from player: ${playerType}`);
            contentType = playerType;
        }
    }

    console.log(`  Final type: ${contentType}`);

    switch (contentType) {
      case 'pdf':
        await navigatePdfToLastPage(browser);
        break;
      case 'epub':
        await navigateEpubToLastPage(browser);
        break;
      case 'ecml':
        await navigateEcmlToLastPage(browser);
        break;
      case 'youtube':
        await navigateYoutubeToLastPage(browser);
        break;
      case 'html':
        console.log('  HTML content opened, waiting 2s...');
        await browser.pause(2000);
        await pressBack(browser);
        break;
      case 'video':
        console.log('  Attempting double-tap fast-forward (may be YouTube)...');
        await navigateYoutubeToLastPage(browser);
        break;
      default:
        console.log(`  Unhandled type (${contentType}) — just waiting`);
        break;
    }
    await waitForCompletion(browser);

    // Navigate back from player
    await pressBack(browser);

    // Check if we're back on course detail page
    let newPct = await hasProgressDisplay(browser);
    if (!newPct) {
      console.log('  Navigated too far — re-entering course from Explore');
      const courseCard = await browser.$(`//android.widget.Button[contains(@text, "${enrolledCourseName}")]`);
      if (await courseCard.isExisting()) {
        await courseCard.click();
        await browser.pause(5000);
      }
      newPct = await hasProgressDisplay(browser);
    }

    if (!newPct) {
      throw new Error('Could not re-find progress display after consumption');
    }

    const initialMatch = initialPct.match(/(\d+)/);
    const newMatch = newPct.match(/(\d+)/);
    expect(initialMatch).toBeTruthy();
    expect(newMatch).toBeTruthy();

    const initialVal = parseInt(initialMatch![1], 10);
    const newVal = parseInt(newMatch![1], 10);

    enrolledCourseProgress = newVal;

    expect(newVal).toBeGreaterThan(initialVal);
    console.log(`  ✓ Progress increased: ${initialVal}% → ${newVal}%`);
  });

  it('should leave the course and verify unenrollment', async () => {
    if (!enrolledCourseName) {
      throw new Error('enrolledCourseName not set — it#1 did not complete successfully');
    }


    if (enrolledCourseProgress !== null && enrolledCourseProgress >= 100) {
      console.log('Course at 100% — "Leave Course" hidden for completed courses, skipping');
      return;
    }


    console.log('\n=== Leave Course Flow ===');

    const moreOpts = await browser.$('//android.widget.Button[@text="More options" or @content-desc="More options"]');
    await moreOpts.waitForDisplayed({ timeout: 5000 });
    await moreOpts.click();
    await browser.pause(1500);

    const leaveBtn = await browser.$('//android.widget.Button[@text="Leave Course"]');
    await leaveBtn.waitForDisplayed({ timeout: 5000 });
    await leaveBtn.click();
    await browser.pause(1500);

    const confirmLeave = await browser.$('//android.widget.Button[@text="Leave"]');
    await confirmLeave.waitForDisplayed({ timeout: 5000 });
    await confirmLeave.click();
    await browser.pause(2000);

    const pct = await hasProgressDisplay(browser);
    expect(pct).toBeNull();
    console.log('  ✓ Progress text disappeared — left successfully');

    const joinBtn = await browser.$('//android.widget.Button[@text="Join the Course"]');
    await joinBtn.waitForDisplayed({ timeout: 5000 });
    console.log('  ✓ "Join the Course" is visible — unenrolled');
  });

  after(async () => {
    await browser.saveScreenshot('../reports/android/test-results/suite4-course-enrollment-and-progress.png');
  });
});