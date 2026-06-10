import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

function extractCourseName(buttonText: string): string | null {
    const match = buttonText.match(/^Completed\s+(.+?)\s+progressRingLabel\s+100%\s+\1/);
    return match ? match[1].trim() : null;
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


describe('E2E Suite 5: Certificate Complete Flow (Preview → Download → Verify)', () => {
    let targetCourseName: string | null = null;

    it('should preview certificate from course detail', async () => {
        if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
            throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
        }

        await login(browser, testCredentials.email, testCredentials.password);

        const isLoggedIn = await verifyLogin(browser, testCredentials.username);
        if (!isLoggedIn) {
            throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
        }

        // Navigate to Profile tab
        const profileTab = await browser.$('//android.widget.Button[@content-desc="Profile" or @text="Profile"]');
        await profileTab.waitForDisplayed({ timeout: 10000 });
        await profileTab.click();
        await browser.pause(2000);

        // Tap My Learning in the profile list
        await scrollToAndTap(browser,'//android.widget.Button[@content-desc="My Learning" or @text="My Learning"]','My Learning');
        await browser.pause(2000);

        // Open Filters, select Completed
        const filtersBtn = await browser.$('//android.widget.Button[@text="Filters"]');
        await filtersBtn.waitForDisplayed({ timeout: 5000 });
        await filtersBtn.click();
        await browser.pause(1500);

        const completedFilter = await browser.$('//android.widget.Button[@text="Completed"]');
        await completedFilter.waitForDisplayed({ timeout: 5000 });
        await completedFilter.click();
        await browser.pause(2000);

        // Locate a completed course card with "Download Certificate" in its text
        const allBtns = await browser.$$('//android.widget.Button');
        let targetBtn: WebdriverIO.Element | null = null;

        for (const btn of allBtns) {
            const text = await btn.getText();
            if (text.includes('Download Certificate')) {
                const name = extractCourseName(text);
                if (name) {
                    targetCourseName = name;
                    targetBtn = btn;
                    console.log(`✅ Found course with certificate: "${name}"`);
                    break;
                }
            }
        }

        if (!targetCourseName || !targetBtn) {
            // Try scrolling to find a course with Download Certificate
            const windowSize = await browser.getWindowSize();
            for (let i = 0; i < 20; i++) {
                await browser.action('pointer')
                    .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.7) })
                    .down()
                    .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.3) })
                    .up()
                    .perform();
                await browser.pause(1000);

                const btnsAfterScroll = await browser.$$('//android.widget.Button');
                for (const btn of btnsAfterScroll) {
                    const text = await btn.getText();
                    if (text.includes('Download Certificate')) {
                        const name = extractCourseName(text);
                        if (name) {
                            targetCourseName = name;
                            targetBtn = btn;
                            console.log(`✅ Found course with certificate after scroll: "${name}"`);
                            break;
                        }
                    }
                }
                if (targetCourseName) break;
            }
        }

        if (!targetCourseName || !targetBtn) {
            throw new Error('No completed course with a certificate found');
        }

        // ── TC_19 — Preview Certificate from Course Detail ──

        // Tap the UPPER portion of the card (course name area) to open course detail
        const cardLocation = await targetBtn.getLocation();
        const cardSize = await targetBtn.getSize();
        const centerX = cardLocation.x + Math.floor(cardSize.width / 2);
        const detailTapY = cardLocation.y + Math.floor(cardSize.height * 0.25);
        await browser.action('pointer')
            .move({ x: centerX, y: detailTapY })
            .down()
            .up()
            .perform();
        await browser.pause(3000);

        // Wait for course detail WebView
        const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
        await coursePage.waitForDisplayed({ timeout: 15000 });
        console.log('✅ Landed on course detail page');

        // Scroll down to find Certificate section
        // const certSectionLabel = await browser.$('//android.widget.TextView[@text="Certificate"]');
        // if (!(await certSectionLabel.isExisting().catch(() => false))) {
        //     const windowSize = await browser.getWindowSize();
        //     for (let i = 0; i < 20; i++) {
        //         await browser.action('pointer')
        //             .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.65) })
        //             .down()
        //             .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.35) })
        //             .up()
        //             .perform();
        //         await browser.pause(500);
        //         if (await browser.$('//android.widget.TextView[@text="Certificate"]').isExisting().catch(() => false)) break;
        //     }
        // }

        // await certSectionLabel.waitForDisplayed({ timeout: 10000 });
        // console.log('✅ Found "Certificate" section');

        // Tap Preview Certificate button
        await scrollToAndTap(browser,'//android.widget.Button[@content-desc="Preview Certificate" or @text="Preview Certificate"]','Preview Certificate');
        await browser.pause(2000);

        
        // Verify preview dialog opened
        const dialog = await browser.$('//android.app.Dialog');
        await dialog.waitForDisplayed({ timeout: 10000 });
        console.log('✅ TC_19 PASS: Certificate preview dialog opened successfully');

        await browser.saveScreenshot('../reports/android/test-results/suite5-certificate-preview.png');

        // Close the preview dialog via hardware back button
        await browser.back();
        await browser.pause(4000);
        await browser.back();

        console.log(`\n✅ TC_19: Certificate preview verified for course "${targetCourseName}"`);
    });

    it('should open download dialog and verify format options', async () => {

        if (!targetCourseName) {
            throw new Error('No completed course name available from previous test');
        }


        // Scope card to the one matching BOTH course name AND "Download Certificate"
        const downloadBtn = await browser.$(`//android.widget.Button[contains(@text, "${targetCourseName}") and contains(@text, "Download Certificate")]`);
        if (await downloadBtn.isExisting()) {
            const loc = await downloadBtn.getLocation();
            const size = await downloadBtn.getSize();
            const centerX = loc.x + Math.floor(size.width / 2);
            const bottomY = loc.y + Math.floor(size.height * 0.93);

            await browser.action('pointer')
                .move({ x: centerX, y: bottomY })
                .down()
                .up()
                .perform();
            await browser.pause(2000);


            // Verify download dialog appears
            const downloadDialog = await browser.$('//android.app.Dialog');
            await downloadDialog.waitForDisplayed({ timeout: 10000 });
            console.log('✅ Download options dialog opened');




            // Verify download as PDF button
            const pdfBtn = await browser.$('//android.widget.Button[@text="Download as PDF"]');
            await pdfBtn.waitForDisplayed({ timeout: 5000 });
            const pdfDisplayed = await pdfBtn.isDisplayed();
            console.log(`✅ TC_23 PASS: "Download as PDF" button is ${pdfDisplayed ? 'visible' : 'not visible'}`);

            // Verify download as PNG button
            const pngBtn = await browser.$('//android.widget.Button[@text="Download as PNG"]');
            await pngBtn.waitForDisplayed({ timeout: 5000 });
            const pngDisplayed = await pngBtn.isDisplayed();
            console.log(`✅ TC_24 PASS: "Download as PNG" button is ${pngDisplayed ? 'visible' : 'not visible'}`);

            // Both format options available
            const bothFormatsAvailable = pdfDisplayed && pngDisplayed;
            console.log(`✅ TC_28 PASS: Both PDF and PNG download options ${bothFormatsAvailable ? 'are available' : 'are NOT both available'}`);

            await browser.saveScreenshot('../reports/android/test-results/suite5-download-dialog.png');

            // Verify Cancel button exists
            const cancelBtn = await browser.$('//android.widget.Button[@text="Cancel"]');
            await cancelBtn.waitForDisplayed({ timeout: 5000 });
            const cancelDisplayed = await cancelBtn.isDisplayed();
            console.log(`✅ Cancel button is ${cancelDisplayed ? 'visible' : 'not visible'}`);

            // Dismiss dialog via Cancel
            if (cancelDisplayed) {
                await cancelBtn.click();
                await browser.pause(2000);
            }

            expect(pdfDisplayed).toBe(true);
            expect(pngDisplayed).toBe(true);
        }
        else 
        {
            throw new Error(`Could not find the course card with name "${targetCourseName}" and "Download Certificate" button for download test`);
        }


        // ── Final Summary ──
        console.log('\n══════════════════════════════════════════════');
        console.log('📊 Suite 5: Certificate Complete Flow Results');
        console.log('══════════════════════════════════════════════');
    });
});
