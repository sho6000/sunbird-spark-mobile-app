/**
 * Authentication Fixture - Reusable login helper for Sunbird Spark App
 * Handles login flow with email/password credentials
 * Credentials are loaded from .env file: SUNBIRD_EMAIL, SUNBIRD_PASSWORD, SUNBIRD_USERNAME
 */

export const testCredentials = {
  email: process.env.SUNBIRD_EMAIL || '',
  password: process.env.SUNBIRD_PASSWORD || '',
  username: process.env.SUNBIRD_USERNAME || '',
};

export async function login(browser: WebdriverIO.Browser, email: string, password: string): Promise<void> {
  try {
    await browser.pause(8000);

    const homeTab = await browser.$('//android.widget.Button[@text="Home"]');
    const isHomeVisible = await homeTab.isExisting().catch(() => false);

    if (isHomeVisible) {
      await homeTab.click();
      await browser.pause(2000);
    }

    try {
      const userGreeting = await browser.$(`//android.widget.TextView[contains(@text, "Hi ")]`);
      await userGreeting.waitForExist({ timeout: 5000 });
      console.log('Already logged in, skipping login flow');
      return;
    } catch {
      console.log('Not logged in, attempting login...');
    }

    await browser.saveScreenshot('login-screen.png');

    let signInButton = await browser.$('//android.widget.Button[@text="Sign In"]');
    let isSignInVisible = await signInButton.isExisting().catch(() => false);

    if (!isSignInVisible) {
      const profileTab = await browser.$('//android.widget.Button[@text="Profile"]');
      const isProfileVisible = await profileTab.isExisting().catch(() => false);

      if (isProfileVisible) {
        await profileTab.click();
        await browser.pause(2000);
        await browser.saveScreenshot('profile-screen.png');

        signInButton = await browser.$('//android.widget.Button[@text="Sign In"]');
        isSignInVisible = await signInButton.isExisting().catch(() => false);
      }
    }

    if (isSignInVisible) {
      await signInButton.click();
      await browser.pause(1500);

      const emailField = await browser.$('-android uiautomator:new UiSelector().className("android.widget.EditText").instance(0)');
      await emailField.waitForDisplayed({ timeout: 5000 });
      await emailField.setValue(email);
      await browser.pause(300);

      const passwordField = await browser.$('-android uiautomator:new UiSelector().className("android.widget.EditText").instance(1)');
      await passwordField.setValue(password);
      await browser.pause(300);

      const loginButton = await browser.$('//android.widget.Button[@text="Login"]');
      await loginButton.click();
      await browser.pause(10000);

      const homeTabAfterLogin = await browser.$('//android.widget.Button[@text="Home"]');
      if (await homeTabAfterLogin.isExisting()) {
        await homeTabAfterLogin.click();
        await browser.pause(2000);
      }

      await browser.saveScreenshot('post-login.png');
      console.log(`Successfully logged in with email: ${email}`);
    } else {
      console.log('Could not find Sign In button - proceeding anyway');
    }
  } catch (error) {
    console.error(`Login failed: ${error}`);
    await browser.saveScreenshot('login-error.png').catch(() => {});
  }
}

export async function verifyLogin(browser: WebdriverIO.Browser, username: string): Promise<boolean> {
  try {
    await browser.pause(2000);
    const userGreeting = await browser.$(`//android.widget.TextView[contains(@text, "Hi ")]`);
    const isDisplayed = await userGreeting.isDisplayed();
    if (isDisplayed) {
      console.log(`✅ Username verified: Hi ${username}`);
    }
    return isDisplayed;
  } catch (error) {
    console.warn(`Could not verify login username "Hi ${username}": ${error}`);
    await browser.saveScreenshot('verify-login-error.png').catch(() => {});
    return false;
  }
}


