import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

describe('E2E Suite 8: Profile Data & Consent Management', () => {
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

  it('should toggle consent (On→Off or Off→On) based on current state', async () => {
    const homeTab = await browser.$('//android.widget.Button[@content-desc="Home" or @text="Home"]');
    if (await homeTab.isExisting()) {
      await homeTab.click();
      await browser.pause(2000);
    }

    const continueSection = await browser.$('//android.widget.TextView[@text="Continue from where you left"]');
    await continueSection.waitForDisplayed({ timeout: 10000 });

    const continueBtn = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/..//android.widget.Button');
    await continueBtn.waitForDisplayed({ timeout: 5000 });
    await continueBtn.click();
    await browser.pause(5000);

    const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
    await coursePage.waitForDisplayed({ timeout: 10000 });

    const { height, width } = await browser.getWindowSize();
    const centerX = Math.floor(width / 2);

    for (let s = 0; s < 10; s++) {
      const exists = await browser.$('//android.widget.TextView[@text="Personal Information"]').isExisting();
      if (exists) {
        const loc = await browser.$('//android.widget.TextView[@text="Personal Information"]').getLocation();
        if (loc.y > 200 && loc.y < height - 200) break;
      }
      await browser.action('pointer')
        .move({ x: centerX, y: Math.floor(height * 0.7) })
        .down()
        .move({ x: centerX, y: Math.floor(height * 0.3), duration: 800 })
        .up()
        .perform();
      await browser.pause(1000);
    }

    const personalInfoHeader = await browser.$('//android.widget.TextView[@text="Personal Information"]');
    await personalInfoHeader.waitForDisplayed({ timeout: 5000 });

    const consentNote = await browser.$('//android.widget.TextView[starts-with(@text, "Profile data sharing is")]');
    await consentNote.waitForDisplayed({ timeout: 5000 });
    const initialText = await consentNote.getText();
    console.log(`  Current consent: "${initialText}"`);

    expect(initialText).toContain('Profile data sharing is');
    const isOn = initialText.includes('On') || initialText.includes('on');

    const updateBtn = await browser.$('//android.widget.Button[@text="Update"]');
    await updateBtn.waitForDisplayed({ timeout: 5000 });
    await updateBtn.click();
    await browser.pause(2000);

    const doNotShareBtn = await browser.$('//android.widget.Button[@text="Do not share" or @content-desc="Do not share"]');
    await doNotShareBtn.waitForDisplayed({ timeout: 5000 });
    console.log('  Consent dialog opened');

    if (isOn) {
      const dnsX = Math.floor(width * 0.592);
      const dnsY = Math.floor(height * 0.771);
      console.log(`  Consent is On → tapping "Do not share" at (${dnsX}, ${dnsY})`);
      await browser.action('pointer')
        .move({ x: dnsX, y: dnsY })
        .down()
        .pause(100)
        .up()
        .perform();
    } else {
      console.log('  Consent is Off → enabling Share via checkbox');
      await browser.action('pointer')
        .move({ x: Math.floor(width * 0.088), y: Math.floor(height * 0.698) })
        .down()
        .pause(100)
        .up()
        .perform();
      await browser.pause(1500);

      console.log('  Tapping Share');
      await browser.action('pointer')
        .move({ x: Math.floor(width * 0.849), y: Math.floor(height * 0.771) })
        .down()
        .pause(100)
        .up()
        .perform();
    }
    await browser.pause(2000);

    const updatedNote = await browser.$('//android.widget.TextView[starts-with(@text, "Profile data sharing is")]');
    await updatedNote.waitForDisplayed({ timeout: 5000 });
    const updatedText = await updatedNote.getText();
    console.log(`  Updated consent: "${updatedText}"`);

    if (isOn) {
      expect(updatedText).toContain('Off');
    } else {
      expect(updatedText).toContain('On');
    }
  });

  after(async () => {
    await browser.saveScreenshot('../reports/android/test-results/suite8-profile-data-consent-toggle.png');
  });
});
