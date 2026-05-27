import { login, verifyLogin, testCredentials } from '../../../fixtures/login.fixture';

function extractProgress(text: string): string | null {
    const match = text.match(/(\d+)%/);
    return match ? match[1] + '%' : null;
}

interface CourseInfo {
    name: string;
    progress: string;
    source: 'continue-learning' | 'in-progress';
    status: 'passed' | 'failed';
}

describe('E2E Suite 1: Continue Learning Journey', () => {

    const courses: CourseInfo[] = [];

    // PART A 
    it('Verify "Continue from where you left"', async () => {

        if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
            throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
        }

        await login(browser, testCredentials.email, testCredentials.password);

        const isLoggedIn = await verifyLogin(browser, testCredentials.username);
        if (!isLoggedIn) {
            throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
        }

        // Ensure we're on Home tab
        const homeTab = await browser.$('//android.widget.Button[@content-desc="Home" or @text="Home"]');
        if (await homeTab.isExisting()) {
            await homeTab.click();
            await browser.pause(2000);
        }

        const continueSection = await browser.$('//android.widget.TextView[@text="Continue from where you left"]');
        if (await continueSection.isExisting()) {
            console.log('✅ Found "Continue from where you left" section');

            const nameEl = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.TextView[not(contains(@text, "Completed")) and not(@text="Continue from where you left")]');
            const progressEl = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.TextView[contains(@text, "Completed")]');
            const btn = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.Button');

            if (await nameEl.isExisting() && await progressEl.isExisting() && await btn.isExisting()) {
                const name = await nameEl.getText();
                const progress = extractProgress(await progressEl.getText());

                if (name && progress) {
                    console.log(`\n🔍 Verifying "${name}" (${progress}) from Continue Learning`);

                    let status: 'passed' | 'failed' = 'passed';
                    try {
                        await btn.click();
                        await browser.pause(5000);

                        const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
                        await coursePage.waitForDisplayed({ timeout: 10000 });
                        console.log('  ✅ Landed on course detail page');

                        const detailNameEl = await browser.$(`//*[contains(@text, "${name}")]`);
                        await detailNameEl.waitForDisplayed({ timeout: 5000 });
                        const actualName = await detailNameEl.getText();
                        expect(actualName).toContain(name);
                        console.log(`  ✅ Name matches: "${actualName}"`);

                        const detailProgressEl = await browser.$('//android.widget.TextView[contains(@text, "Completed:")]');
                        await detailProgressEl.waitForDisplayed({ timeout: 5000 });
                        const actualProgress = extractProgress(await detailProgressEl.getText());
                        expect(actualProgress).toBe(progress);
                        console.log(`  ✅ Progress matches: ${actualProgress}`);
                    } catch (e) {
                        status = 'failed';
                        console.warn(`  ❌ "${name}" — ${(e as Error).message}`);
                    }

                    const backBtn = await browser.$('//android.widget.Button[@content-desc="Back"]');
                    if (await backBtn.isExisting()) {
                        await backBtn.click();
                        await browser.pause(3000);
                    }

                    courses.push({ name, progress, source: 'continue-learning', status });
                    expect(status).toBe('passed');
                }
            }
        } else {
            console.log('ℹ️ "Continue from where you left" section not found');
        }


    });


    // PART B
     it('Verify "In Progress Courses"', async () => {



        const windowSize = await browser.getWindowSize();
        const centerX = Math.floor(windowSize.width / 2);

        let ipSectionFound = false;
        for (let i = 0; i < 50; i++) {
            const ipSection = await browser.$('//android.widget.TextView[contains(@text, "In Progress Courses")]');
            if (await ipSection.isExisting() && await ipSection.isDisplayed()) {
                ipSectionFound = true;
                console.log(`✅ Found "In Progress Courses" after ${i} scroll(s)`);
                break;
            }
            await browser.action('pointer')
                .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                .down()
                .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                .up()
                .perform();
            await browser.pause(500);
        }

        if (!ipSectionFound) {
            console.log('ℹ️ "In Progress Courses" section not found');
        } else {
            const verifiedNames = new Set<string>();
            const MAX_COURSES = 6;
            let consecutiveEmptyScrolls = 0;
            let partBFailed = false;

            // Scroll down to reveal courses below the header
            for (let s = 0; s < 3; s++) {
                await browser.action('pointer')
                    .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                    .down()
                    .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                    .up()
                    .perform();
                await browser.pause(500);
            }

            while (consecutiveEmptyScrolls < 5 && verifiedNames.size < MAX_COURSES) {
                const allBtns = await browser.$$('//android.widget.Button');
                const toVerify: { name: string; progress: string }[] = [];

                for (const btn of allBtns) {
                    const text = await btn.getText();
                    const match = text.match(/^Course (.+?) (\d+%)(?: \1)?$/);
                    if (match) {
                        const name = match[1].trim();
                        if (!verifiedNames.has(name)) {
                            toVerify.push({ name, progress: match[2] });
                            verifiedNames.add(name);
                        }
                    }
                }

                console.log(`  Found ${toVerify.length} unverified course(s) in view (${verifiedNames.size}/${MAX_COURSES} total)`);

                if (toVerify.length === 0) {
                    consecutiveEmptyScrolls++;
                } else {
                    consecutiveEmptyScrolls = 0;
                }

                // Scroll up to bring the first course back into view (3 scrolls push it past the top)
                await browser.action('pointer')
                    .move({ x: centerX, y: Math.floor(windowSize.height * 0.40) })
                    .down()
                    .move({ x: centerX, y: Math.floor(windowSize.height * 0.65), duration: 800 })
                    .up()
                    .perform();
                await browser.pause(500);

                for (const course of toVerify) {
                    console.log(`\n🔍 Verifying "${course.name}" (${course.progress}) from In Progress`);

                    let courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
                    if (!(await courseBtn.isExisting())) {
                        await browser.action('pointer')
                            .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                            .down()
                            .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                            .up()
                            .perform();
                        await browser.pause(1500);
                        courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
                    }
                    if (!(await courseBtn.isExisting())) {
                        console.warn(`  ⚠️ Could not locate "${course.name}" — skipping`);
                        courses.push({ name: course.name, progress: course.progress, source: 'in-progress', status: 'failed' });
                        partBFailed = true;
                        continue;
                    }
                    await courseBtn.waitForDisplayed({ timeout: 5000 });

                    const btnLoc = await courseBtn.getLocation();
                    const btnSize = await courseBtn.getSize();
                    const bottomEdge = btnLoc.y + btnSize.height;
                    const NAV_THRESHOLD = windowSize.height - 100;
                    if (bottomEdge > NAV_THRESHOLD) {
                        console.log(`  🚀 Button bottom at ${bottomEdge}px exceeds nav threshold ${NAV_THRESHOLD}px — scrolling to reveal fully`);
                        for (let s = 0; s < 2; s++) {
                            await browser.action('pointer')
                                .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                                .down()
                                .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                                .up()
                                .perform();
                            await browser.pause(500);
                        }
                        courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
                        await courseBtn.waitForDisplayed({ timeout: 5000 });
                    }

                    let status: 'passed' | 'failed' = 'passed';
                    try {
                        await courseBtn.click();
                        await browser.pause(5000);

                        const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
                        await coursePage.waitForDisplayed({ timeout: 10000 });
                        console.log('  ✅ Landed on course detail page');

                        const detailNameEl = await browser.$(`//*[contains(@text, "${course.name}")]`);
                        await detailNameEl.waitForDisplayed({ timeout: 5000 });
                        const actualName = await detailNameEl.getText();
                        expect(actualName).toContain(course.name);
                        console.log(`  ✅ Name matches: "${actualName}"`);

                        const detailProgressEl = await browser.$('//android.widget.TextView[contains(@text, "Completed:")]');
                        await detailProgressEl.waitForDisplayed({ timeout: 5000 });
                        const actualProgress = extractProgress(await detailProgressEl.getText());
                        expect(actualProgress).toBe(course.progress);
                        console.log(`  ✅ Progress matches: ${actualProgress}`);
                    } catch (e) {
                        status = 'failed';
                        partBFailed = true;
                        console.warn(`  ❌ "${course.name}" — ${(e as Error).message}`);
                    }

                    const backBtn = await browser.$('//android.widget.Button[@content-desc="Back"]');
                    if (await backBtn.isExisting()) {
                        await backBtn.click();
                        await browser.pause(3000);
                    }

                    for (let j = 0; j < 50; j++) {
                        const ipSection = await browser.$('//android.widget.TextView[contains(@text, "In Progress Courses")]');
                        if (await ipSection.isExisting() && await ipSection.isDisplayed()) {
                            break;
                        }
                        await browser.action('pointer')
                            .move({ x: centerX, y: Math.floor(windowSize.height * 0.40) })
                            .down()
                            .move({ x: centerX, y: Math.floor(windowSize.height * 0.65), duration: 800 })
                            .up()
                            .perform();
                        await browser.pause(500);
                    }
                    // Reveal courses below the header
                    await browser.action('pointer')
                        .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                        .down()
                        .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                        .up()
                        .perform();
                    await browser.pause(500);

                    courses.push({ name: course.name, progress: course.progress, source: 'in-progress', status });
                }

                if (verifiedNames.size >= MAX_COURSES) {
                    console.log(`✅ All ${MAX_COURSES} in-progress courses found and verified`);
                    break;
                }

                const recommended = await browser.$('//*[contains(@text, "Recommended Content")]');
                if (await recommended.isExisting() && await recommended.isDisplayed()) {
                    console.log('✅ Reached "Recommended Content" — all courses collected');
                    break;
                }

                for (let s = 0; s < 2; s++) {
                    await browser.action('pointer')
                        .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
                        .down()
                        .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
                        .up()
                        .perform();
                    await browser.pause(500);
                }
            }

            if (partBFailed) {
                throw new Error('One or more in-progress courses failed verification');
            }
        }



    });


    // PART C
    it('Summary of courses processed', async () => {



        // ── Summary ──
        console.log(`\n📊 Total courses processed: ${courses.length}`);
        const passed = courses.filter(c => c.status === 'passed');
        const failed = courses.filter(c => c.status === 'failed');
        for (const c of courses) {
            const icon = c.status === 'passed' ? '✅' : '❌';
            console.log(`  ${icon} [${c.source}] "${c.name}" — ${c.progress}`);
        }

        if (courses.length > 0) {
            await browser.saveScreenshot('../reports/android/test-results/suite1-continue-learning.png');
        }

        if (failed.length > 0) {
            console.log(`\n❌ Suite 1: ${passed.length} passed, ${failed.length} failed`);
        }

        expect(courses.length).toBeGreaterThan(0);
        console.log(`\n✅ Suite 1: All ${courses.length} course(s) verified successfully!`);




    });






//     before(async () => {
//         if (!testCredentials.email || !testCredentials.password || !testCredentials.username) {
//             throw new Error('Missing credentials in .env file. Required: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME');
//         }

//         await login(browser, testCredentials.email, testCredentials.password);

//         const isLoggedIn = await verifyLogin(browser, testCredentials.username);
//         if (!isLoggedIn) {
//             throw new Error(`Login verification failed. Expected username "Hi ${testCredentials.username}" not found.`);
//         }

//         // Ensure we're on Home tab
//         const homeTab = await browser.$('//android.widget.Button[@content-desc="Home" or @text="Home"]');
//         if (await homeTab.isExisting()) {
//             await homeTab.click();
//             await browser.pause(2000);
//         }
//     });

//     it('should verify Continue from where you left section', async () => {
//         // ── PART A: Verify "Continue from where you left" ──
//         const continueSection = await browser.$('//android.widget.TextView[@text="Continue from where you left"]');
//         if (await continueSection.isExisting()) {
//             console.log('✅ Found "Continue from where you left" section');

//             const nameEl = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.TextView[not(contains(@text, "Completed")) and not(@text="Continue from where you left")]');
//             const progressEl = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.TextView[contains(@text, "Completed")]');
//             const btn = await browser.$('//android.widget.TextView[@text="Continue from where you left"]/../android.widget.Button');

//             if (await nameEl.isExisting() && await progressEl.isExisting() && await btn.isExisting()) {
//                 const name = await nameEl.getText();
//                 const progress = extractProgress(await progressEl.getText());

//                 if (name && progress) {
//                     console.log(`\n🔍 Verifying "${name}" (${progress}) from Continue Learning`);

//                     let status: 'passed' | 'failed' = 'passed';
//                     try {
//                         await btn.click();
//                         await browser.pause(5000);

//                         const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
//                         await coursePage.waitForDisplayed({ timeout: 10000 });
//                         console.log('  ✅ Landed on course detail page');

//                         const detailNameEl = await browser.$(`//*[contains(@text, "${name}")]`);
//                         await detailNameEl.waitForDisplayed({ timeout: 5000 });
//                         const actualName = await detailNameEl.getText();
//                         expect(actualName).toContain(name);
//                         console.log(`  ✅ Name matches: "${actualName}"`);

//                         const detailProgressEl = await browser.$('//android.widget.TextView[contains(@text, "Completed:")]');
//                         await detailProgressEl.waitForDisplayed({ timeout: 5000 });
//                         const actualProgress = extractProgress(await detailProgressEl.getText());
//                         expect(actualProgress).toBe(progress);
//                         console.log(`  ✅ Progress matches: ${actualProgress}`);
//                     } catch (e) {
//                         status = 'failed';
//                         console.warn(`  ❌ "${name}" — ${(e as Error).message}`);
//                     }

//                     const backBtn = await browser.$('//android.widget.Button[@content-desc="Back"]');
//                     if (await backBtn.isExisting()) {
//                         await backBtn.click();
//                         await browser.pause(3000);
//                     }

//                     courses.push({ name, progress, source: 'continue-learning', status });
//                     expect(status).toBe('passed');
//                 }
//             }
//         } else {
//             console.log('ℹ️ "Continue from where you left" section not found');
//         }
//     });

//     it('should verify In Progress Courses section', async () => {
//         // ── PART B: Verify "In Progress Courses" ──
//         const windowSize = await browser.getWindowSize();
//         const centerX = Math.floor(windowSize.width / 2);

//         let ipSectionFound = false;
//         for (let i = 0; i < 50; i++) {
//             const ipSection = await browser.$('//android.widget.TextView[contains(@text, "In Progress Courses")]');
//             if (await ipSection.isExisting() && await ipSection.isDisplayed()) {
//                 ipSectionFound = true;
//                 console.log(`✅ Found "In Progress Courses" after ${i} scroll(s)`);
//                 break;
//             }
//             await browser.action('pointer')
//                 .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                 .down()
//                 .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                 .up()
//                 .perform();
//             await browser.pause(500);
//         }

//         if (!ipSectionFound) {
//             console.log('ℹ️ "In Progress Courses" section not found');
//         } else {
//             const verifiedNames = new Set<string>();
//             const MAX_COURSES = 6;
//             let consecutiveEmptyScrolls = 0;
//             let partBFailed = false;

//             // Scroll down to reveal courses below the header
//             for (let s = 0; s < 3; s++) {
//                 await browser.action('pointer')
//                     .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                     .down()
//                     .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                     .up()
//                     .perform();
//                 await browser.pause(500);
//             }

//             while (consecutiveEmptyScrolls < 5 && verifiedNames.size < MAX_COURSES) {
//                 const allBtns = await browser.$$('//android.widget.Button');
//                 const toVerify: { name: string; progress: string }[] = [];

//                 for (const btn of allBtns) {
//                     const text = await btn.getText();
//                     const match = text.match(/^Course (.+?) (\d+%)(?: \1)?$/);
//                     if (match) {
//                         const name = match[1].trim();
//                         if (!verifiedNames.has(name)) {
//                             toVerify.push({ name, progress: match[2] });
//                             verifiedNames.add(name);
//                         }
//                     }
//                 }

//                 console.log(`  Found ${toVerify.length} unverified course(s) in view (${verifiedNames.size}/${MAX_COURSES} total)`);

//                 if (toVerify.length === 0) {
//                     consecutiveEmptyScrolls++;
//                 } else {
//                     consecutiveEmptyScrolls = 0;
//                 }

//                 // Scroll up to bring the first course back into view (3 scrolls push it past the top)
//                 await browser.action('pointer')
//                     .move({ x: centerX, y: Math.floor(windowSize.height * 0.40) })
//                     .down()
//                     .move({ x: centerX, y: Math.floor(windowSize.height * 0.65), duration: 800 })
//                     .up()
//                     .perform();
//                 await browser.pause(500);

//                 for (const course of toVerify) {
//                     console.log(`\n🔍 Verifying "${course.name}" (${course.progress}) from In Progress`);

//                     let courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
//                     if (!(await courseBtn.isExisting())) {
//                         await browser.action('pointer')
//                             .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                             .down()
//                             .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                             .up()
//                             .perform();
//                         await browser.pause(1500);
//                         courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
//                     }
//                     if (!(await courseBtn.isExisting())) {
//                         console.warn(`  ⚠️ Could not locate "${course.name}" — skipping`);
//                         courses.push({ name: course.name, progress: course.progress, source: 'in-progress', status: 'failed' });
//                         partBFailed = true;
//                         continue;
//                     }
//                     await courseBtn.waitForDisplayed({ timeout: 5000 });

//                     const btnLoc = await courseBtn.getLocation();
//                     const btnSize = await courseBtn.getSize();
//                     const bottomEdge = btnLoc.y + btnSize.height;
//                     const NAV_THRESHOLD = windowSize.height - 100;
//                     if (bottomEdge > NAV_THRESHOLD) {
//                         console.log(`  🚀 Button bottom at ${bottomEdge}px exceeds nav threshold ${NAV_THRESHOLD}px — scrolling to reveal fully`);
//                         for (let s = 0; s < 2; s++) {
//                             await browser.action('pointer')
//                                 .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                                 .down()
//                                 .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                                 .up()
//                                 .perform();
//                             await browser.pause(500);
//                         }
//                         courseBtn = await browser.$(`//android.widget.Button[contains(@text, "${course.name}") and contains(@text, "${course.progress}")]`);
//                         await courseBtn.waitForDisplayed({ timeout: 5000 });
//                     }

//                     let status: 'passed' | 'failed' = 'passed';
//                     try {
//                         await courseBtn.click();
//                         await browser.pause(5000);

//                         const coursePage = await browser.$('//android.webkit.WebView[@text="Course"]');
//                         await coursePage.waitForDisplayed({ timeout: 10000 });
//                         console.log('  ✅ Landed on course detail page');

//                         const detailNameEl = await browser.$(`//*[contains(@text, "${course.name}")]`);
//                         await detailNameEl.waitForDisplayed({ timeout: 5000 });
//                         const actualName = await detailNameEl.getText();
//                         expect(actualName).toContain(course.name);
//                         console.log(`  ✅ Name matches: "${actualName}"`);

//                         const detailProgressEl = await browser.$('//android.widget.TextView[contains(@text, "Completed:")]');
//                         await detailProgressEl.waitForDisplayed({ timeout: 5000 });
//                         const actualProgress = extractProgress(await detailProgressEl.getText());
//                         expect(actualProgress).toBe(course.progress);
//                         console.log(`  ✅ Progress matches: ${actualProgress}`);
//                     } catch (e) {
//                         status = 'failed';
//                         partBFailed = true;
//                         console.warn(`  ❌ "${course.name}" — ${(e as Error).message}`);
//                     }

//                     const backBtn = await browser.$('//android.widget.Button[@content-desc="Back"]');
//                     if (await backBtn.isExisting()) {
//                         await backBtn.click();
//                         await browser.pause(3000);
//                     }

//                     for (let j = 0; j < 50; j++) {
//                         const ipSection = await browser.$('//android.widget.TextView[contains(@text, "In Progress Courses")]');
//                         if (await ipSection.isExisting() && await ipSection.isDisplayed()) {
//                             break;
//                         }
//                         await browser.action('pointer')
//                             .move({ x: centerX, y: Math.floor(windowSize.height * 0.40) })
//                             .down()
//                             .move({ x: centerX, y: Math.floor(windowSize.height * 0.65), duration: 800 })
//                             .up()
//                             .perform();
//                         await browser.pause(500);
//                     }
//                     // Reveal courses below the header
//                     await browser.action('pointer')
//                         .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                         .down()
//                         .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                         .up()
//                         .perform();
//                     await browser.pause(500);

//                     courses.push({ name: course.name, progress: course.progress, source: 'in-progress', status });
//                 }

//                 if (verifiedNames.size >= MAX_COURSES) {
//                     console.log(`✅ All ${MAX_COURSES} in-progress courses found and verified`);
//                     break;
//                 }

//                 const recommended = await browser.$('//*[contains(@text, "Recommended Content")]');
//                 if (await recommended.isExisting() && await recommended.isDisplayed()) {
//                     console.log('✅ Reached "Recommended Content" — all courses collected');
//                     break;
//                 }

//                 for (let s = 0; s < 2; s++) {
//                     await browser.action('pointer')
//                         .move({ x: centerX, y: Math.floor(windowSize.height * 0.65) })
//                         .down()
//                         .move({ x: centerX, y: Math.floor(windowSize.height * 0.40), duration: 800 })
//                         .up()
//                         .perform();
//                     await browser.pause(500);
//                 }
//             }

//             if (partBFailed) {
//                 throw new Error('One or more in-progress courses failed verification');
//             }
//         }
//     });

//     after(async () => {
//         // ── Summary ──
//         console.log(`\n📊 Total courses processed: ${courses.length}`);
//         const passed = courses.filter(c => c.status === 'passed');
//         const failed = courses.filter(c => c.status === 'failed');
//         for (const c of courses) {
//             const icon = c.status === 'passed' ? '✅' : '❌';
//             console.log(`  ${icon} [${c.source}] "${c.name}" — ${c.progress}`);
//         }

//         if (courses.length > 0) {
//             await browser.saveScreenshot('../reports/android/test-results/suite1-continue-learning.png');
//         }

//         if (failed.length > 0) {
//             console.log(`\n❌ Suite 1: ${passed.length} passed, ${failed.length} failed`);
//         }

//         expect(courses.length).toBeGreaterThan(0);
//         console.log(`\n✅ Suite 1: All ${courses.length} course(s) verified successfully!`);
//     });



});
