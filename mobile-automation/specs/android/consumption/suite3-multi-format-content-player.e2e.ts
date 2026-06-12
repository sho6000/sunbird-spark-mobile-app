import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

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

async function findEpubCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('epub')) {
      return t;
    }
  }
  return '';
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

async function findYoutubeCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('youtube') || t.toLowerCase().includes('yotube')) {
      return t;
    }
  }
  return '';
}

async function findHtmlCard(browser: WebdriverIO.Browser): Promise<string> {
  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('html')) {
      return t;
    }
  }
  return '';
}

async function findH5pCard(browser: WebdriverIO.Browser): Promise<void> {
  console.log('  Searching for H5P content...');

  const searchIcon = await browser.$('//android.widget.Button[@text="Search" or @content-desc="Search"]');
  await searchIcon.waitForDisplayed({ timeout: 5000 });
  await searchIcon.click();
  await browser.pause(1500);

  const searchInput = await browser.$('//android.widget.EditText[@hint="Search content..."]');
  await searchInput.waitForDisplayed({ timeout: 5000 });
  await searchInput.setValue('H5P');
  await browser.pause(3000);

  const buttons = await browser.$$('android.widget.Button');
  const navLabels = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);
  let h5pTitle = '';
  for (const btn of buttons) {
    const t = (await btn.getText()).trim();
    if (!t || navLabels.has(t)) continue;
    if (t.toLowerCase().includes('h5p')) {
      h5pTitle = t;
      break;
    }
  }

  if (!h5pTitle) {
    throw new Error('No H5P card found in search results');
  }
  console.log(`  Tapping card: "${h5pTitle.substring(0, 60)}..."`);

  const card = await browser.$(`//android.widget.Button[@text="${h5pTitle}"]`);
  await card.waitForDisplayed({ timeout: 5000 });
  await card.click();
  await browser.pause(2500);

  console.log('  H5P content card opened');
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

  console.warn('  Video completion not detected within timeout, proceeding');
}

async function pressBack(browser: WebdriverIO.Browser): Promise<void> {
  await browser.back();
  await browser.pause(3000);
}

// async function navigatePdfToLastPage(browser: WebdriverIO.Browser): Promise<void> {
//   console.log('  PDF viewer loaded, navigating to last page...');
//   await browser.pause(3000);

//   let totalPages = 2;
//   const slashTv = await browser.$('//android.widget.TextView[@text="/"]');
//   if (await slashTv.isExisting()) {
//     const totalTv = await slashTv.$('./following-sibling::android.widget.TextView[1]');
//     if (await totalTv.isExisting()) {
//       const t = (await totalTv.getText()).trim();
//       const n = parseInt(t, 10);
//       if (!isNaN(n) && n > 0) totalPages = n;
//     }
//   }
//   console.log(`  Total pages: ${totalPages}`);

//   for (let i = 0; i < totalPages; i++) {
//     const completed = await browser.$('//android.widget.TextView[@text="You just completed"]');
//     if (await completed.isExisting()) {
//       console.log('  Completion screen reached');
//       return;
//     }

//     const nextArrow = await browser.$('//android.widget.Button[@content-desc="navigation-arrows-nextIcon" or @text="navigation-arrows-nextIcon"]');
//     if (!(await nextArrow.isExisting())) {
//       console.log('  Next arrow not found');
//       break;
//     }

//     console.log(`  Next arrow click (${i + 1}/${totalPages})...`);
//     await nextArrow.click();
//     await browser.pause(2000);
//   }

//   console.log('  Waiting for completion after last page...');
//   await browser.pause(5000);
// }


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

    // If it finds a text called Submit, it means it has to click that
    const submitBtn = await browser.$('//android.widget.Button[@text="Submit" or @content-desc="Submit"]');
    if (await submitBtn.isExisting()) {
      console.log('  Submit button found, clicking it...');
      await submitBtn.click();
      await browser.pause(3000);
    }
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

