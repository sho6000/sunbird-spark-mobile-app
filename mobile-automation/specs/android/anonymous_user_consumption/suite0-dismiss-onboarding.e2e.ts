import { dismissOnboarding } from '../../../fixtures/onboarding.fixture';

describe('Suite 0: Dismiss Onboarding', () => {

    it('should dismiss onboarding if present', async () => {
        await dismissOnboarding(browser);
    });

    after('Summary of discovered content', async () => {
    

        await browser.saveScreenshot('../reports/android/test-results/suite0-home-after.png');

    
    });
    

});
