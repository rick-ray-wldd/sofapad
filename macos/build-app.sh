#!/bin/bash
# Build SofaPad.app on your Mac, sign it with your Developer ID, and optionally notarize it.
#
#   ./macos/build-app.sh              build and sign (ad-hoc if no Developer ID is found)
#   ./macos/build-app.sh --notarize   also notarize and staple (needs the keychain profile below)
#
# One-time setup for --notarize (asks for an app-specific password from appleid.apple.com):
#   xcrun notarytool store-credentials sofapad-notary --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/dist"
APP="$OUT/SofaPad.app"
PROFILE="${SOFAPAD_NOTARY_PROFILE:-sofapad-notary}"
NOTARIZE=0
[ "${1:-}" = "--notarize" ] && NOTARIZE=1

VERSION=$(sed -n 's/^VERSION = "\(.*\)"/\1/p' sofapad.py)
echo "== SofaPad $VERSION"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp macos/Info.plist "$APP/Contents/Info.plist"
cp sofapad.py "$APP/Contents/Resources/"
cp -R web "$APP/Contents/Resources/web"

echo "== compiling launcher"
clang -fobjc-arc -O2 -arch arm64 -arch x86_64 -mmacosx-version-min=12.0 \
  -framework Cocoa -o "$APP/Contents/MacOS/SofaPad" macos/launcher.m

LINE=$(security find-identity -v -p codesigning | grep '"Developer ID Application: ' | head -1 || true)
IDENTITY=$(echo "$LINE" | sed -n 's/.*"\(Developer ID Application: .*\)"/\1/p')
HASH=$(echo "$LINE" | awk '{print $2}')
if [ -z "$IDENTITY" ]; then
  echo "!! No Developer ID Application certificate found; signing ad-hoc (works only on this Mac)."
  codesign --force --sign - "$APP"
  [ $NOTARIZE = 1 ] && { echo "!! Can't notarize without a Developer ID certificate."; exit 1; }
else
  echo "== signing with: $IDENTITY"
  codesign --force --options runtime --timestamp --sign "$HASH" "$APP"
fi
codesign --verify --strict --verbose=2 "$APP"

if [ $NOTARIZE = 1 ]; then
  echo "== notarizing (usually a few minutes)"
  ditto -c -k --keepParent "$APP" "$OUT/SofaPad-upload.zip"
  xcrun notarytool submit "$OUT/SofaPad-upload.zip" --keychain-profile "$PROFILE" --wait
  rm -f "$OUT/SofaPad-upload.zip"
  xcrun stapler staple "$APP"
  spctl --assess --type execute --verbose=2 "$APP"
fi

ditto -c -k --keepParent "$APP" "$OUT/SofaPad-$VERSION.zip"
echo
echo "== done: $APP"
echo "   zip:  $OUT/SofaPad-$VERSION.zip"
echo "   First run: open SofaPad.app, then turn on SofaPad in"
echo "   System Settings > Privacy & Security > Accessibility, and reopen it."
