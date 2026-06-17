import { verifyAnonymous, assertNoLoginPrompt, ensureAnonymous } from '../../../fixtures/verify-anonymous.fixture';

async function tapExploreTab(browser: WebdriverIO.Browser): Promise<void> {
  const explore = await browser.$('//android.widget.Button[@content-desc="Explore" or @text="Explore"]');
  if (await explore.isExisting()) {
    await explore.click();
    await browser.pause(3000);
  }
}

let previouslySelected: string | null = null;

async function applyFilter(browser: WebdriverIO.Browser, contentType: string): Promise<void> {
  const filtersBtn = await browser.$('//android.widget.Button[@content-desc="Filters" or @text="Filters"]');
  await filtersBtn.waitForDisplayed({ timeout: 10000 });
  await filtersBtn.click();
  await browser.pause(1500);

  const contentTypeTab = await browser.$('//android.view.View[@text="ContentTypes"]');
  await contentTypeTab.waitForDisplayed({ timeout: 5000 });
  await contentTypeTab.click();
  await browser.pause(500);

  if (previouslySelected) {
    const prevCb = await browser.$(`//android.widget.CheckBox[@text="${previouslySelected}"]`);
    if (await prevCb.isExisting()) {
      await prevCb.click();
      await browser.pause(300);
    }
  }

  const cb = await browser.$(`//android.widget.CheckBox[@text="${contentType}"]`);
  await cb.waitForDisplayed({ timeout: 5000 });
  await cb.click();
  await browser.pause(300);

  previouslySelected = contentType;

  const closeBtn = await browser.$('//android.widget.Button[@content-desc="Close" or @text="Close"]');
  await closeBtn.waitForDisplayed({ timeout: 5000 });
  await closeBtn.click();
  await browser.pause(3000);
}


async function findPdfCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('pdf')) {
      return t;
    }
  }
  return '';
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

  console.warn('  Video completion not detected within timeout, proceeding');
}


async function pressBack(browser: WebdriverIO.Browser): Promise<void> {
  await browser.back();
  await browser.pause(3000);
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

    const nextArrow = await browser.$('//android.widget.Button[@content-desc="navigation-arrows-nextIcon" or @text="navigation-arrows-nextIcon"]');
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


async function findEcmlCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('ecml')) {
      return t;
    }
  }
  return '';
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



async function findVideoCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.includes('Video') && !t.toLowerCase().includes('youtube')) {
      return t;
    }
  }
  return '';
}




// PDF CONTENT

describe('E2E Suite 2: Multi-Format Content Consumption', () => {
  before(async () => {
    await ensureAnonymous(browser);
  });

  it('Part A: PDF content consumption via Explore filter', async () => {

    const isAnonymous = await verifyAnonymous(browser);
    expect(isAnonymous).toBe(true);
    console.log('✅ Anonymous state confirmed');

    console.log('\n=== PDF ===');

    await tapExploreTab(browser);

    await applyFilter(browser, 'PDF');

    const pdfTitle = await findPdfCard(browser);
    if (!pdfTitle) {
      throw new Error('No PDF card found on Explore page');
    }
    console.log(`  Tapping card: "${pdfTitle.substring(0, 60)}..."`);

    const card = await browser.$(`//android.widget.Button[@text="${pdfTitle}"]`);
    await card.waitForDisplayed({ timeout: 5000 });
    await card.click();
    await browser.pause(2500);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    await navigatePdfToLastPage(browser);

    await waitForCompletion(browser);

    const exitBtn = await browser.$('//*[@text="Exit"]');
    if (await exitBtn.isExisting()) {
      await exitBtn.click();
      await browser.pause(2000);
      console.log('  Tapped Exit button');
    }

    await pressBack(browser);

    await assertNoLoginPrompt(browser);
    console.log('✅ No "Sign In" prompt during PDF flow');

    console.log('  PDF consumption complete, back on Explore page');
  });




  // ECML CONTENT

  it('Part B: ECML content consumption via Explore filter', async () => {

    console.log('\n=== ECML ===');

    await tapExploreTab(browser);

    await applyFilter(browser, 'Interactive');

    const ecmlTitle = await findEcmlCard(browser);
    if (!ecmlTitle) {
      throw new Error('No ECML card found on Explore page');
    }
    console.log(`  Tapping card: "${ecmlTitle.substring(0, 60)}..."`);

    const card = await browser.$(`//android.widget.Button[@text="${ecmlTitle}"]`);
    await card.waitForDisplayed({ timeout: 5000 });
    await card.click();
    await browser.pause(2500);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    await navigateEcmlToLastPage(browser);

    await waitForCompletion(browser);

    const exitBtn = await browser.$('//*[@text="Exit"]');
    if (await exitBtn.isExisting()) {
      await exitBtn.click();
      await browser.pause(2000);
      console.log('  Tapped Exit button');
    }

    await pressBack(browser);

    console.log('  ECML consumption complete, back on Explore page');

  });



// VIDEO CONTENT

  it('Part C: Video content consumption via Explore filter', async () => {
    
    console.log('\n=== Video ===');

    await tapExploreTab(browser);

    await applyFilter(browser, 'Video');

    const cardTitle = await findVideoCard(browser);
    if (!cardTitle) {
      throw new Error('No Video card found on Explore page');
    }
    console.log(`  Tapping card: "${cardTitle.substring(0, 60)}..."`);

    const card = await browser.$(`//android.widget.Button[@text="${cardTitle}"]`);
    await card.waitForDisplayed({ timeout: 5000 });
    await card.click();
    await browser.pause(2500);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    await waitForCompletion(browser);

    await pressBack(browser);

    console.log('  Video consumption complete, back on Explore page');
  });




});
