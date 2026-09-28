## What changed

<!-- A sentence or two on the change itself. -->

## Why

Fixes #<!-- issue number -->

- [ ] I commented on the issue to say I was taking it

## How this was tested

**Tested on:** <!-- device or emulator, Android version, app build -->

<!--
What you tested, how, and the outcome. Include test output where relevant.
For UI changes, add before/after screenshots or a screen recording.
For RTL changes, show both directions.
-->

- [ ] Tested on a device or emulator, not only in the browser
- [ ] Tested offline as well as online <!-- if this touches download, playback or telemetry -->

## Anything a reviewer should look at closely

<!-- Tag the reviewer or repo owner. Leave blank if nothing stands out. -->

## Contribution Checklist

Link to your filled-in copy: <!-- paste here -->

## Before review

- [ ] Opened against the latest release branch, not `main`
- [ ] `npm run lint`, `npm run type-check`, `npm run build` and `npm run test:run` pass
- [ ] Tests added or updated; coverage still meets the 70% thresholds
- [ ] `npm run format` reports no problems
- [ ] No accessibility lint rules silenced
- [ ] Dependency vulnerability scan run, if packages were added or upgraded

## Secrets and native config

- [ ] `android/gradle.properties` holds only placeholder values in this diff — no real `base_url`, key or secret
- [ ] No `google-services.json`, keystore or `*.jks` / `*.keystore` / `*.pem` / `*.key` file in the diff
- [ ] No change to the app ID, `applicationId` or signing configuration

<!--
android/gradle.properties is TRACKED, not gitignored — it ships with placeholders and
CI overwrites it with real credentials at build time. So your locally filled-in copy
will be picked up by `git add .` unless you ran:

    git update-index --skip-worktree android/gradle.properties

Check `git diff` on that file before pushing.
-->

## Translations

- [ ] Not applicable — this PR adds or changes no user-facing text
- [ ] Updated for all five locales (English, Hindi, French, Portuguese, Arabic), and the RTL layout still holds

## Security

- [ ] This change touches authentication, credential handling, telemetry, or native settings

<!-- If checked, say what below and ask for a security-focused review. -->

<!--
Used AI tools? Declare them on the Contribution Checklist, and add an
`Assisted-by: <tool name>` commit trailer for substantially AI-generated code.
-->