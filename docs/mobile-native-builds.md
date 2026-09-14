# Native mobile builds with GitHub Actions

The repository builds Android and iOS directly with the platform toolchains.
It uses the existing Expo CLI to generate native projects, then Gradle for
Android and Xcode/CocoaPods for iOS. No EAS account, Expo build quota, Fastlane,
additional hosted build service or mobile-build-specific GitHub action is used.
The workflow uses only official `actions/*` actions. Dependencies still download
from npm, Maven, Google and CocoaPods repositories during compilation.

## Outputs

| Artifact | Contents | Use |
| --- | --- | --- |
| `personal-finance-android-test-<run>` | APK, AAB, build-info.json, SHA256SUMS | APK installs on Android for testing; the public test signing key is unsuitable for store submission |
| `personal-finance-android-release-<run>` | APK and AAB signed by your keystore, metadata/checksums | Distribution using your signing identity; store policy/version checks and submission remain separate |
| `personal-finance-ios-simulator-<run>` | Compressed PersonalFinance.app, metadata/checksums | Runs in Xcode's iOS Simulator on Intel or Apple Silicon Macs |

These are native Release builds with JavaScript embedded, so Metro and Expo Go
are not needed to run them. An AAB cannot be installed directly like an APK.
The iOS Simulator app cannot be installed on a physical iPhone. A device IPA
requires an Apple signing certificate/provisioning profile and an appropriate
Apple developer account; none is needed for the Simulator build in this workflow.

## Build from the GitHub UI

After this PR is merged:

1. Open **Actions → Build mobile (native tools) → Run workflow**.
2. Choose the reviewed `main` branch.
3. Enter the real HTTPS API URL, including `/api/v1`, for example
   `https://YOUR_HOST/api/v1` or `https://YOUR_HOST/apiapp/api/v1`.
   It is public configuration embedded in the app, not a secret. The host must
   accept native clients; see the InfinityFree limitations in its deployment guide.
4. Select **build_android**, **build_ios**, or both checkboxes. At least one is
   required. Android produces both APK and AAB; iOS produces the Simulator app.
   The jobs run independently when both are selected.
5. Use **test** signing for an installable Android test APK. For **release**,
   configure your signing secrets below. This mode is allowed only on manual
   builds from `main`.
6. Optionally supply an increasing positive build number. Otherwise the GitHub
   workflow run number is used. When distributing updates, choose a number higher
   than any previous published build; separate workflows have separate counters.
7. Leave **upload_to_drive** checked to copy the Android APK/AAB to the configured
   Drive folder. Configure the three OAuth secrets below first, or uncheck it
   for a build with GitHub downloads only. For iOS-only runs it is ignored.
8. When the selected jobs pass, download their ZIP files from the run's
   **Artifacts** section. Unzip the Android artifact to obtain the APK/AAB.
   Artifacts are retained for 14 days; keep distribution copies as needed.

| build_android | build_ios | Result |
| --- | --- | --- |
| Checked | Unchecked | Android APK and AAB |
| Unchecked | Checked | iOS Simulator app; no Drive upload |
| Checked | Checked | Both platforms, built independently |
| Unchecked | Unchecked | Fails before compilation with a selection message |

An absent/invalid URL fails before compilation. The workflow accepts HTTPS URLs
ending in `/api/v1` and rejects credentials, query parameters and placeholders
for manual builds. Changing the URL requires another native build.

## Automatic PR and main validation

`Validate monorepo` retains all existing tests and builds. After those pass,
it calls the native workflow for every PR and every push to `main`. Feature
branch pushes retain the existing validation; the PR event builds native apps
once, avoiding two identical native compilations for the same update.

Set the repository **variable** `EXPO_PUBLIC_API_BASE_URL` for automatic builds
that connect to your test backend. If it is not set, CI uses the explicit
`https://example.invalid/api/v1` smoke-build address. Those artifacts prove native
compilation and packaging but cannot connect to a backend. `build-info.json`
records `smoke: true` and the URL so they cannot be confused with configured
builds. Use the manual workflow with your real URL to produce usable packages.

PR builds never receive release signing secrets. APK/AAB contents, the embedded
JavaScript, APK signatures, Simulator architectures, and output presence are
checked before artifact upload. The manifest includes version, build number,
commit, API URL, signing mode and SHA-256 hashes.

## Google Drive uploads

