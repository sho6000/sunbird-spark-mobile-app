import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

describe('E2E Suite 8: Profile Data & Consent Dialog Contents', () => {
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

  it('should navigate to consent dialog and verify all contents', async () => {
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
      await browser.action('pointer', { parameters: { pointerType: 'touch' } })
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
    expect(await consentNote.isExisting()).toBe(true);
    console.log('  ✅ Consent note visible');

    const updateBtn = await browser.$('//android.widget.Button[@text="Update"]');
    await updateBtn.waitForDisplayed({ timeout: 5000 });
    await updateBtn.click();
    await browser.pause(2000);

    const dialog = await browser.$('//android.app.Dialog');
    await dialog.waitForDisplayed({ timeout: 5000 });
    console.log('  ✅ Consent dialog opened');

    const userIDRow = await browser.$('//android.view.View[contains(@text, "User ID")]');
    expect(await userIDRow.isExisting()).toBe(true);
    console.log('  ✅ User ID row present');

    const mobileRow = await browser.$('//android.view.View[contains(@text, "Mobile Number")]');
    expect(await mobileRow.isExisting()).toBe(true);
    console.log('  ✅ Mobile Number row present');

    const emailRow = await browser.$('//android.view.View[contains(@text, "Email ID")]');
    expect(await emailRow.isExisting()).toBe(true);
    console.log('  ✅ Email ID row present');

    const infoText = await browser.$('//android.widget.TextView[@text="You can edit these details from your profile."]');
    expect(await infoText.isExisting()).toBe(true);
    console.log('  ✅ Info text present');

    const checkbox = await browser.$('//android.widget.CheckBox[contains(@text, "I agree to share")]');
    expect(await checkbox.isExisting()).toBe(true);
    console.log('  ✅ Consent checkbox present');

    const doNotShareBtn = await browser.$('//android.widget.Button[@text="Do not share"]');
    expect(await doNotShareBtn.isExisting()).toBe(true);
    expect(await doNotShareBtn.isEnabled()).toBe(true);
    console.log('  ✅ "Do not share" button present and enabled');

    const shareBtn = await browser.$('//android.widget.Button[@text="Share"]');
    expect(await shareBtn.isExisting()).toBe(true);
    expect(await shareBtn.isEnabled()).toBe(false);
    console.log('  ✅ "Share" button present (initially disabled)');

    await browser.saveScreenshot('../reports/android/test-results/suite8-consent-dialog.png');
    console.log('  ✅ All dialog contents verified — test passed');
  });

  after(async () => {
    await browser.saveScreenshot('../reports/android/test-results/suite8-final.png');
  });
});