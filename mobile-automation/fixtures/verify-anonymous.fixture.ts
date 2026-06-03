export async function verifyAnonymous(browser: WebdriverIO.Browser): Promise<boolean> {
    const profileTab = await browser.$('//android.widget.Button[@content-desc="Profile"]');
    await profileTab.click();
    await browser.pause(2000);

    const signInBtn = await browser.$('//*[@text="Sign In"]');
    return await signInBtn.isExisting();
}

export async function assertNoLoginPrompt(browser: WebdriverIO.Browser): Promise<void> {
    const signIn = await browser.$('//*[@text="Sign In"]');
    expect(await signIn.isExisting()).toBe(false);
}
