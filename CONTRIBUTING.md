<!-- omit in toc -->
# Spark Mobile Contributing Guide

First off, thanks for taking the time to contribute! ❤️

This repository is the **Sunbird Spark mobile app** — React 19 + Ionic 8 with Capacitor 8 as the native bridge, built with Vite 7. It runs natively on **Android only**

It's an offline-first app: content downloads as `.ecar` packages to device storage with metadata in SQLite, players render from local files without a network, and telemetry is staged offline and synced in batches. That shapes most of what's below.

The general contribution process is the same across the [Sunbird Spark organisation](https://github.com/Sunbird-Spark). Everything here is specific to this repository.

<!-- omit in toc -->
## Table of Contents

<!-- - [Code of Conduct](#code-of-conduct) -->
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Before You Start](#before-you-start)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving The Documentation](#improving-the-documentation)
- [Contribution Standards](#contribution-standards)
  - [Using AI Tools](#using-ai-tools)
- [Styleguides](#styleguides)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [What Happens After You Submit](#what-happens-after-you-submit)

<!-- ## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Report unacceptable behaviour to TODO_CONTACT_EMAIL.

Before uncommenting: add CODE_OF_CONDUCT.md to this repository and replace TODO_CONTACT_EMAIL. -->

## I Have a Question

Check the [README](README.md) first — it covers the tech stack, prerequisites and the full Android setup. Then search existing [Issues](https://github.com/Sunbird-Spark/sunbird-spark-mobile-app/issues) and [Discussions](https://github.com/orgs/Sunbird-Spark/discussions).

If you still need help, open a thread in [Discussions](https://github.com/orgs/Sunbird-Spark/discussions). Include your Node and JDK versions, your Android Studio and SDK versions, whether you're on an emulator or a physical device, and the exact error.

## I Want To Contribute

> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content, and that the content you contribute may be provided under the project licence.

### Before You Start

Create a copy of, and fill in, the [**Sunbird Contribution Checklist**](https://docs.google.com/spreadsheets/d/1k0x3NEBvQAAEAm6WZzG3RqmzNnX9U8ywABjc4pKfttg/edit?usp=sharing). Share the filled-in copy with the maintainer so you're aligned before you write code.

**When it's needed:** for features, bug fixes with code changes, and anything touching APIs, native configuration or the build. Small documentation edits, typo fixes and single-line corrections don't need one — open the PR and describe what you changed.

### Reporting Bugs

Before reporting, search the [issue tracker](https://github.com/Sunbird-Spark/sunbird-spark-mobile-app/issues?q=label%3Abug) and confirm it isn't a setup problem — an unfilled `gradle.properties` or a missing `google-services.json` produces failures that look like app bugs.

> Never report security issues publicly. Use the **Security → Report a vulnerability** tab, and give maintainers a reasonable window to fix and release before disclosing.

[Open a bug report](https://github.com/Sunbird-Spark/sunbird-spark-mobile-app/issues/new/choose). Because this is an offline-first app, always say **whether the device was online or offline**, and include your Android version, device or emulator model, and app version. Attach `adb logcat` output for native crashes.

### Suggesting Enhancements

Check the [README](README.md) first, and bear in mind that anything touching content playback, download or telemetry has to work offline as well as online.

[Open a feature request](https://github.com/Sunbird-Spark/sunbird-spark-mobile-app/issues/new/choose) describing the problem it solves, who benefits, and alternatives you've considered. **For features, agree the approach on the issue before writing significant code.**

### Your First Code Contribution

**1. Pick something and claim it.** Filter issues by `good first issue` and `help wanted`, then comment to say you're taking it.

**2. Fork, clone and run it.**

Install **Node 24.12.0** — that's what CI runs, and nothing in the repo enforces a version locally, so matching CI avoids failures you can't reproduce. For Android builds you also need Android Studio, the Android SDK at compileSdk 36, and JDK 17 or later — Gradle 8.13 comes from the wrapper, so don't install it separately.

```bash
# Fork on GitHub, then:
git clone https://github.com/<your-username>/sunbird-spark-mobile-app.git
cd sunbird-spark-mobile-app
git remote add upstream https://github.com/Sunbird-Spark/sunbird-spark-mobile-app.git

npm install
```

`npm install` runs two postinstall scripts: `copy-assets.js`, which copies the PDF, Video, ePub and QuML player assets out of `node_modules/@project-sunbird/*`, and `scripts/copyContentPlayer.js`, which assembles the content player into `public/content-player/`. **If either fails, stop and fix it** — the app will build but content won't render.

Then point the app at a backend. `android/gradle.properties` is **tracked in the repository** and ships with placeholder values; release builds overwrite it in CI with real credentials. For local development you edit it in place:

```bash
# android/gradle.properties — fill in for local use
base_url=https://your-sunbird-backend.org
mobile_app_key=<your-api-key>
mobile_app_secret=<your-api-secret>
```

**Your filled-in version must never be committed.** Because the file is tracked, `git add .` will pick it up. Tell git to ignore your local changes to it:

```bash
git update-index --skip-worktree android/gradle.properties
```

Check `git diff --stat` before every push regardless. If you genuinely need to change the committed placeholders — adding a new property, say — undo that with `--no-skip-worktree`, commit only the placeholder form, and never real values.

Add your `google-services.json` to `android/app/` for push notifications. That one **is** gitignored. Without `gradle.properties` filled in, the app builds but won't reach a backend.

Build and run:

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug && cd ..
```

The debug APK lands in `android/app/build/outputs/apk/debug/`. `npx cap open android` opens the project in Android Studio, and `npm run livereload` gives you hot reload on a connected device.

For web-only UI work, `npm run dev` is much faster — but anything touching filesystem storage, SQLite or native plugins has to be tested on a device or emulator.

If setup fails, it's usually a JDK below 17, a postinstall script that didn't complete, unfilled `gradle.properties` values, or stale build artifacts — `./gradlew clean assembleDebug` clears the last of those. **If the README didn't work as written, open an issue** with your versions and the exact error, then consider fixing it.

**3. Branch and build.** Branch from the latest release branch — check the branch list for the current one; don't branch from `main`. Keep the change to one logical unit.

**4. Code sanity.**

- Lint, type checks, build and tests pass locally:
  ```bash
  npm run lint && npm run type-check && npm run build && npm run test:run
  ```
- New or updated tests cover the behaviour you changed. Coverage thresholds are **70%** for branches, functions, lines and statements — `npm run test:coverage` shows where you stand.
- Formatting is checked, not auto-applied: `npm run format` reports problems, `npm run format:write` fixes them.
- Accessibility lint rules (`jsx-a11y`) apply to all JSX. Don't silence them — the app is used on low-end devices by people with a wide range of needs.
- `@typescript-eslint/no-explicit-any` is a warning here rather than an error, but new `any` still needs justification.
- Dependency vulnerability scan run on any added or upgraded packages. `npm run snyk` is wired up if you have a Snyk account.
- **No real credentials in the diff.** Check `android/gradle.properties` holds only placeholders, and never commit `google-services.json`, keystores, or any `*.jks`, `*.keystore`, `*.pem` or `*.key` file.
- Don't change the app ID, `applicationId` or signing configuration in a contribution. The first AAB uploaded to Play Console permanently locks the signing keystore for that app ID.

**Before opening the PR:**

- [ ] Opened against the latest release branch, not `main`
- [ ] Issue linked, and you commented on it to say you're taking it
- [ ] Tested on a device or emulator, not only in the browser, if the change touches storage, SQLite, telemetry or native plugins
- [ ] Tested offline as well as online, if the change touches content download, playback or telemetry
- [ ] Documentation updated — anything your change made wrong, plus setup and configuration docs for anything you added
- [ ] Schema and architecture documentation added or updated using the [TEMPLATE](https://docs.google.com/document/d/1YqUzR09a5t_ebkMsCaW7juf1gZgXLudQlkYJF0jl4hY/edit?usp=sharing), if your change affects system design
- [ ] **If you added or changed user-facing text, translations updated for all five locales** — English, Hindi, French, Portuguese and Arabic. Arabic is RTL; check the layout doesn't break.
- [ ] Your filled-in copy of the Sunbird Contribution Checklist is complete, with details rather than just ticks, and ready to attach

### Improving The Documentation

Documentation fixes are real contributions and an ideal first one — whatever tripped you up during setup is a genuine bug. Android setup has the most moving parts here, so it's the most valuable thing to improve.

- **Where:** this repository's `README.md` for setup and architecture; the [documentation site](https://sunbird.gitbook.io/sunbird-spark) for user-facing content.
- **Voice:** plain, direct, active. Write for someone competent who has never built an Android app before.
- **Accessibility:** descriptive link text, alt text on images, real heading levels.
- **Inclusive language:** avoid idioms that don't translate and assumptions about the reader's device or connection.
- Update the docs in the same change that made them wrong.

## Contribution Standards

Spark is a digital public good, deployed as national-scale infrastructure. That shapes what good code means here:

1. **Serve the public-good mission** — benefit adopters broadly, not one implementation's immediate need. Refer to the [DPG standard](https://www.digitalpublicgoods.net/standard).
2. **Uphold platform independence** — keep changes modular, and make any licensed component swappable by adopters.
3. **Protect privacy as policy, not just code** — never commit, hardcode or expose personal data. Telemetry stored on-device is still user data.
4. **Do no harm by design** — this app runs on low-end Android devices, often offline, for users across five languages including a right-to-left one. Performance, offline behaviour, accessibility and translation aren't extras here.
5. **Write for people outside your team** — Sunbird's value comes from adoption.
6. **Treat documentation as part of the contribution.**
7. **Follow the repository for mechanics** — the README carries the detail.

### Using AI Tools

Welcome, with conditions:

- **Understand what you submit.** If you can't explain and debug it in review, don't open the PR.
- **Attribute it.** Add `Assisted-by: <tool name>` for substantially AI-generated code — not `Co-authored-by:`, which implies a human contributor with authorship rights.
- **Licence hygiene applies.** Output must comply with the provider's terms, infringe nobody's IP, and must not include code under licences incompatible with MIT.
- **Tests and documentation are still required.**

## Styleguides

**Branches:** `<type>/<short-description>` — `feat/offline-download-retry`, `fix/rtl-header-overlap`, `docs/android-prereqs`.

**Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `perf:`.

```bash
git fetch upstream
git checkout -b fix/rtl-header-overlap upstream/v1.1.1   # use the current working branch
git commit -m "fix: stop header overlapping in RTL layouts"
```

Keep commits small and atomic, and explain **why**, not just what.

## Submitting a Pull Request

Push your branch and open the PR against the latest release branch of `Sunbird-Spark/sunbird-spark-mobile-app` — check the repository for the current one rather than assuming. GitHub defaults the base branch to `main`, so you will need to change it.

The pull request template asks for what changed, why, how you tested it, and anything a reviewer should look at closely. Say which device or emulator and Android version you tested on, and include screenshots or a screen recording for UI changes — for RTL changes, show both directions. Tag the reviewer or repo owner, and link the GitHub issue and the Jira ticket if applicable.

If you touched authentication, credential handling, telemetry, or anything reading native settings, say so and ask for a security-focused review.

## What Happens After You Submit

**1. Automated checks.** [PR Checks](.github/workflows/pull-request.yml) runs two jobs on Node 24.12.0: `npm run lint`, and `npm run test:coverage` with results uploaded to Codecov. A [dependency submission](.github/workflows/dependency-submission.yml) workflow feeds the dependency graph that vulnerability alerts are based on. APK and AAB builds run from separate workflows on tag pushes, not on pull requests.

Run the checks locally before pushing either way — they're the same commands, and a reviewer shouldn't be the first to find a lint error.

**2. Triage.** A maintainer labels the PR and assigns a reviewer. If you haven't heard anything within a week, nudge on the PR or in [Discussions](https://github.com/orgs/Sunbird-Spark/discussions) — a reminder is welcome, not annoying.

**3. Review.** Expect comments, and expect a few rounds. Push follow-up commits to the same branch rather than opening a replacement PR, and reply to each comment. Disagreeing is fine; say why. If the branch falls behind, `git fetch upstream && git rebase upstream/v1.1.1`.

**4. Approval and merge.** At least one maintainer approval is required, with all comments resolved and CI green. A maintainer merges — contributors don't merge their own PRs.

**After merge.** Your change sits on the working version branch while `main` stays untouched. When that version is released, `main` is updated to it and becomes the stable version, and a new working branch is created for the next release. So your change ships when its version is released.

> [!NOTE]
> **If your PR is closed without merging,** it's usually scope, direction, or inactivity. The maintainer should say which — ask if it isn't clear.

<!-- omit in toc -->
## Licensing

This repository is licensed under MIT, in line with the DPG code licence. By contributing, you agree your contribution is licensed under the repository's [LICENSE](LICENSE).