#!/bin/bash
# Builds SofaPad.app (menu-bar app, no Dock icon) into ./dist, with Sparkle for in-app updates (SOFA-12).
# Needs Xcode or the Command Line Tools (xcode-select --install). The one dependency, Sparkle, comes with SwiftPM.
#
#   tools/build-app.sh                      ad-hoc signed for this Mac (the default)
#   tools/build-app.sh --identity "Developer ID Application: …"
#                                           signed with that identity, hardened runtime, secure timestamp (phase 2,
#                                           docs/RELEASING.md); tools/release.sh passes it
#
# For the end-to-end update test only (tools/sofa12-update-e2e.mjs), never for a release:
#   SOFAPAD_CONFIG=debug        a debug build: takes its feed and options from its defaults, allows a feed on
#                               127.0.0.1, and may carry this Mac's paths (it is never handed out)
#   SOFAPAD_APP=path/SofaPad.app   where to build it        SOFAPAD_BUNDLE_ID   its own bundle id
#   SOFAPAD_VERSION=4.5.1       another version than VERSION   SOFAPAD_ED_KEY   another public EdDSA key
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY="-"
while [ $# -gt 0 ]; do
  case "$1" in
    --identity) IDENTITY="${2:?--identity needs a value}"; shift 2 ;;
    *) echo "usage: tools/build-app.sh [--identity \"Developer ID Application: …\"]" >&2; exit 2 ;;
  esac
done
CONFIG="${SOFAPAD_CONFIG:-release}"
APP="${SOFAPAD_APP:-$ROOT/dist/SofaPad.app}"
ID="${SOFAPAD_BUNDLE_ID:-io.github.rick-ray-wldd.sofapad}"
VERSION="${SOFAPAD_VERSION:-$(tr -d '[:space:]' < "$ROOT/VERSION")}"
ED_KEY="${SOFAPAD_ED_KEY:-$(tr -d '[:space:]' < "$ROOT/tools/sparkle-public-key.txt")}"
FEED="https://github.com/rick-ray-wldd/sofapad/releases/latest/download/appcast.xml"
NOW=$(date +%s)
BUILT="$(date -r "$NOW" '+%Y-%m-%d %H:%M')"
# Sparkle compares this number to find a newer build: to the second, so two builds a minute apart still differ
BUILD_NUMBER="$(date -r "$NOW" +%Y%m%d%H%M%S)"
case "$CONFIG" in release|debug) ;; *) echo "SOFAPAD_CONFIG is release or debug" >&2; exit 2 ;; esac
if [ "$CONFIG" = debug ] && [ "$APP" = "$ROOT/dist/SofaPad.app" ]; then
  echo "a debug build goes somewhere else than dist/SofaPad.app (SOFAPAD_APP)" >&2; exit 2