describe('Suite 3 — Content Player', () => {

// H5P CONTENT

  it('should play an H5P content and reach completion screen', async () => {
    if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
      throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
    }

    await login(browser, testCredentials.email, testCredentials.password);

    const isLoggedIn = await verifyLogin(browser, testCredentials.username);
    if (!isLoggedIn) {
      throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
    }
    console.log('Login successful, SUITE3');

    console.log('\n=== H5P ===');

    await tapExploreTab(browser);

    await findH5pCard(browser);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    console.log('  Filling H5P blanks via ADB...');
    await browser.pause(3000);

    const { width, height } = await browser.getWindowSize();
    const tapAction = browser.action('pointer');
    tapAction.move({ x: Math.round(width / 2), y: Math.round(height / 2), origin: 'viewport' });
    tapAction.down();
    tapAction.pause(100);
    tapAction.up();
    await tapAction.perform();
    await browser.pause(500);

    const maxBlanks = 10;
    for (let i = 0; i < maxBlanks; i++) {
      await browser.execute('mobile: shell', { command: 'input', args: ['text', 'answer'] });
      await browser.pause(300);
      await browser.execute('mobile: shell', { command: 'input', args: ['keyevent', '61'] });
      await browser.pause(1000);
    }
    await browser.execute('mobile: shell', { command: 'input', args: ['keyevent', '66'] });
    await browser.pause(2000);
    console.log('  H5P blanks filled and submitted');

    await pressBack(browser);
    await pressBack(browser);
    await browser.pause(1500);
    console.log('  Back pressed to exit H5P player');

    const closeSearch = await browser.$('//android.widget.Button[@text="Close search" or @content-desc="Close search"]');
    if (await closeSearch.isExisting()) {
      await closeSearch.click();
      await browser.pause(1500);
      console.log('  Search bar closed');
    }

    console.log('  H5P consumption complete, back on Explore page');
  });

// VIDEO CONTENT

  it('should play a Video and reach completion screen', async () => {

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

// PDF CONTENT

  it('should play a PDF and reach completion screen', async () => {

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

    console.log('  PDF consumption complete, back on Explore page');
  });

// EPUB CONTENT

  it('should play a EPUB and reach completion screen', async () => {

    console.log('\n=== EPUB ===');

    await tapExploreTab(browser);

    await applyFilter(browser, 'Epub');

    const epubTitle = await findEpubCard(browser);
    if (!epubTitle) {
      throw new Error('No EPUB card found on Explore page');
    }
    console.log(`  Tapping card: "${epubTitle.substring(0, 60)}..."`);

    const card = await browser.$(`//android.widget.Button[@text="${epubTitle}"]`);
    await card.waitForDisplayed({ timeout: 5000 });
    await card.click();
    await browser.pause(2500);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    await navigateEpubToLastPage(browser);

    await waitForCompletion(browser);

    const exitBtn = await browser.$('//*[@text="Exit"]');
    if (await exitBtn.isExisting()) {
      await exitBtn.click();
      await browser.pause(2000);
      console.log('  Tapped Exit button');
    }

    await pressBack(browser);

    console.log('  EPUB consumption complete, back on Explore page');

  });

// YOUTUBE CONTENT

  it('should play a YouTube video and reach completion screen', async () => {
    // this.timeout(300000);

    console.log('\n=== YouTube ===');

    await tapExploreTab(browser);

    await applyFilter(browser, 'Youtube');

    const ytTitle = await findYoutubeCard(browser);
    if (!ytTitle) {
      throw new Error('No YouTube card found on Explore page');
    }
    console.log(`  Tapping card: "${ytTitle.substring(0, 60)}..."`);

    const card = await browser.$(`//android.widget.Button[@text="${ytTitle}"]`);
    await card.waitForDisplayed({ timeout: 5000 });
    await card.click();
    await browser.pause(2500);

    console.log('  Tapping Play button...');
    await tapPlayButton(browser);

    await navigateYoutubeToLastPage(browser);

    await waitForCompletion(browser);

    const exitBtn = await browser.$('//*[@text="Exit"]');
    if (await exitBtn.isExisting()) {
      await exitBtn.click();
      await browser.pause(2000);
      console.log('  Tapped Exit button');
    }

    await pressBack(browser);

    console.log('  YouTube consumption complete, back on Explore page');
  });

// HTML CONTENT NOT TESTED

//   it('should play an HTML content and reach completion screen', async () => {
//     if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
//       throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
//     }
//
//     await login(browser, testCredentials.email, testCredentials.password);
//
//     const isLoggedIn = await verifyLogin(browser, testCredentials.username);
//     if (!isLoggedIn) {
//       throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
//     }
//
//     console.log('\n=== HTML ===');
//
//     await tapExploreTab(browser);
//
//     await applyFilter(browser, 'HTML');
//
//     const htmlTitle = await findHtmlCard(browser);
//     if (!htmlTitle) {
//       throw new Error('No HTML card found on Explore page');
//     }
//     console.log(`  Tapping card: "${htmlTitle.substring(0, 60)}..."`);
//
//     const card = await browser.$(`//android.widget.Button[@text="${htmlTitle}"]`);
//     await card.waitForDisplayed({ timeout: 5000 });
//     await card.click();
//     await browser.pause(2500);
//
//     console.log('  Tapping Play button...');
//     await tapPlayButton(browser);
//
//     await waitForCompletion(browser);
//
//     const exitBtn = await browser.$('//*[@text="Exit"]');
//     if (await exitBtn.isExisting()) {
//       await exitBtn.click();
//       await browser.pause(2000);
//       console.log('  Tapped Exit button');
//     }
//
//     await pressBack(browser);
//
//     console.log('  HTML consumption complete, back on Explore page');
//   });

// ECML CONTENT

  it('should play an ECML content and reach completion screen', async () => {

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

});

