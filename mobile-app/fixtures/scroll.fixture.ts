export async function scrollUntilText(
  browser: WebdriverIO.Browser,
  targetText: string,
  clickWhenFound: boolean = true
): Promise<boolean> {
  try {
    const windowSize = await browser.getWindowSize();
    const centerX = Math.floor(windowSize.width / 2);

    for (let i = 0; i < 50; i++) {
      await browser.action('pointer')
        .move({ x: centerX, y: Math.floor(windowSize.height * 0.55) })
        .down()
        .move({ x: centerX, y: Math.floor(windowSize.height * 0.50) })
        .up()
        .perform();
      await browser.pause(500);

      const element = await browser.$(`//*[contains(@text, "${targetText}")]`);
      if (await element.isExisting() && await element.isDisplayed()) {
        console.log(`✅ Found "${targetText}" after ${i + 1} scroll(s)`);
        if (clickWhenFound) {
          await element.click();
        }
        return true;
      }
    }

    console.warn(`"${targetText}" not found after scrolling`);
    return false;
  } catch (error) {
    console.error(`scrollUntilText failed: ${error}`);
    return false;
  }
}
