export async function dismissOnboarding(browser: WebDriverIO.Browser) {
    const skipBtn = await browser.$('//*[@text="Skip onboarding"]');
    if (await skipBtn.isExisting() && await skipBtn.isDisplayed()) {
        await skipBtn.click();
        await browser.pause(2000);
        console.log('✅ Onboarding skipped');
    }
}