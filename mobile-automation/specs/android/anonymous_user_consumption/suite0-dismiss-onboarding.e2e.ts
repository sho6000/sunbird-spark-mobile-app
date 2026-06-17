import { dismissOnboarding } from '../../../fixtures/onboarding.fixture';

describe('Suite 0: Dismiss Onboarding', () => {

    it('should dismiss onboarding if present', async () => {
        await dismissOnboarding(browser);
    });
    

});
