import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

let enrolledCourseName: string | null = null;

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

async function findAllCourseCards(browser: WebdriverIO.Browser): Promise<string[]> {
  const buttons = await browser.$$('android.widget.Button');
  const titles: string[] = [];
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('course') && !t.includes('Download')) {
      titles.push(t);
    }
  }
  return titles;
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

function detectContentType(contentDesc: string): string {
  const lower = contentDesc.toLowerCase();
  if (lower.includes('youtube') || lower.includes('yotube')) return 'youtube';
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('ecml')) return 'ecml';
  if (lower.includes('epub')) return 'epub';
  if (lower.includes('video')) return 'video';
  if (lower.includes('h5p')) return 'h5p';
  if (lower.includes('html')) return 'html';
  return 'unknown';
}

async function tapPlayButton(browser: WebdriverIO.Browser): Promise<void> {
  const playBtn = await browser.$('//android.widget.Button[starts-with(@content-desc, "Play ")]');
  if (await playBtn.isExisting()) {
    await playBtn.click();
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

      const ratingClose = await browser.$('//android.widget.Button[@content-desc="Close"]');
      if (await ratingClose.isExisting()) {
        await ratingClose.click();
        await browser.pause(1000);
        console.log('  Rating dialog closed');
      }

      const exitCheck = await browser.$('//android.widget.TextView[@text="Exit"]');
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

  let totalPages = 2;
  const slashTv = await browser.$('//android.widget.TextView[@text="/"]');
  if (await slashTv.isExisting()) {
    const totalTv = await slashTv.$('./following-sibling::android.widget.TextView[1]');
    if (await totalTv.isExisting()) {
      const t = (await totalTv.getText()).trim();
      const n = parseInt(t, 10);
      if (!isNaN(n) && n > 0) totalPages = n;
    }
  }
  console.log(`  Total pages: ${totalPages}`);

  for (let i = 0; i < totalPages; i++) {
    const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
    if (await completed.isExisting()) {
      console.log('  Completion screen reached');
      return;
    }

    const nextArrow = await browser.$('~navigation-arrows-nextIcon');
    if (!(await nextArrow.isExisting())) {
      console.log('  Next arrow not found');
      break;
    }

    console.log(`  Next arrow click (${i + 1}/${totalPages})...`);
    await nextArrow.click();
    await browser.pause(2000);
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

    const nextArrow = await browser.$('~navigation-arrows-nextIcon');
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
  console.log('  YouTube player loaded, navigating to near end...');
  await browser.pause(3000);

  const { width, height } = await browser.getWindowSize();
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);

  console.log('  Double-tapping video to pause...');
  const action = browser.action('pointer');
  action.move({ x: centerX, y: centerY, origin: 'viewport' });
  action.down();
  action.pause(100);
  action.up();
  action.pause(1200);
  action.down();
  action.pause(100);
  action.up();
  await action.perform();
  await browser.pause(1500);

  const seekBar = await browser.$('android.widget.SeekBar');
  if (!(await seekBar.isExisting())) {
    console.log('  SeekBar not found, proceeding');
    return;
  }

  const loc = await seekBar.getLocation();
  const size = await seekBar.getSize();
  const seekY = Math.round(loc.y + size.height / 2);
  const startX = Math.round(loc.x + size.width * 0.15);
  const endX = Math.round(loc.x + size.width * 0.97);

  console.log(`  Dragging SeekBar to 97% (${startX} → ${endX})...`);
  const drag = browser.action('pointer');
  drag.move({ x: startX, y: seekY, origin: 'viewport' });
  drag.down();
  drag.move({ x: endX, y: seekY, origin: 'viewport', duration: 1200 });
  drag.up();
  await drag.perform();
  await browser.pause(500);

  console.log('  Resuming playback...');
  const playBtn = await browser.$('//android.widget.Button[@content-desc="Play video"]');
  if (await playBtn.isExisting()) {
    await playBtn.click();
    await browser.pause(1000);
  }

  console.log('  Video will auto-complete in ~1 minute');
}

async function pressBack(browser: WebdriverIO.Browser): Promise<void> {
  const backBtn = await browser.$('//android.widget.Button[@content-desc="Back"]');
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
      const untried = allCards.filter(t => !triedTitles.has(t));

      if (untried.length === 0) {
        console.log('  No new courses — reached bottom');
        break;
      }

      untried.forEach(t => triedTitles.add(t));
      console.log(`\n  --- Scroll ${scroll + 1}: ${untried.length} untried course(s) ---`);

      for (const title of untried) {
        console.log(`\n  Trying: "${title.substring(0, 60)}..."`);

        const card = await browser.$(`//android.widget.Button[@text="${title}"]`);
        if (!(await card.isDisplayed())) {
          console.log('  Card not visible — trying next');
          continue;
        }
        await card.click();
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
          enrolledCourseName = title;
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
    const contentType = detectContentType(contentDesc);
    console.log(`  Detected type: ${contentType}`);
    await contentItems[0].click();
    await browser.pause(3000);

    // Type-specific consumption
    await tapPlayButton(browser);
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
      default:
        console.log(`  Non-consumable or unhandled type (${contentType}) — just waiting`);
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
    expect(newVal).toBeGreaterThan(initialVal);
    console.log(`  ✓ Progress increased: ${initialVal}% → ${newVal}%`);
  });

  it('should leave the course and verify unenrollment', async () => {
    if (!enrolledCourseName) {
      throw new Error('enrolledCourseName not set — it#1 did not complete successfully');
    }
    console.log('\n=== Leave Course Flow ===');

    const moreOpts = await browser.$('~More options');
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
    await browser.saveScreenshot('../reports/android/test-results/suite4-enrollment-progress.png');
  });
});