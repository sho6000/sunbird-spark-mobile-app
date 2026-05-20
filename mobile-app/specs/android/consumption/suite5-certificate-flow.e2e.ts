import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

function extractCourseName(buttonText: string): string | null {
    const match = buttonText.match(/^Completed\s+(.+?)\s+progressRingLabel\s+100%\s+\1/);
    return match ? match[1].trim() : null;
}

describe('E2E Suite 5: Certificate Complete Flow (Preview → Download → Verify)', () => {
    it('should preview certificate from course detail and verify download dialog options', async () => {
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
        const myLearningBtn = await browser.$('//android.widget.Button[@content-desc="My Learning" or @text="My Learning"]');
        await myLearningBtn.waitForDisplayed({ timeout: 10000 });
        await myLearningBtn.click();
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
        let targetCourseName: string | null = null;
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

        // ── PART 1: TC_19 — Preview Certificate from Course Detail ──

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
        const certSectionLabel = await browser.$('//android.widget.TextView[@text="Certificate"]');
        if (!(await certSectionLabel.isExisting().catch(() => false))) {
            for (let i = 0; i < 20; i++) {
                await browser.action('pointer')
                    .move({ x: 360, y: 1500 })
                    .down()
                    .move({ x: 360, y: 800 })
                    .up()
                    .perform();
                await browser.pause(500);
                if (await browser.$('//android.widget.TextView[@text="Certificate"]').isExisting().catch(() => false)) break;
            }
        }

        await certSectionLabel.waitForDisplayed({ timeout: 10000 });
        console.log('✅ Found "Certificate" section');

        // Find and tap "Preview Certificate" button
        const previewCertBtn = await browser.$('//android.widget.Button[@text="Preview Certificate"]');
        await previewCertBtn.waitForDisplayed({ timeout: 5000 });
        await previewCertBtn.click();
        await browser.pause(3000);

        // Verify preview dialog opened
        const dialog = await browser.$('//android.app.Dialog');
        await dialog.waitForDisplayed({ timeout: 10000 });
        console.log('✅ TC_19 PASS: Certificate preview dialog opened successfully');

        await browser.saveScreenshot('./test-results/suite5-certificate-preview.png');

        // Close the preview dialog via hardware back button
        await browser.back();
        await browser.pause(4000);
        await browser.back();


        console.log(`\n✅ TC_19: Certificate preview verified for course "${targetCourseName}"`);

        // ── PART 2: TC_23, TC_24, TC_28 — Download Certificate options ──
        // Now back on My Learning → Completed list, find the course card again
        let courseCardBtn: WebdriverIO.Element | null = null;
        const windowSize2 = await browser.getWindowSize();

        for (let i = 0; i < 30; i++) {
            const cards = await browser.$$('//android.widget.Button');
            for (const card of cards) {
                const text = await card.getText();
                if (text.includes(targetCourseName!) && text.includes('Download Certificate')) {
                    courseCardBtn = card;
                    break;
                }
            }
            if (courseCardBtn) {
                console.log(`✅ Found "${targetCourseName}" card with Download Certificate after ${i + 1} scroll(s)`);
                break;
            }
            await browser.action('pointer')
                .move({ x: Math.floor(windowSize2.width / 2), y: Math.floor(windowSize2.height * 0.75) })
                .down()
                .move({ x: Math.floor(windowSize2.width / 2), y: Math.floor(windowSize2.height * 0.25) })
                .up()
                .perform();
            await browser.pause(500);
        }

        if (!courseCardBtn) {
            throw new Error(`Could not find course card for "${targetCourseName}" in completed list`);
        }

        // Verify the card is fully visible, then tap the lower portion (Download Certificate area)
        await courseCardBtn.waitForDisplayed({ timeout: 5000 });
        const dlCardLocation = await courseCardBtn.getLocation();
        const dlCardSize = await courseCardBtn.getSize();
        const downloadTapY = dlCardLocation.y + Math.floor(dlCardSize.height * 0.85);
        const dlCenterX = dlCardLocation.x + Math.floor(dlCardSize.width / 2);

        await browser.action('pointer')
            .move({ x: dlCenterX, y: downloadTapY })
            .down()
            .up()
            .perform();
        await browser.pause(3000);

        // Verify the download options dialog appeared
        const downloadDialog = await browser.$('//android.app.Dialog');
        await downloadDialog.waitForDisplayed({ timeout: 10000 });
        console.log('✅ Download options dialog opened');

        // Verify download as PDF button (TC_23)
        const pdfBtn = await browser.$('//android.widget.Button[@text="Download as PDF"]');
        await pdfBtn.waitForDisplayed({ timeout: 5000 });
        const pdfDisplayed = await pdfBtn.isDisplayed();
        console.log(`✅ TC_23 PASS: "Download as PDF" button is ${pdfDisplayed ? 'visible' : 'not visible'}`);

        // Verify download as PNG button (TC_24)
        const pngBtn = await browser.$('//android.widget.Button[@text="Download as PNG"]');
        await pngBtn.waitForDisplayed({ timeout: 5000 });
        const pngDisplayed = await pngBtn.isDisplayed();
        console.log(`✅ TC_24 PASS: "Download as PNG" button is ${pngDisplayed ? 'visible' : 'not visible'}`);

        // Verify certificate download dialog has both format options (TC_28)
        const bothFormatsAvailable = pdfDisplayed && pngDisplayed;
        console.log(`✅ TC_28 PASS: Both PDF and PNG download options ${bothFormatsAvailable ? 'are available' : 'are NOT both available'}`);

        await browser.saveScreenshot('./test-results/suite5-download-dialog.png');

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

        // ── Final Summary ──
        console.log('\n══════════════════════════════════════════════');
        console.log('📊 Suite 5: Certificate Complete Flow Results');
        console.log('══════════════════════════════════════════════');
        console.log(`✅ TC_19: Certificate preview — PASS (course: "${targetCourseName}")`);
        console.log(`✅ TC_23: Download as PDF option — ${pdfDisplayed ? 'PASS' : 'FAIL'}`);
        console.log(`✅ TC_24: Download as PNG option — ${pngDisplayed ? 'PASS' : 'FAIL'}`);
        console.log(`✅ TC_28: Certificate format options — ${bothFormatsAvailable ? 'PASS' : 'FAIL'}`);
        console.log('══════════════════════════════════════════════');

        expect(pdfDisplayed).toBe(true);
        expect(pngDisplayed).toBe(true);
    });
});