The default destination is [your mobile build folder](https://drive.google.com/drive/folders/1pYKQJpriFnh1IQc2t9eMvslbQhD_1pVX).
The optional repository **variable** `GOOGLE_DRIVE_FOLDER_ID` overrides it; provide
the ID only. Changing the folder does not grant access to it.

In this repository's **Settings → Secrets and variables → Actions → Repository
secrets**, configure:

| Secret | Value |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | The matching OAuth client secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | A refresh token authorized by a Google user who can add files to the destination |

Secrets from another repository or from a ChatGPT Drive connection are not
automatically available to GitHub Actions. No OAuth values belong in workflow
inputs, the repository, or the mobile application.

To obtain the credentials using Google's own tools:

1. In [Google Cloud Console](https://console.cloud.google.com/), select your
   project, enable **Google Drive API**, and configure the OAuth consent screen.
   For an External app in Testing, add the Google account as a test user.
2. Create an OAuth client of type **Web application** for this upload automation.
   Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
3. Open [Google OAuth Playground](https://developers.google.com/oauthplayground/).
   In its settings, enable **Use your own OAuth credentials**, enter that client
   ID and secret, and use offline access.
4. Authorize `https://www.googleapis.com/auth/drive` with the Google user who owns
   or can write to the folder. This scope permits broader Drive access; this
   uploader only creates packages in the configured folder. The narrower
   `drive.file` scope works only if the existing folder has already been authorized
   for that OAuth app (for example, through Google Picker). Merely knowing the
   folder ID does not authorize it. See [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
5. Exchange the authorization code for tokens and save the **refresh token** and
   matching client credentials as the three GitHub secrets above. Do not use the
   short-lived access token as `GOOGLE_DRIVE_REFRESH_TOKEN`.

Google limits External/Testing refresh tokens with Drive scopes to seven days.
For ongoing use, configure the consent app's publishing status appropriately,
meet any verification requirements Google shows, and then authorize again.
Reuse a valid refresh token until it expires or is revoked.
See [Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

This implementation uses user OAuth for personal Drive storage. Service accounts
cannot own files or use personal storage quota; they require a shared drive or
delegation and are not accepted by this workflow.
See [Google's storage quota guidance](https://developers.google.com/workspace/drive/api/guides/handle-errors#storageQuotaExceeded).

The upload job uses Node's built-in APIs and Google's
[resumable upload protocol](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
It needs no rclone, third-party upload action, or new npm dependency. It verifies
both local packages against `build-info.json`, checks folder write access, sends
the data in 8 MiB chunks, resumes interrupted transfers with bounded retries,
and confirms Drive's file size, MD5 checksum, name, and parent folder.

Files appear directly in the selected folder as
`personal-finance-<test|release>-<run-id>-<attempt>.apk` and the corresponding
`.aab`. Runs and retries keep separate versions. Existing files and folder
sharing are not changed. Each successful file gets a link in the workflow
summary. Test-signed packages remain test packages; the filename identifies them.

Uploads run only for manual `main` builds when Android and **upload_to_drive** are
selected. Automatic PR/main validation explicitly disables uploads and receives
no Drive credentials. An iOS failure does not prevent a successful Android build
from being uploaded. The upload job runs after the Android artifact is saved, so
missing credentials, expired tokens, folder permission errors, or quota errors
fail the upload job while leaving the APK/AAB available in GitHub Artifacts.
Fix the reported configuration and use **Re-run failed jobs** to retry uploads
without recompiling successful build jobs. No Drive upload is claimed until both
files have actually been uploaded and verified.

## Optional Android release signing

Reuse the existing keystore if this app has already been distributed. For a new
app, create an upload keystore locally using the JDK's interactive `keytool`:

```sh
keytool -genkeypair -keystore /secure/path/finance-upload.jks -alias finance-upload -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore and passwords backed up privately. In **Settings → Secrets and
variables → Actions → Repository secrets**, add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of the keystore bytes |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias, such as `finance-upload` |
| `ANDROID_KEY_PASSWORD` | Password for that private key |

The workflow decodes the keystore only into the runner's temporary directory,
reads passwords from the environment, and removes the file after the job. It
does not include signing material in artifacts or generated Gradle files. A
missing release setting fails; it never silently switches to the test key.

Application IDs are `com.chaitu1325.personalfinance` on both platforms. Choose
your intended IDs before first distribution and keep them stable for updates.
Build/signing does not submit to Google Play or Apple. The pinned Expo SDK and
Xcode versions must meet the store's requirements at the time of submission.

## Local native builds

Android needs Node 22, JDK 17, Android SDK 35/build-tools 35.0.0, NDK
27.1.12297006, CMake 3.22.1, and accepted SDK licenses. Set `ANDROID_HOME` to the
SDK. iOS needs a Mac, Xcode 16.4 (the version selected on the `macos-15` runner)
and CocoaPods. The scripts use Bash; on Windows use a compatible shell or run
the GitHub workflow without installing a local toolchain.

From the repository root:

```sh
cd apps/mobile
npm install
export EXPO_PUBLIC_API_BASE_URL=https://YOUR_HOST/api/v1
export PF_BUILD_NUMBER=1
npm run build:android
# On a Mac:
npm run build:ios
```

For local Android release signing, also set `PF_ANDROID_SIGNING=release`,
`PF_ANDROID_KEYSTORE_FILE` (an absolute path), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` privately in the environment.
Local commands do not require a GitHub account or hosted build service.

Both commands regenerate their platform's `android/` or `ios/` directory with
`expo prebuild --clean`. These generated directories are ignored in git; put
lasting settings in the Expo config or build scripts. Do not keep hand edits
there. Expo prebuild may also update development launch scripts in package.json;
review the diff before committing after local generation.

Outputs are in `apps/mobile/native-build/android/` and
`apps/mobile/native-build/ios-simulator/`. To run the Simulator artifact, extract
the `.tar.gz`, boot a Simulator in Xcode and run:

```sh
xcrun simctl install booted /path/to/PersonalFinance.app
xcrun simctl launch booted com.chaitu1325.personalfinance
```

To install an Android APK with the SDK:

```sh
adb install -r apps/mobile/native-build/android/personal-finance.apk
```

If an installed build uses a different signing key, Android rejects the update.
Use the same original key for updates; uninstalling an app removes its local data.

## References

- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/)
- [Android command-line builds and signing](https://developer.android.com/build/building-cmdline)
- [GitHub macOS 15 tools and Xcode versions](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)
