import { dismissOnboarding } from '../../../fixtures/onboarding.fixture';

describe('Suite 0: Dismiss Onboarding', () => {

    // run screenshot
    it('should capture screenshot before home screen', async () => {
        await browser.saveScreenshot('../reports/android/test-results/suite0-before-home.png');
        // Save or log the screenshot as needed
        console.log('📸 Screenshot captured')
        });


    it('should dismiss onboarding if present', async () => {
        await dismissOnboarding(browser);
    });

    // run screenshot
    it('should capture screenshot after home screen', async () => {
        await browser.saveScreenshot('../reports/android/test-results/suite0-after-home.png');
        // Save or log the screenshot as needed
        console.log('📸 Screenshot captured')
        });
    

});