fi
if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app ]; then export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; fi
# No paths of this Mac in the app (process/ISSUES.md I-47): the debug map the linker leaves in the symbol table
# (absolute paths of the sources and .o files) goes into a dSYM next to the app, which is never packaged, and the
# app's copy is stripped of it. The check after signing stops the build if any path is still in the app.
swift build -c "$CONFIG" --package-path "$ROOT/mac" --product pkm-server
BIN_DIR="$(swift build -c "$CONFIG" --package-path "$ROOT/mac" --show-bin-path)"
rm -rf "$APP" "$APP.dSYM"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp "$BIN_DIR/pkm-server" "$APP/Contents/MacOS/SofaPad"
# Sparkle (SOFA-12): the framework next to the executable, found through @executable_path/../Frameworks; its licence
ditto "$BIN_DIR/Sparkle.framework" "$APP/Contents/Frameworks/Sparkle.framework"
install_name_tool -add_rpath @executable_path/../Frameworks "$APP/Contents/MacOS/SofaPad"
for p in $(otool -l "$APP/Contents/MacOS/SofaPad" | awk '/LC_RPATH/{r=1} r&&/ path /{print $2; r=0}'); do
  case "$p" in "$ROOT"/*|"$HOME"/*) install_name_tool -delete_rpath "$p" "$APP/Contents/MacOS/SofaPad" ;; esac
done
cp "$ROOT/mac/.build/artifacts/sparkle/Sparkle/LICENSE" "$APP/Contents/Resources/Sparkle-LICENSE.txt"
dsymutil "$APP/Contents/MacOS/SofaPad" -o "$APP.dSYM"
strip -S -x "$APP/Contents/MacOS/SofaPad"
cp -R "$ROOT/web" "$APP/Contents/Resources/web"
rm -rf "$APP/Contents/Resources/web/test"
# the page shows when it was built (⚙︎), next to the Mac app's version (PKM-4), and follows the Mac's (SOFA-12)
sed -i '' -e "s/export const BUILD = 'dev';/export const BUILD = '$BUILT';/" \
  -e "s/export const VERSION = '[^']*';/export const VERSION = '$VERSION';/" "$APP/Contents/Resources/web/js/version.js"
TEST_KEYS=""
if [ "$CONFIG" = debug ]; then
  TEST_KEYS="<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>"
fi
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>$ID</string>
  <key>CFBundleName</key><string>SofaPad</string>
  <key>CFBundleDisplayName</key><string>SofaPad</string>
  <key>CFBundleExecutable</key><string>SofaPad</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>SofaPadBuildTime</key><string>$BUILT</string>
  <key>CFBundleVersion</key><string>$BUILD_NUMBER</string>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleAllowMixedLocalizations</key><true/>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>SofaPad — MIT License</string>
  <key>SUFeedURL</key><string>$FEED</string>
  <key>SUPublicEDKey</key><string>$ED_KEY</string>
  <key>SUEnableAutomaticChecks</key><true/>
  <key>SUScheduledCheckInterval</key><integer>86400</integer>
  <key>SUAllowsAutomaticUpdates</key><false/>
  <key>SUVerifyUpdateBeforeExtraction</key><true/>
  <key>SURequireSignedFeed</key><true/>
  $TEST_KEYS
</dict>
</plist>
PLIST
plutil -lint "$APP/Contents/Info.plist" >/dev/null
# Signing, inside out (Sparkle's documented order). Ad-hoc by default; with a Developer ID: hardened runtime and a
# secure timestamp, which notarization needs.
if [ "$IDENTITY" = "-" ]; then
  SIGN=(codesign --force --sign - --timestamp=none)
else
  SIGN=(codesign --force --sign "$IDENTITY" --options runtime --timestamp)
fi
FW="$APP/Contents/Frameworks/Sparkle.framework"
"${SIGN[@]}" "$FW/Versions/B/XPCServices/Installer.xpc"
"${SIGN[@]}" --preserve-metadata=entitlements "$FW/Versions/B/XPCServices/Downloader.xpc"
"${SIGN[@]}" "$FW/Versions/B/Autoupdate"
"${SIGN[@]}" "$FW/Versions/B/Updater.app"
"${SIGN[@]}" "$FW"
"${SIGN[@]}" --identifier "$ID" "$APP"
codesign --verify --deep --strict --verbose=1 "$APP"
if [ "$CONFIG" = release ]; then
  if LC_ALL=C grep -r -a -l -F -e "$ROOT" -e "$HOME/" "$APP"; then echo "a local path is still in the app (above)" >&2; exit 1; fi
  # the test hooks of the debug build (feed override, options from the defaults) are not in a release build
  if LC_ALL=C grep -r -a -l -e SofaPadTest -e PKM_TEST_ "$APP"; then
    echo "a test hook is in the release app (above)" >&2; exit 1
  fi
else
  echo "debug build for the update test: not checked for local paths, never hand it out"
fi
echo "Built $APP ($VERSION, build $BUILD_NUMBER, signed: $([ "$IDENTITY" = "-" ] && echo ad-hoc || echo "$IDENTITY"))"
