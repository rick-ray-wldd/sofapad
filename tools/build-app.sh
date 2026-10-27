#!/bin/bash
# Builds SofaPad.app (menu-bar app, no Dock icon) into ./dist, ad-hoc signed for this Mac.
# Needs Xcode or the Command Line Tools (xcode-select --install). No other dependencies.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/SofaPad.app"
ID="io.github.rick-ray-wldd.sofapad"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
BUILT="$(date '+%Y-%m-%d %H:%M')"
if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app ]; then export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; fi
swift build -c release --package-path "$ROOT/mac" --product pkm-server
BIN="$(swift build -c release --package-path "$ROOT/mac" --show-bin-path)/pkm-server"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/SofaPad"
cp -R "$ROOT/web" "$APP/Contents/Resources/web"
rm -rf "$APP/Contents/Resources/web/test"
# the page shows when it was built (⚙︎), next to the Mac app's version (PKM-4)
sed -i '' "s/export const BUILD = 'dev';/export const BUILD = '$BUILT';/" "$APP/Contents/Resources/web/js/version.js"
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
  <key>CFBundleVersion</key><string>$(date +%Y%m%d%H%M)</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>SofaPad — MIT License</string>
</dict>
</plist>
PLIST
codesign --force --sign - --identifier "$ID" "$APP"
codesign --verify --verbose=1 "$APP"
echo "Built $APP"
