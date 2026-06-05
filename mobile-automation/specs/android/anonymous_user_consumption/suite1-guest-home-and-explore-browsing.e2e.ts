import { verifyAnonymous, assertNoLoginPrompt, ensureAnonymous } from '../../../fixtures/verify-anonymous.fixture';

const CONTENT_TYPES = ['Course', 'PDF', 'Video', 'EPUB', 'HTML', 'ECML'];

interface ParsedCard {
    text: string;
    type: string | null;
    lessons: number | null;
}

function parseCard(text: string): ParsedCard {
    const type = CONTENT_TYPES.find(ct => text.includes(ct)) || null;
    const lessonMatch = text.match(/•\s*(\d+)\s*Lessons?/);
    return {
        text,
        type,
        lessons: lessonMatch ? parseInt(lessonMatch[1], 10) : null,
    };
}

describe('E2E Suite 1: Anonymous Home & Explore Discovery (TC_01, TC_04)', () => {
    before(async () => {
        await ensureAnonymous(browser);
    });

    const allCards: { source: string; card: ParsedCard }[] = [];

    // ── Helpers ──

    async function scrollDown(centerX?: number) {
        const windowSize = await browser.getWindowSize();
        const cx = centerX ?? Math.floor(windowSize.width / 2);
        await browser.action('pointer')
            .move({ x: cx, y: Math.floor(windowSize.height * 0.65) })
            .down()
            .move({ x: cx, y: Math.floor(windowSize.height * 0.40), duration: 800 })
            .up()
            .perform();
        await browser.pause(500);
    }

    async function scrollUp(centerX?: number) {
        const windowSize = await browser.getWindowSize();
        const cx = centerX ?? Math.floor(windowSize.width / 2);
        await browser.action('pointer')
            .move({ x: cx, y: Math.floor(windowSize.height * 0.40) })
            .down()
            .move({ x: cx, y: Math.floor(windowSize.height * 0.65), duration: 800 })
            .up()
            .perform();
        await browser.pause(500);
    }

    async function dismissOnboardingIfPresent() {
        const btn = await browser.$('//*[@text="Let\'s Get Started"]');
        if (await btn.isExisting()) {
            await btn.click();
            await browser.pause(3000);
            console.log('✅ Onboarding dismissed');
        }
    }

    // async function navTo(section: string) {
    //     const tab = await browser.$(`//android.widget.Button[@content-desc="${section}"]`);
    //     if (await tab.isExisting()) {
    //         await tab.click();
    //         await browser.pause(2000);
    //     }
    // }

    async function collectCardTexts(): Promise<string[]> {
        const allBtns = await browser.$$('//android.widget.Button');
        const cards: string[] = [];
        for (const btn of allBtns) {
            const text = (await btn.getText()).trim();
            if (text && CONTENT_TYPES.some(ct => text.includes(ct))) {
                cards.push(text);
            }
        }
        return [...new Set(cards)];
    }

    async function scrollCollectCards(maxScrolls = 8): Promise<string[]> {
        const seen = new Set<string>();
        let emptyScrolls = 0;

        for (let i = 0; i < maxScrolls; i++) {
            const current = await collectCardTexts();
            let newCards = 0;
            for (const text of current) {
                if (!seen.has(text)) {
                    seen.add(text);
                    newCards++;
                }
            }
            if (newCards === 0) {
                emptyScrolls++;
            } else {
                emptyScrolls = 0;
            }
            if (emptyScrolls >= 5) {
                console.log(`No new cards after ${emptyScrolls} consecutive empty scrolls — stopping`);
                break;
            }
            await scrollDown();
        }

        return [...seen];
    }

    // ── Tests ──

    it('Part A: Anonymous state + Home "Most Popular Contents" display', async () => {
        await dismissOnboardingIfPresent();

        // 1. Verify anonymous state via fixture
        const isAnonymous = await verifyAnonymous(browser);
        expect(isAnonymous).toBe(true);
        console.log('✅ Anonymous state confirmed');

        // 2. Navigate to Home
        // await navTo('Home');
        const HmBtn = await browser.$('//android.widget.Button[@content-desc="Home" or @text="Home"]');
        await HmBtn.click();

        // 3. Scroll down to find "Most Popular Contents" section
        let sectionFound = false;
        for (let i = 0; i < 30; i++) {
            const section = await browser.$('//*[@text="Most Popular Contents"]');
            if (await section.isExisting() && await section.isDisplayed()) {
                sectionFound = true;
                console.log(`✅ Found "Most Popular Contents" after ${i} scroll(s)`);
                break;
            }
            await scrollDown();
        }

        if (sectionFound) {
            // Scroll a tiny bit more to reveal the cards just below the header
            for (let i = 0; i < 2; i++) {
                await scrollDown();
            }

            const texts = await collectCardTexts();
            console.log(`Found ${texts.length} card(s) in view on Home`);

            for (const text of texts) {
                const parsed = parseCard(text);
                allCards.push({ source: 'home-most-popular', card: parsed });
                console.log(`  - [${parsed.type || '?'}] "${text}"${parsed.lessons !== null ? ` (${parsed.lessons} lesson(s))` : ''}`);
            }

            expect(texts.length).toBeGreaterThan(0);
        } else {
            console.warn('⚠️ "Most Popular Contents" section not found — Home may have no content');
            // Non-fatal: test env may have no content
        }

        // 4. No login prompt on Home
        await assertNoLoginPrompt(browser);
        console.log('✅ No "Sign In" prompt on Home');
    });

    it('Part B: Explore page content cards display', async () => {
        // 1. Navigate to Explore
        // await navTo('Explore');
        const ExpBtn = await browser.$('//android.widget.Button[@content-desc="Explore" or @text="Explore"]');
        await ExpBtn.click();

        // 2. Verify page loaded
        const heading = await browser.$('//*[@text="Start Exploring"]');
        await heading.waitForDisplayed({ timeout: 5000 });
        console.log('✅ Explore page loaded — "Start Exploring" heading visible');

        // 3. Scroll-collect all content cards
        const texts = await scrollCollectCards();
        console.log(`Collected ${texts.length} unique card(s) from Explore`);

        for (const text of texts) {
            const parsed = parseCard(text);
            allCards.push({ source: 'explore', card: parsed });
            console.log(`  - [${parsed.type || '?'}] "${text}"${parsed.lessons !== null ? ` (${parsed.lessons} lesson(s))` : ''}`);
        }

        expect(texts.length).toBeGreaterThan(0);

        // 4. No login prompt on Explore
        await assertNoLoginPrompt(browser);
        console.log('✅ No "Sign In" prompt on Explore');
    });

    after('Summary of discovered content', async () => {
        console.log(`\n📊 Total cards discovered: ${allCards.length}`);

        const byType: Record<string, number> = {};
        for (const { card } of allCards) {
            const t = card.type || 'unknown';
            byType[t] = (byType[t] || 0) + 1;
        }
        for (const [type, count] of Object.entries(byType)) {
            console.log(`  - ${type}: ${count}`);
        }

        await browser.saveScreenshot('./test-results/suite1-guest-home-and-explore-browsing.png');

        expect(allCards.length).toBeGreaterThan(0);
        console.log(`\n✅ Suite 1: ${allCards.length} card(s) verified successfully`);
    });

});
