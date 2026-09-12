#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PF_NATIVE_BUILD=1
export CI=1
export EXPO_NO_TELEMETRY=1
node scripts/check-native.cjs
node -e "require('./scripts/configure-android.cjs').requireSigning(process.env)"
test -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" || { echo 'Android SDK is required (ANDROID_HOME)'; exit 1; }
java -version
# Generated native directories contain no hand-maintained code in this project.
npm exec -- expo prebuild --platform android --clean --no-install
node scripts/configure-android.cjs
(
  cd android
  ./gradlew :app:assembleRelease :app:bundleRelease --no-daemon --max-workers=2 --console=plain \
    '-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g' \
    -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
)
output="$PWD/native-build/android"
mkdir -p "$output"
cp android/app/build/outputs/apk/release/app-release.apk "$output/personal-finance.apk"
cp android/app/build/outputs/bundle/release/app-release.aab "$output/personal-finance.aab"
# A standalone app must include its JavaScript; a Metro-dependent APK is not a deliverable.
unzip -Z1 "$output/personal-finance.apk" | awk '$0 == "assets/index.android.bundle" { found=1 } END { exit !found }'
unzip -Z1 "$output/personal-finance.aab" | awk '$0 == "base/assets/index.android.bundle" { found=1 } END { exit !found }'
unzip -Z1 "$output/personal-finance.aab" | awk '/^META-INF\/.*\.(RSA|DSA|EC)$/ { signature=1 } /^META-INF\/.*\.SF$/ { manifest=1 } END { exit !(signature && manifest) }'
for abi in armeabi-v7a arm64-v8a x86 x86_64; do
  unzip -Z1 "$output/personal-finance.apk" | awk -v abi="$abi" 'index($0, "lib/" abi "/") == 1 && /\.so$/ { found=1 } END { exit !found }'
done
sdk_root="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
signer="$sdk_root/build-tools/35.0.0/apksigner"
test -x "$signer" || { echo 'Android build-tools 35.0.0 are required for signature verification'; exit 1; }
"$signer" verify "$output/personal-finance.apk"
jarsigner -verify "$output/personal-finance.aab"
node scripts/artifact-manifest.cjs android "$output"
