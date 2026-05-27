import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

function extractCourseName(buttonText: string): string | null {
    const match = buttonText.match(/^Completed\s+(.+?)\s+progressRingLabel\s+100%\s+\1/);
    return match ? match[1].trim() : null;
}

describe('E2E Suite 5: Certificate Complete Flow (Preview → Download → Verify)', () => {
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
        const certSectionLabel = await browser.$('//android.widget.TextView[@text="Certificate"]');
        if (!(await certSectionLabel.isExisting().catch(() => false))) {
            const windowSize = await browser.getWindowSize();
            for (let i = 0; i < 20; i++) {
                await browser.action('pointer')
                    .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.65) })
                    .down()
                    .move({ x: Math.floor(windowSize.width / 2), y: Math.floor(windowSize.height * 0.35) })
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

        await browser.saveScreenshot('../reports/android/test-results/suite5-certificate-preview.png');

        // Close the preview dialog via hardware back button
        await browser.back();
        await browser.pause(4000);
        await browser.back();

        console.log(`\n✅ TC_19: Certificate preview verified for course "${targetCourseName}"`);
    });

    it('should open download dialog and verify format options', async () => {
        if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
            throw new Error('Missing credentials in .env file');
        }

        await login(browser, testCredentials.email, testCredentials.password);

        const isLoggedIn = await verifyLogin(browser, testCredentials.username);
        if (!isLoggedIn) {
            throw new Error(`Login verification failed for "${testCredentials.username}"`);
        }

        // Navigate to Profile → My Learning
        const profileTab = await browser.$('//android.widget.Button[@content-desc="Profile"]');
        if (await profileTab.isExisting()) {
            await profileTab.click();
            await browser.pause(2000);
        }

        const myLearningProfile = await browser.$('//android.widget.Button[@text="My Learning"]');
        if (await myLearningProfile.isExisting()) {
            await myLearningProfile.click();
            await browser.pause(2000);
        }

        // ... find the completed course ...
        // For now, we navigate to the known completed course
        const homeTab = await browser.$('//android.widget.Button[@content-desc="Home"]');
        if (await homeTab.isExisting()) {
            await homeTab.click();
            await browser.pause(2000);
        }

        const exploreTab = await browser.$('//android.widget.Button[@content-desc="Explore"]');
        if (await exploreTab.isExisting()) {
            await exploreTab.click();
            await browser.pause(2000);
        }

        // Use scrollUntilText to find the course
        const { scrollUntilText } = await import('../../../fixtures/scroll.fixture');
        const found = await scrollUntilText(browser, testCredentials.username, false);
        if (!found) {
            throw new Error('Could not find completed course for certificate test');
        }

        // Tap the course to open it
        const courseCard = await browser.$(`//*[contains(@text, "${testCredentials.username}")]`);
        if (await courseCard.isExisting()) {
            await courseCard.click();
            await browser.pause(3000);
        }

        // Now look for download certificate button
        const downloadBtn = await browser.$('//android.widget.Button[contains(@text, "Download Certificate")]');
        let pdfDisplayed = false;
        let pngDisplayed = false;
        if (await downloadBtn.isExisting()) {
            await downloadBtn.click();
            await browser.pause(2000);

            // Verify download dialog appears
            const downloadDialog = await browser.$('//android.app.Dialog');
            await downloadDialog.waitForDisplayed({ timeout: 10000 });
            console.log('✅ Download options dialog opened');

            // Verify download as PDF button
            const pdfBtn = await browser.$('//android.widget.Button[@text="Download as PDF"]');
            await pdfBtn.waitForDisplayed({ timeout: 5000 });
            pdfDisplayed = await pdfBtn.isDisplayed();
            console.log(`✅ TC_23 PASS: "Download as PDF" button is ${pdfDisplayed ? 'visible' : 'not visible'}`);

            // Verify download as PNG button
            const pngBtn = await browser.$('//android.widget.Button[@text="Download as PNG"]');
            await pngBtn.waitForDisplayed({ timeout: 5000 });
            pngDisplayed = await pngBtn.isDisplayed();
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
        }

        // ── Final Summary ──
        console.log('\n══════════════════════════════════════════════');
        console.log('📊 Suite 5: Certificate Complete Flow Results');
        console.log('══════════════════════════════════════════════');

        expect(pdfDisplayed).toBe(true);
        expect(pngDisplayed).toBe(true);
    });
});
