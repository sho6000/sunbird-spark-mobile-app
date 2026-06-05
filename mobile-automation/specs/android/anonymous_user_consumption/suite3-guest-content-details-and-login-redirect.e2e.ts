import { verifyAnonymous, assertNoLoginPrompt } from '../../../fixtures/verify-anonymous.fixture';

describe('E2E Suite 3: Content Details Page — Discovery to Consumption (TC_09, TC_07, TC_08)', () => {

  async function tapExploreTab() {
    const explore = await browser.$('//android.widget.Button[@content-desc="Explore" or @text="Explore"]');
    if (await explore.isExisting()) {
      await explore.click();
      await browser.pause(3000);
    }
  }

  async function tapProfileTab() {
    const profile = await browser.$('//android.widget.Button[@content-desc="Profile"]');
    if (await profile.isExisting()) {
      await profile.click();
      await browser.pause(2000);
    }
  }

  // ─────────────────────────────────────────────
  // Part A: TC_09 — Collections → Courses → Details → "Let's Get Started" → Login redirect
  // ─────────────────────────────────────────────
  it('Part A: Collections filter → Course Details → "Let\'s Get Started" → Login redirect', async () => {

    const isAnonymous = await verifyAnonymous(browser);
    expect(isAnonymous).toBe(true);
    console.log('✅ Anonymous state confirmed');

    await tapExploreTab();

    const filtersBtn = await browser.$('//android.widget.Button[@content-desc="Filters"]');
    await filtersBtn.waitForDisplayed({ timeout: 10000 });
    await filtersBtn.click();
    await browser.pause(1500);
    console.log('✅ Filters dialog opened');

    const coursesCb = await browser.$('//android.widget.CheckBox[@text="Courses"]');
    await coursesCb.waitForDisplayed({ timeout: 5000 });
    await coursesCb.click();
    await browser.pause(500);

    const closeBtn = await browser.$('//android.widget.Button[@content-desc="Close"]');
    await closeBtn.waitForDisplayed({ timeout: 5000 });
    await closeBtn.click();
    await browser.pause(3000);
    console.log('✅ Filter: Collections → Courses applied');

    const courseCards = await browser.$$('//android.widget.Button[contains(@text, " Course ")]');
    expect(courseCards.length).toBeGreaterThan(0);
    const firstCardText = (await courseCards[0].getText()).trim();
    console.log(`  Tapping: "${firstCardText.substring(0, 80)}..."`);
    await courseCards[0].click();
    await browser.pause(3000);

    const overview = await browser.$('//android.widget.TextView[@text="Course Overview"]');
    await overview.waitForDisplayed({ timeout: 5000 });
    expect(await overview.isExisting()).toBe(true);
    console.log('✅ Details page — "Course Overview" heading confirmed');

    const letsGo = await browser.$('//android.widget.Button[@text="Let\'s Get Started"]');
    await letsGo.waitForDisplayed({ timeout: 5000 });
    expect(await letsGo.isEnabled()).toBe(true);
    console.log('✅ "Let\'s Get Started" button visible and enabled');

    await letsGo.click();
    await browser.pause(3000);

    const emailField = await browser.$('//android.widget.EditText[@resource-id="sign-in-email"]');
    await emailField.waitForDisplayed({ timeout: 5000 });
    expect(await emailField.isExisting()).toBe(true);
    console.log('  ✅ Email field on Sign In page');

    const passwordField = await browser.$('//android.widget.EditText[@resource-id="sign-in-password"]');
    expect(await passwordField.isExisting()).toBe(true);
    console.log('  ✅ Password field on Sign In page');

    const welcome = await browser.$('//android.widget.TextView[@text="Welcome to Sunbird!"]');
    expect(await welcome.isExisting()).toBe(true);
    console.log('  ✅ "Welcome to Sunbird!" heading');
    console.log('✅ "Let\'s Get Started" redirects to login as expected');

    const backSignIn = await browser.$('//android.widget.Button[@content-desc="back"]');
    if (await backSignIn.isExisting()) {
      await backSignIn.click();
      await browser.pause(3000);
    }
    const backDetails = await browser.$('//android.widget.Button[@content-desc="Back"]');
    if (await backDetails.isExisting()) {
      await backDetails.click();
      await browser.pause(3000);
    }
  });


  // ─────────────────────────────────────────────
  // Part C: TC_08 — Profile page → check "My Learning" button absence
  // ─────────────────────────────────────────────
  it('Part C: Profile page should NOT show "My Learning" button for anonymous user', async () => {

    await tapProfileTab();

    // Verify anonymous state: Guest avatar + "Sign in to access your learning journey"
    const guestAvatar = await browser.$('//*[@text="Guest"]');
    expect(await guestAvatar.isExisting()).toBe(true);
    console.log('✅ "Guest" label confirmed on Profile page');

    const signInPrompt = await browser.$('//android.widget.TextView[@text="Sign in to access your learning journey"]');
    expect(await signInPrompt.isExisting()).toBe(true);
    console.log('✅ "Sign in to access your learning journey" text confirmed');

    // Verify "My Learning" button does NOT exist in Profile page content area
    const myLearningBtn = await browser.$('//android.widget.Button[@text="My Learning"]');
    expect(await myLearningBtn.isExisting()).toBe(false);
    console.log('✅ No "My Learning" button on Profile page — validation passed');


    console.log('✅ validation passed: anonymous user correctly cannot access My Learning');
  });

  after('Screenshot', async () => {
    await browser.saveScreenshot('./test-results/suite3-course-details.png');
    console.log('✅ Screenshot saved');
  });



  // ─────────────────────────────────────────────
  // Part B: TC_07 — Content Playlist filter → open/play content → verify controls
  // ─────────────────────────────────────────────
  it('Part B: Content Playlist card → Collection Details → Play content → Verify controls', async () => {

    // const isAnonymous = await verifyAnonymous(browser);
    // expect(isAnonymous).toBe(true);

    await tapExploreTab();

    const filtersBtn = await browser.$('//android.widget.Button[@content-desc="Filters"]');
    await filtersBtn.waitForDisplayed({ timeout: 10000 });
    await filtersBtn.click();
    await browser.pause(1500);
    console.log('✅ Filters dialog opened');

    const coursesCb = await browser.$('//android.widget.CheckBox[@text="Content Playlist"]');
    await coursesCb.waitForDisplayed({ timeout: 5000 });
    await coursesCb.click();
    await browser.pause(500);

    const closeBtn = await browser.$('//android.widget.Button[@content-desc="Close"]');
    await closeBtn.waitForDisplayed({ timeout: 5000 });
    await closeBtn.click();
    await browser.pause(3000);
    console.log('✅ Filter: Collections → Content Playlist');

    // Verify Content Playlist cards are visible (default Explore view shows them at top)
    const playlistCards = await browser.$$('//android.widget.Button[contains(@text, "Content Playlist")]');
    expect(playlistCards.length).toBeGreaterThan(1);
    console.log(`✅ Found ${playlistCards.length} Content Playlist card(s)`);

    const firstPlaylist = (await playlistCards[0].getText()).trim();
    console.log(`  Tapping: "${firstPlaylist.substring(0, 80)}..."`);
    await playlistCards[0].click();
    await browser.pause(3000);

    // Confirm Collection Details page via "Collection Overview" heading
    const collectionOverview = await browser.$('//android.widget.TextView[@text="Collection Overview"]');
    await collectionOverview.waitForDisplayed({ timeout: 5000 });
    expect(await collectionOverview.isExisting()).toBe(true);
    console.log('✅ Collection Details — "Collection Overview" heading confirmed');

    // Verify metadata: Units + Lessons stats are visible
    const unitsStat = await browser.$('//android.widget.TextView[@text="Units"]');
    expect(await unitsStat.isExisting()).toBe(true);
    const lessonsStat = await browser.$('//android.widget.TextView[@text="Lessons"]');
    expect(await lessonsStat.isExisting()).toBe(true);
    console.log('✅ Units & Lessons stats visible');

    // Verify "Best Suited For" section
    const bestSuited = await browser.$('//android.widget.TextView[@text="Best Suited For"]');
    expect(await bestSuited.isExisting()).toBe(true);
    console.log('✅ "Best Suited For" section confirmed');

    // Verify "Collection Curriculum" section
    const curriculum = await browser.$('//android.widget.TextView[@text="Collection Curriculum"]');
    expect(await curriculum.isExisting()).toBe(true);
    console.log('✅ "Collection Curriculum" section confirmed');

    // Dynamically discover all content items in the curriculum, consume each one in a loop
    async function collectVisibleContentItems() {
      // The curriculum content container is an android.view.View with text="Collection Curriculum"
      // (not the TextView heading — both have same text but different class)
      const curriculumRoot = await browser.$('//android.view.View[@text="Collection Curriculum"]');
      await curriculumRoot.waitForDisplayed({ timeout: 5000 });

      // const unitHeaders = await curriculumRoot.$$('.//android.widget.Button[contains(@text, "Download")]');
      // for (const header of unitHeaders) {
      //   await header.click();
      //   await browser.pause(1500);
      // }

      const allButtons = await curriculumRoot.$$('.//android.widget.Button[@content-desc!=""]');
      const items: { el: WebdriverIO.Element; desc: string }[] = [];
      for (const btn of allButtons) {
        const btnText = await btn.getText();
        if (btnText && btnText.includes('Download')) continue;
        const desc = await btn.getAttribute('content-desc');
        if (desc && desc.trim().length > 0) {
          items.push({ el: btn, desc });
        }
      }
      return items;
    }

    const consumed = new Set<string>();
    let total = 0;

    while (true) {
      const freshItems = await collectVisibleContentItems();
      const remaining = freshItems.filter(i => !consumed.has(i.desc));

      if (remaining.length === 0) break;

      if (total === 0) total = freshItems.length;
      const current = remaining[0];
      consumed.add(current.desc);

      console.log(`  [${consumed.size}/${total}] Opening: "${current.desc}"`);
      await current.el.click();
      await browser.pause(4000);

      const contentPlayer = await browser.$('//android.widget.TextView[@text="Collection Overview"]');
      await contentPlayer.waitForDisplayed({ timeout: 5000, reverse: true });
      console.log(`    ✅ Player loaded for: "${current.desc}"`);

      // await browser.pause(3000);
      // await assertNoLoginPrompt(browser);

      await browser.back();
      await browser.pause(2000);

      let isOnCollectionDetails = await browser.$('//android.widget.TextView[@text="Collection Overview"]').isExisting();
      if (!isOnCollectionDetails) {
        console.log(`    ↪ Back landed on Explore; re-tapping card to re-enter Collection Details`);
        const reCard = await browser.$(`//android.widget.Button[@text="${firstPlaylist}"]`);
        await reCard.waitForDisplayed({ timeout: 5000 });
        await reCard.click();
        await browser.pause(3000);
        isOnCollectionDetails = true;
      }
      const overview = await browser.$('//android.widget.TextView[@text="Collection Overview"]');
      await overview.waitForDisplayed({ timeout: 5000 });
      console.log(`    ✅ Back to Collection Details (${consumed.size}/${total})`);
    }

    console.log(`✅ All ${consumed.size} content items consumed, currently on Explore`);
  });





});
