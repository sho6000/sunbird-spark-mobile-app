#!/usr/bin/env bash
set -euo pipefail

# Navigate to wdio config dir relative to this script's location
cd "$(dirname "$0")/../mobile-automation/config"

# Set screen size and density for CI emulator
adb shell wm size 1080x2160
adb shell wm density 440
sleep 2

SCOPE="${SCOPE:-all}"
SPEC="${SPEC:-}"

if [ -n "$SPEC" ]; then
  echo "Running single spec: $SPEC"
  npx wdio run ./wdio.conf.ts --spec "../$SPEC"
elif [ "$SCOPE" = "anonymous" ]; then
  echo "Running anonymous suites only"
  npx wdio run ./wdio.conf.ts \
    --spec "../specs/android/anonymous_user_consumption/suite0-dismiss-onboarding.e2e.ts" \
    --spec "../specs/android/anonymous_user_consumption/suite1-guest-home-and-explore-browsing.e2e.ts" \
    --spec "../specs/android/anonymous_user_consumption/suite2-guest-multi-format-player.e2e.ts" \
    --spec "../specs/android/anonymous_user_consumption/suite3-guest-content-details-and-login-redirect.e2e.ts"
elif [ "$SCOPE" = "consumption" ]; then
  echo "Running consumption suites only"
  npx wdio run ./wdio.conf.ts \
    --spec "../specs/android/consumption/suite1-home-in-progress-courses.e2e.ts" \
    --spec "../specs/android/consumption/suite2-explore-content-filtering.e2e.ts" \
    --spec "../specs/android/consumption/suite3-multi-format-content-player.e2e.ts" \
    --spec "../specs/android/consumption/suite4-course-enrollment-and-progress.e2e.ts" \
    --spec "../specs/android/consumption/suite5-certificate-preview-and-download.e2e.ts" \
    --spec "../specs/android/consumption/suite6-my-learning-cross-verification.e2e.ts" \
    --spec "../specs/android/consumption/suite8-profile-data-consent-toggle.e2e.ts"
else
  echo "Running all suites"
  npm run wdio
fi
