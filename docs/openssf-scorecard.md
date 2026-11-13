# OpenSSF Scorecard Assessment

**Repository:** `github.com/Sunbird-Spark/sunbird-spark-mobile-app`
**Commit assessed:** `e5c701c` (`main`)
**Date:** 2026-10-30
**Tool:** [OpenSSF Scorecard](https://github.com/ossf/scorecard) (`gcr.io/openssf/scorecard:stable`)

## Overall score: 5.5 / 10 → ~6.9 / 10 after the fixes below

| Score | Check | Risk | Result |
|---:|---|---|---|
| 0 | Vulnerabilities | High | 132 known vulnerabilities in dependencies |
| 0 → **10** | Token-Permissions | High | Workflow tokens had excessive permissions. **Fixed.** |
| 0 | Branch-Protection | High | Branch protection not enabled for `main` |
| 0 → **10** | Security-Policy | Medium | No `SECURITY.md`. **Fixed.** |
| 0 | Fuzzing | Medium | No fuzzer integration |
| 0 | CII-Best-Practices | Low | No OpenSSF Best Practices badge |
| 3 | CI-Tests | Low | 3 of the last 10 merged PRs ran CI tests |
| 7 | SAST | Medium | 23 of the last 30 commits were checked by a SAST tool |
| 8 | Code-Review | High | 8 of the last 10 changesets were approved |
| 8 | Pinned-Dependencies | Medium | 0 of 16 GitHub-owned actions pinned by hash |
| 9 | Binary-Artifacts | High | `android/gradle/wrapper/gradle-wrapper.jar` |
| 10 | Contributors | Low | Pass |
| 10 | Dangerous-Workflow | Critical | Pass |
| 10 | Dependency-Update-Tool | High | Pass (Dependabot) |
| 10 | License | Low | Pass |
| 10 | Maintained | High | Pass |
| – | Packaging | Medium | Not applicable (no publishing workflow) |
| – | Signed-Releases | High | Not applicable (no GitHub releases) |

The overall score is a risk-weighted average, so fixing a **High** check moves it more than fixing a **Low** one.

### Progress

| Date | Change | Verified by | Score |
|---|---|---|---|
| 2026-10-30 | Baseline scan of `main` (`e5c701c`) | Scorecard against GitHub | 5.5 |
| 2026-10-30 | Steps 1 and 2: read-only workflow permissions, `SECURITY.md` | Scorecard `--local` on the working copy: Token-Permissions 10, Security-Policy 10 | ~6.9 (estimated) |

The ~6.9 is calculated from Scorecard's risk weights with every other check unchanged. The published score only updates after these changes are merged to `main` and Scorecard runs against GitHub again.

## How to improve the score

These are ordered by impact relative to effort.

### 1. Token-Permissions (0 → 10, High): ✅ done

Added `permissions: contents: read` at the top of `build-aab.yml`, `build-apk.yml` and `pull-request.yml`. None of their steps write to the repository, and Codecov uploads with its own token. `dependency-submission.yml` was left as it is: its two job-level `contents: write` grants are still needed, and the check scores 10 with them.

Original findings:
- `build-aab.yml`, `build-apk.yml` and `pull-request.yml` define no top-level `permissions:` block.
- `dependency-submission.yml` grants `contents: write` at job level (lines 18 and 47).

Fix: add a read-only default at the top of every workflow, and grant write access only to the jobs that need it:

```yaml
permissions:
  contents: read
```

The dependency-submission jobs need `contents: write` to call the dependency-graph API. Scorecard still flags job-level `contents: write`. If that one warning remains, the check should still score well above 0.

### 2. Security-Policy (0 → 10, Medium): ✅ done

Added [`SECURITY.md`](../SECURITY.md), which points reporters to GitHub private vulnerability reporting, as `CONTRIBUTING.md` already does. **Admin action still needed:** enable **Settings → Code security → Private vulnerability reporting** so the "Report a vulnerability" button appears.

Original recommendation: add a `SECURITY.md` at the repo root (or `.github/SECURITY.md`). It should say how to report a vulnerability privately (for example, GitHub private vulnerability reporting or a security email address), which versions are supported, and the expected response time. Also enable **Settings → Code security → Private vulnerability reporting**.

### 3. Pinned-Dependencies (8 → 10, Medium): small change

All 13 third-party actions are already pinned by hash. The 16 GitHub-owned actions (`actions/checkout`, `actions/setup-node`, `actions/setup-java`, `actions/upload-artifact`, etc.) are pinned only by tag. Pin each one to a full commit SHA and keep the tag in a comment:

```yaml
- uses: actions/checkout@<full-commit-sha> # v4.2.2
```

Dependabot can keep SHA-pinned actions up to date, but `.github/dependabot.yml` currently covers only `npm` and `gradle`. Add a `github-actions` entry:

```yaml
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Binary-Artifacts (9 → 10, High): small change

The only binary is `android/gradle/wrapper/gradle-wrapper.jar`, which is expected in a Gradle project. Scorecard does not count it if the wrapper is validated in CI. Add this step after checkout in the PR and build workflows:

```yaml
- uses: gradle/actions/wrapper-validation@<sha> # v4
```

### 5. Branch-Protection (0 → up to 10, High): repository settings, needs an admin

Enable a branch protection rule or ruleset on `main` that:
- requires pull requests with at least 1 approval (2 for the top tier),
- dismisses stale approvals and requires review from code owners,
- requires status checks to pass (the PR workflow),
- blocks force pushes and deletions,
- applies to administrators too.

Note: Scorecard can only read some protection settings with an admin token. Before changing anything, an admin should check what is already configured.

This also raises **Code-Review**, because every change to `main` would then go through an approved PR.

### 6. Vulnerabilities (0 → 10, High): the most work

132 advisories were found across the repo's lockfiles: `package-lock.json`, `bun.lockb`, `android/app/gradle.lockfile` and `android/buildscript-gradle.lockfile`. Scorecard gives 0 points once there are 10 or more, so the score only improves after most of them are fixed.

`npm audit` on `package-lock.json` alone reports 30 vulnerable packages (5 critical, 14 high, 10 moderate, 1 low). 27 of them have non-breaking fixes:

```bash
npm audit fix
```

Critical items include `@capacitor/android`, `dompurify`, `tar`, `proxy-addr` and `decompress` (the `decompress` fix needs a major upgrade). The rest of the 132 come from the Gradle lockfiles and `bun.lockb`:
- Update the Android dependencies, then regenerate the Gradle lockfiles with `./gradlew dependencies --write-locks`.
- ✅ Removed the stale `bun.lockb` (the project uses npm), along with the unused `mobile-automation/` E2E suite, whose lockfile held about 153 of the 213 advisories found on the fork.

Each fix should be tested on a device build, especially Capacitor upgrades.

✅ **Progress:**
- **Dependency upgrades:** Netty, BouncyCastle, Guava, vitest and happy-dom were upgraded, and the Gradle lockfiles were regenerated. The lockfiles and `package-lock.json` now show 5 advisories on OSV, all accepted in [`osv-scanner.toml`](../osv-scanner.toml) (no fix exists, or the package is dev-only and never shipped).
- **Verification metadata:** the remaining 52 advisories came from `android/gradle/verification-metadata.xml`, which osv-scanner also reads. Gradle only ever adds to that file, so it still listed old versions. It also listed tooling resolved outside the root pins: Capacitor plugins in `node_modules` that declare their own older AGP, Kotlin's internal BouncyCastle and Swift-export configurations, Room's annotation processor, and lint's detached configurations. Those are now pinned in `android/settings.gradle` and `android/build.gradle`, and the file was regenerated from scratch. One advisory remains (GHSA-r937-wjx7-w2jp, Kotlin Gradle plugin, fixed only in a 2.4.20 beta), and it is accepted in `osv-scanner.toml`.

**When dependencies change,** regenerate the verification file from scratch rather than appending to it, or stale versions pile up again. Empty the `<components>` element first, then run:

```bash
cd android
./gradlew --write-verification-metadata sha256 dependencies \
  $(./gradlew -q projects | grep -oE "Project ':[^']+'" | sed -E "s/Project '(.*)'/\1:dependencies/") \
  assembleDebug
```

Run the `projects` listing before emptying the file. Gradle can't start while the file is empty.

### 7. CI-Tests (3 → 10, Low) and SAST (7 → 10, Medium): workflow triggers

Only 3 of the last 10 merged PRs had a CI check, and 7 of the last 30 commits had no SAST run. Make sure `pull-request.yml` and the code-scanning workflow run on **every** PR to `main` with no path filters, and make them required status checks (see step 5). There is no CodeQL workflow file in `.github/workflows/`, so SAST probably comes from CodeQL default setup. Check that it is enabled under **Settings → Code security → Code scanning** and set to run on pull requests.

### 8. Lower priority

- **CII-Best-Practices:** register the project at <https://www.bestpractices.dev> and complete the "passing" questionnaire. Most answers are covered by the items above.
- **Fuzzing:** unusual for a mobile UI app. Fuzzing parsing-heavy utilities with `@jazzer.js/core` would count, but it's low value here.
- **Packaging / Signed-Releases:** these become scored once the project publishes GitHub Releases. If it does, sign the release artifacts (for example with Sigstore `cosign`, or SLSA provenance via `slsa-github-generator`).

## Keeping the score current ✅

[`.github/workflows/scorecard.yml`](../.github/workflows/scorecard.yml) runs the official [`ossf/scorecard-action`](https://github.com/ossf/scorecard-action):
- on every push to `main`, weekly (Monday 01:30 UTC), when branch protection rules change, and on manual dispatch;
- it uploads the SARIF results to **Security → Code scanning**;
- it publishes the score to `api.securityscorecards.dev`, which drives the badge in the [README](../README.md).

All actions in the workflow are pinned by commit SHA, and the workflow defaults to `read-all` permissions, so it doesn't lower the Pinned-Dependencies or Token-Permissions scores. The badge shows "invalid repo path" until the workflow has run on `main` at least once.

## Re-running locally

To check uncommitted changes, run Scorecard against the working copy. Only file-based checks are supported. Ignore the Binary-Artifacts and SAST results in this mode: it also scans untracked folders like `node_modules/` and `dist/`, and it can't see GitHub data.

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/repo:ro \
  gcr.io/openssf/scorecard:stable --local=/repo --show-details
```

To scan the published `main` branch:

```bash
export GITHUB_AUTH_TOKEN=$(gh auth token)
docker run --rm --platform linux/amd64 -e GITHUB_AUTH_TOKEN \
  gcr.io/openssf/scorecard:stable \
  --repo=github.com/Sunbird-Spark/sunbird-spark-mobile-app --show-details
```
