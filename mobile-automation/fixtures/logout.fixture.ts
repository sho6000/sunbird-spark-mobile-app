/**
 * Logout Fixture - Reusable logout helper for Sunbird Spark App
 * Navigates to Profile tab, scrolls to Sign Out button, and verifies logout
 */

export async function logout(browser: WebdriverIO.Browser): Promise<boolean> {
  try {
    const profileTab = await browser.$('//android.widget.Button[@content-desc="Profile" or @text="Profile"]');
    await profileTab.click();
    await browser.pause(2000);

    await browser.saveScreenshot('../reports/android/test-results/profile-before-logout.png');

    const signOutButton = await browser.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Logout"))');
    const isSignOutVisible = await signOutButton.isExisting().catch(() => false);

    if (isSignOutVisible) {
      await signOutButton.click();
      await browser.pause(3000);

      await browser.saveScreenshot('../reports/android/test-results/after-signout.png');

      const homeTab = await browser.$('//android.widget.Button[@content-desc="Home" or @text="Home"]');
      if (await homeTab.isExisting()) {
        await homeTab.click();
        await browser.pause(2000);
      }

      const userGreeting = await browser.$(`//android.widget.TextView[contains(@text, "Hi ")]`);
      const isGreetingVisible = await userGreeting.isExisting().catch(() => false);

      if (!isGreetingVisible) {
        console.log('✅ Successfully logged out - user greeting no longer present');
        return true;
      } else {
        console.warn('Logout verification failed - user greeting still present');
        return false;
      }
    } else {
      console.warn('Sign Out button not found after scrolling');
      await browser.saveScreenshot('../reports/android/test-results/signout-not-found.png');
      return false;
    }
  } catch (error) {
    console.error(`Logout failed: ${error}`);
    await browser.saveScreenshot('../reports/android/test-results/logout-error.png').catch(() => {});
    throw error;
  }
}
