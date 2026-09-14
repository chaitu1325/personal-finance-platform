#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PF_NATIVE_BUILD=1
export CI=1
export EXPO_NO_TELEMETRY=1
node scripts/check-native.cjs
test "$(uname -s)" = Darwin || { echo 'iOS compilation requires macOS with Xcode'; exit 1; }
xcodebuild -version
pod --version
npm exec -- expo prebuild --platform ios --clean --no-install
(
  cd ios
  pod install
)
derived="$PWD/native-build/ios-derived"
output="$PWD/native-build/ios-simulator"
mkdir -p "$output"
# Release embeds the JS bundle; Simulator builds do not need Apple signing credentials.
xcodebuild -workspace ios/PersonalFinance.xcworkspace -scheme PersonalFinance \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived" -jobs 3 \
  'ARCHS=arm64 x86_64' ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build
app="$derived/Build/Products/Release-iphonesimulator/PersonalFinance.app"
test -s "$app/main.jsbundle" || { echo 'iOS Release app is missing its bundled JavaScript'; exit 1; }
test -s "$app/PersonalFinance"
lipo "$app/PersonalFinance" -verify_arch arm64 x86_64
tar -czf "$output/personal-finance-ios-simulator.tar.gz" -C "$(dirname "$app")" "$(basename "$app")"
node scripts/artifact-manifest.cjs ios-simulator "$output"
