# Play Store Publishing Guide — Sunbird Spark

End-to-end guide for adopters who want to publish their fork of Sunbird Spark to the Google Play Store from their own Google Play Developer account.

This guide assumes you already have the source code building and running locally. It covers everything from keystore generation through the first rollout and subsequent updates.

> **A note on accuracy:** Play Console navigation labels and section names are renamed by Google periodically, but the required sections themselves remain the same. If a menu path in this guide doesn't match what you see, search the Play Console for the section name — the underlying concept hasn't changed. Likewise, project file locations (e.g. where `versionCode` lives) reflect the current repo layout; future Gradle / Capacitor restructures may move them.

### Useful official references

- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) — what it is and how to opt in
- [Data Safety form](https://support.google.com/googleplay/android-developer/answer/10787469) — declaration requirements
- [Content rating questionnaire](https://support.google.com/googleplay/android-developer/answer/9859655) — IARC rating process
- [App bundle (AAB) overview](https://developer.android.com/guide/app-bundle)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Generate a release keystore](#2-generate-a-release-keystore)
3. [Configure signing in the project](#3-configure-signing-in-the-project)
4. [Set `versionCode` and `versionName`](#4-set-versioncode-and-versionname)
5. [Build the signed AAB](#5-build-the-signed-aab)
6. [Create the app in Play Console](#6-create-the-app-in-play-console)
7. [Complete required listing & policy sections](#7-complete-required-listing--policy-sections)
8. [Upload the AAB and create a release](#8-upload-the-aab-and-create-a-release)
9. [Select countries / regions](#9-select-countries--regions)
10. [Roll out](#10-roll-out)
11. [Publishing subsequent updates](#11-publishing-subsequent-updates)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Item | Notes |
|---|---|
| Google Play Developer account | One-time USD 25 registration fee. Sign up at https://play.google.com/console/signup |
| An organizational Google account with long-term ownership | The account that owns the listing should outlast individual contributors — losing access to it can block all future updates |
| Java 21 (JDK) | Needed for `keytool` and Gradle |
| Android SDK | Either via Android Studio or `sdkmanager` |
| Node + npm | Use the version pinned by the project (currently Node 22+ works; the CI workflow at `.github/workflows/build-aab.yml` documents the canonical version) |
| A privacy policy URL hosted on a public site | Required by Play Console; cannot be `localhost` or PDF on Drive |
| App icon at 512×512 PNG (no transparency) | For the Play Store listing |
| Feature graphic 1024×500 JPG/PNG | For the Play Store listing |
| At least 2 phone screenshots | 16:9 or 9:16 aspect ratio |

---

## 2. Generate a release keystore

> ⚠️ **Critical:** Once you upload your first AAB signed with a keystore, you must use **the same keystore** for every future update. If you lose it, you cannot publish updates to existing users — you'd have to publish a new app under a new package name. **Back it up immediately and store the passwords securely.**

> ⚠️ **Equally critical — the Android package name (applicationId) is permanent.** Once an app is published on the Play Store, you cannot change the `applicationId` in `android/app/build.gradle` (e.g. org.sunbird.spark.app). If you change it after publishing, the Play Store treats it as a brand-new app, existing users cannot upgrade, and your old listing is orphaned. Decide on your final `applicationId` (typically `<reverse-domain>.<appname>`, e.g. `in.yourorg.spark`) **before your first upload** and stick with it.

From the project root:

```bash
cd android/app
mkdir -p keystore
keytool -genkey -v \
  -keystore keystore/android_keystore.jks \
  -alias sunbird \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You'll be prompted for:

- **Keystore password** — set a strong password and save it
- **Key alias password** — can be the same as the keystore password
- A few identity fields (name, org, city, country) — these are not user-visible

Outputs `android/app/keystore/android_keystore.jks`. Add `*.jks`, `*.keystore`, and `signing.properties` to `.gitignore` (already done in this repo — verify before committing).

**Back up the `.jks` file and passwords to a password manager or secure vault now.**

---

## 3. Configure signing in the project

Create `android/signing.properties` (not committed):

```properties
KEYSTORE=keystore/android_keystore.jks
SIGNING_STORE_PASSWORD=<your keystore password>
SIGNING_KEY_ALIAS=sunbird
SIGNING_KEY_PASSWORD=<your key alias password>
```

The repo already includes `android/signing.gradle` and a `signingConfigs { release {} }` block in `android/app/build.gradle` that reads these values. Local builds without a `signing.properties` file produce an unsigned bundle, so you'll know immediately if signing isn't picked up.

---

## 4. Set `versionCode` and `versionName`

Update `versionCode` and `versionName` in the Android app configuration (currently `android/app/build.gradle`; future Capacitor / Gradle version-catalog migrations may move these to a `libs.versions.toml` or `gradle.properties` file — check the repo's current convention):

```gradle
defaultConfig {
    ...
    versionCode 1        // integer; must increase with every upload
    versionName "1.0"    // user-facing string (e.g. "1.0.3")
    ...
}
```

- **First upload:** `versionCode 1`
- **Every subsequent upload:** bump `versionCode` by 1 (e.g. 2, 3, 4…). Play Store rejects duplicates.
- **`versionName`** is cosmetic; convention is `MAJOR.MINOR.PATCH`. It doesn't have to match `versionCode`.

---

## 5. Build the signed AAB

### Option A — Local build (one-off / first upload)

```bash
# From project root
npm install
npm run build           # builds the Capacitor web bundle (Vite)
npx cap sync android    # copies the web bundle into android/
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Option B — GitHub Actions (recommended for teams)

The repo ships with `.github/workflows/build-aab.yml`. It builds and signs the AAB in CI when you push a tag like `test-1.0.0` or `sandbox-1.0.0`.

To use it from your fork, configure these per-environment in **GitHub Settings → Environments**:

**Secrets:**
- `KEYSTORE` — base64 of your `.jks` file. To generate:
  - macOS: `base64 -i android_keystore.jks | pbcopy`
  - Linux: `base64 android_keystore.jks | xclip -selection clipboard` (or `base64 android_keystore.jks > keystore.b64` and copy manually)
  - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("android_keystore.jks")) | Set-Clipboard`
- `SIGNING_KEYS` — base64 of `{"SIGNING_STORE_PASSWORD":"…","SIGNING_KEY_ALIAS":"…","SIGNING_KEY_PASSWORD":"…"}`
- `GOOGLE_SERVICE_CONTENT` — base64 of `google-services.json` (for push notifications/Firebase). Same `base64` commands as above, with the filename swapped.
- `MOBILE_APP_KEY`, `MOBILE_APP_SECRET`, `MOBILE_APP_CONSUMER`
- `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY` (only if you also push to Azure)

**Variables:**
- `BASE_URL`, `PRODUCER_ID`, `AZURE_CONTAINER_NAME`

Trigger: `git tag test-1.0.0 && git push origin test-1.0.0`. The signed AAB is uploaded as a GitHub Actions artifact and (optionally) to Azure.

---

## 6. Create the app in Play Console

1. Open https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name** — what shows in the store (e.g. "Sunbird Spark — YourOrg")
   - **Default language** — e.g. English (India) — en-IN
   - **App or game** — App
   - **Free or paid** — Free
   - Tick both declarations (Developer Program Policies, US export laws)
4. **Create app**

You'll land on the app dashboard. The left rail has a **Set up your app** card with the required steps.

---

## 7. Complete required listing & policy sections

Play Console requires several sections to be filled before you can roll out *any* release. Work through them in this order — each shows a green tick when complete.

### 7.1 App access
**Dashboard → App content → App access**

If your app requires login (Sunbird Spark does), choose **All or some functionality is restricted** and add reviewer credentials. Paste the content from `PLAY_STORE_REVIEWER_INSTRUCTIONS.md` (already in the repo) — that doc is purpose-built for this form.

### 7.2 Ads
**Dashboard → App content → Ads**

Sunbird Spark does not contain ads → answer **No, my app does not contain ads**.

> If you see a manifest warning about `com.google.android.gms.permission.AD_ID` after upload, see [Troubleshooting → AD_ID warning](#ad_id-warning-but-no-ads). The repo already includes the fix; if you removed it during merge, re-add the `tools:node="remove"` line in `AndroidManifest.xml`.

### 7.3 Content rating
**Dashboard → App content → Content rating**

Click **Start questionnaire** → category **Education** → fill in the questions (Sunbird is an education app with user-generated profiles but no violence/gambling/etc.). The result is an IARC rating you can't change without resubmitting.

### 7.4 Target audience
**Dashboard → App content → Target audience and content**

Pick the age groups your app targets. For Sunbird Spark adopters, typically **18 and over** (adjust if you target school-age learners — that triggers extra child-safety policies).

### 7.5 Data safety
**Dashboard → App content → Data safety**

Declare what data the app collects and how it's handled. **Review your specific deployment's actual data collection practices and complete the form accordingly** — adopters may disable analytics, modify auth flows, add new SDKs, or integrate additional telemetry, all of which affect this declaration.

A typical Sunbird Spark deployment collects:

- **Personal info → Name, Email address** (account/authentication)
- **App activity → App interactions** (analytics — be honest about telemetry)
- **Device/Other → Device ID** (push notifications, when enabled)
- **Encrypted in transit** — Yes
- **Users can request data deletion** — Yes (the app supports account deletion under Profile → Delete account)

Inaccurate declarations can result in policy violations and listing removal, so verify against your actual code paths and SDKs before submitting. Fill in your privacy policy URL when prompted.

### 7.6 Privacy policy
**Dashboard → Store settings → Store listing → Privacy policy**

A publicly accessible URL. PDFs/Drive links are rejected. A sample privacy policy is present in the folder along with this file

### 7.7 News app declaration
Pick **App is not a news app** unless yours is.

### 7.8 Government app declaration
If your org is a government entity, declare it here. Most Sunbird adopters answer **No**.

### 7.9 Store listing
**Dashboard → Main store listing**

- **App name** (max 30 chars)
- **Short description** (max 80 chars)
- **Full description** (max 4000 chars)
- **App icon** (512×512 PNG)
- **Feature graphic** (1024×500)
- **Phone screenshots** (at least 2)
- **App category** — Education
- **Contact email** — public-facing support email

### 7.10 App category & tags
Pick **Education** and add up to 5 tags (e.g. "Learning", "Online courses", "Certification").

---

## 8. Upload the AAB and create a release

Play Console has multiple "tracks":

| Track | Audience | When to use |
|---|---|---|
| **Internal testing** | Up to 100 testers from a list | First uploads, smoke testing — fastest review (~hours) |
| **Closed testing** | Selected groups via email list or Google Group | Beta with a known cohort |
| **Open testing** | Anyone with the opt-in URL | Public beta |
| **Production** | All Play Store users | Final release; requires a full Google review (1–7 days for first release) |

**Recommended path for first release:** Internal → Closed → Production.

### Steps (using Internal testing)

1. **Testing → Internal testing → Create new release**
2. **Sign the app** — Play asks if you want Play App Signing. **Recommended: opt in** (Google manages a per-app signing key; you sign uploads with your *upload* key, Google re-signs with the app signing key before serving). This lets you reset the upload key if it's ever lost, without losing the ability to update.
3. **App bundles → Upload** → drag in `app-release.aab`
4. **Release name** — auto-fills to `versionName`; leave or customize (e.g. "1.0.0 — initial internal release")
5. **Release notes** — short, per-language. Required.
6. **Save** → **Review release**
7. Fix any errors listed at the top (see [Troubleshooting](#12-troubleshooting))

---

## 9. Select countries / regions

Each track has its own country list — uploading the AAB doesn't auto-populate it.

1. **Testing → Internal testing → Countries / regions** tab
2. **Add countries / regions** → tick the countries where the app should be available
3. **Save**

For Production: **Production → Countries / regions** tab.

> **You'll see an error blocking rollout until at least one country is added.**

---

## 10. Roll out

1. Go back to **Releases** tab → **Edit release** (the draft you saved)
2. Click **Review release**
3. The summary shows the release with no errors → **Start rollout to Internal testing**
4. Confirm

Once rolled out:
- Internal testers receive an email with an opt-in link → after opting in (5–10 minutes propagation) they can install from Play Store
- The Production rollout starts a Google review — expect 1–7 days for first review, hours-to-days for subsequent updates

### Promote to next track
Once an internal build is validated, you don't need to re-upload the AAB. Go to **Closed testing → Create new release → Promote release** → pick the internal release → set country list → roll out.

---

## 11. Publishing subsequent updates

For every new release:

1. **Bump `versionCode`** in `android/app/build.gradle` (e.g. 3 → 4). Optionally bump `versionName`.
2. **Rebuild** the AAB (Section 5).
3. **Play Console → Testing → Internal testing → Create new release** → upload new AAB → add release notes → review → roll out.
4. Existing testers/users get the update automatically over the next few hours.

> ⚠️ If you bump `versionCode` but keep the *same keystore*, existing users upgrade seamlessly. If you switch keystores, existing users **cannot** upgrade and you'd need to publish under a new package name (or request a key reset, which can take weeks).

---

## 12. Troubleshooting

### "versionCode N already exists"
**Cause:** You tried to upload an AAB with a `versionCode` that was already uploaded (even if that build was never rolled out — once uploaded it's reserved).
**Fix:** Bump `versionCode` in `android/app/build.gradle` and rebuild. `versionName` doesn't need to change.

### Bundle shows "Inactive" in App Bundle Explorer
**Not an error.** "Inactive" just means the AAB is uploaded but not yet attached to a *release*. Create a release on a track and add the bundle from the library — it'll become "Active" once rolled out.

### "This release does not add or remove any app bundles"
**Cause:** The release draft is empty even though you thought you added the AAB.
**Fix:** Open the release → **App bundles** section → **trash icon** to remove what's there → **Add from library** → re-pick the AAB → **Save**. The error clears.

### "No countries or regions have been selected for this track"
**Fix:** **Testing → [track] → Countries / regions** tab → add at least one country → Save. Then return to the release.

### "You can't rollout this release because it doesn't allow any existing users to upgrade"
**Common causes (in order of likelihood):**
1. **Different signing key** between this release and a prior one (most common) → use the original keystore, or if you opted into Play App Signing, request an upload-key reset.
2. **Lower or equal `versionCode`** than a previously uploaded AAB → bump `versionCode`.
3. **Removed an ABI** that the previous version supported (e.g. v1 had `arm64-v8a` + `armeabi-v7a`, v2 only has `arm64-v8a`) → rebuild with full ABI set.
4. **Raised `minSdkVersion`**, locking out devices that had the previous version → either lower `minSdk` back, or accept that some users will be stuck.

Open **App bundle explorer** → compare new vs old AAB on **Supported devices** and **Signing** to identify the difference.

### AD_ID warning but no ads
**Cause:** Firebase Messaging (push notifications) and other Play Services libraries transitively add the `com.google.android.gms.permission.AD_ID` permission to the merged manifest.
**Fix:** In `android/app/src/main/AndroidManifest.xml`:

1. Add the `tools` namespace to the `<manifest>` tag:
   ```xml
   <manifest xmlns:android="http://schemas.android.com/apk/res/android"
       xmlns:tools="http://schemas.android.com/tools">
   ```
2. Add this line in the permissions block:
   ```xml
   <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />
   ```
3. Bump `versionCode`, rebuild, re-upload.

### Internal testers don't see the app on Play Store
- Confirm they accepted the opt-in link (sent via email when added as a tester)
- Wait 5–15 minutes after rollout for Play to propagate
- They must use the **same Google account** they accepted the opt-in with
- Their country/region must be in the track's country list
- Try the direct Play Store URL from the Internal testing page → **Testers → How testers join your test** → copy URL

### Upload key lost
If you opted into **Play App Signing**: in Play Console → **Setup → App integrity → App signing → Request upload key reset**. Google can issue a new upload key in 1–2 business days. You can then sign with the new keystore and continue updates.

If you did **not** opt into Play App Signing and lost the keystore: you cannot update the app. You'd need to publish a new app under a different package name. **This is why backing up the keystore is critical.**

---

## Appendix — Files in this repo relevant to publishing

| File | Purpose |
|---|---|
| `android/app/build.gradle` | `versionCode`, `versionName`, signing config |
| `android/app/src/main/AndroidManifest.xml` | Permissions, AD_ID removal |
| `android/signing.gradle` | Reads `signing.properties` for keystore credentials |
| `android/signing.properties` (gitignored) | Local keystore passwords; you create this |
| `android/app/keystore/android_keystore.jks` (gitignored) | Your release keystore; you create this |
| `.github/workflows/build-aab.yml` | CI build pipeline (optional) |

---

## Checklist before first rollout

- [ ] Keystore generated and backed up (`.jks` + passwords in a vault)
- [ ] `versionCode 1`, `versionName "1.0"` (or higher) set
- [ ] `google-services.json` placed at `android/app/google-services.json` (if using push notifications)
- [ ] GitHub Actions environment secrets & variables configured (only if using CI build — Section 5, Option B): `KEYSTORE`, `SIGNING_KEYS`, `GOOGLE_SERVICE_CONTENT`, `MOBILE_APP_KEY`, `MOBILE_APP_SECRET`, `MOBILE_APP_CONSUMER`, `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`, plus variables `BASE_URL`, `PRODUCER_ID`, `AZURE_CONTAINER_NAME`
- [ ] Signed AAB built and verified locally
- [ ] Play Console app created
- [ ] Privacy policy URL live and pasted into Play Console
- [ ] App access reviewer credentials added
- [ ] Ads declaration — No
- [ ] Content rating questionnaire completed
- [ ] Target audience set
- [ ] Data safety form completed
- [ ] Store listing (icon, screenshots, descriptions) saved
- [ ] Internal testing track created with at least 1 country selected
- [ ] At least 1 tester email added to the testers list
- [ ] AAB uploaded to a release on Internal testing
- [ ] Release notes filled in
- [ ] Rollout started
