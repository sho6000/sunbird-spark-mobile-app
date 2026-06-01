import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

const CONTENT_TYPE_FILTERS: Record<string, string> = {
    Video: 'Video',
    Audio: 'Audio',
    PDF: 'PDF',
    Epub: 'EPUB',
    Youtube: 'Video',
    HTML: 'HTML',
    Interactive: 'ECML',
};

const NAV_BUTTONS = new Set(['Search', 'Scan QR Code', 'Filters', 'Select Language', 'Home', 'My Learning', 'Explore', 'Support', 'Profile']);

async function getContentCardTexts(browser: WebdriverIO.Browser): Promise<string[]> {
    const buttons = await browser.$$('android.widget.Button');
    const cardTexts: string[] = [];
    for (const btn of buttons) {
        const text = (await btn.getText()).trim();
        if (text && !NAV_BUTTONS.has(text)) {
            cardTexts.push(text);
        }
    }
    return cardTexts;
}

describe('Explore Page - Content Type Filter Tests (Suite 2)', () => {
    it('should filter content by each content type individually and verify results', async () => {
        if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
            throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
        }

        await login(browser, testCredentials.email, testCredentials.password);

        const isLoggedIn = await verifyLogin(browser, testCredentials.username);
        if (!isLoggedIn) {
            throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
        }

        const exploreNav = await browser.$('//android.widget.Button[@content-desc="Explore" or @text="Explore"]');
        await exploreNav.waitForDisplayed({ timeout: 10000 });
        await exploreNav.click();
        await browser.pause(3000);

        let previouslySelected: string | null = null;

        for (const [checkboxText, badgeText] of Object.entries(CONTENT_TYPE_FILTERS)) {
            console.log(`\nTesting content type filter: "${checkboxText}" (badge: "${badgeText}")`);

            const filtersBtn = await browser.$('//android.widget.Button[@text="Filters"]');
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

            const currentCb = await browser.$(`//android.widget.CheckBox[@text="${checkboxText}"]`);
            await currentCb.waitForDisplayed({ timeout: 5000 });
            await currentCb.click();
            await browser.pause(300);

            const closeBtn = await browser.$('//android.widget.Button[@text="Close"]');
            await closeBtn.waitForDisplayed({ timeout: 5000 });
            await closeBtn.click();
            await browser.pause(3000);

            const cardTexts = await getContentCardTexts(browser);

            const matching = cardTexts.filter(t => t.includes(badgeText));

            if (cardTexts.length > 0) {
                if (matching.length > 0) {
                    console.log(`  Verified: ${matching.length} card(s) show "${badgeText}" badge`);
                } else {
                    expect(matching.length).toBeGreaterThan(0);
                }
            } else {
                const noContent = await browser.$('//*[contains(@text, "No content found")]').isExisting().catch(() => false);
                if (noContent) {
                    console.log(`  No content found (empty state)`);
                } else {
                    throw new Error(`Filter "${checkboxText}": no cards and no empty-state indicator found — possible render or network failure`);
                }
            }

            await browser.saveScreenshot(`../reports/android/test-results/filter-${checkboxText.toLowerCase().replace(/\s+/g, '-')}.png`);

            previouslySelected = checkboxText;
        }

        console.log('\nAll content type filter tests completed!');
    });
});
