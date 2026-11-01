#!/bin/bash
# Local release package (SOFA-6): builds dist/SofaPad.app, then dist/release/SofaPad-<version>-macOS.zip with the
# release notes, the install guide, the demo page (full and recording version) and its recording scripts, the
# licences, and its SHA-256. Nothing is notarized or uploaded here.
# The same zip is what the app's updater downloads (SOFA-12): Sparkle finds SofaPad.app inside its folder.
#
#   tools/package.sh                          build, then package (ad-hoc signed)
#   tools/package.sh --app dist/SofaPad.app   package an app that is already built and signed (tools/release.sh)
#   --version V  --out DIR  --notes FILE      another version / folder / release notes (the update test)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
APP_IN=""
OUT="$ROOT/dist/release"
NOTES=""
while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP_IN="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --out) mkdir -p "$2"; OUT="$(cd "$2" && pwd)"; shift 2 ;;
    --notes) NOTES="$2"; shift 2 ;;
    *) echo "usage: tools/package.sh [--app SofaPad.app] [--version V] [--out DIR] [--notes FILE]" >&2; exit 2 ;;
  esac
done
NOTES="${NOTES:-$ROOT/docs/release/$VERSION.md}"
NAME="SofaPad-$VERSION"
if [ -z "$APP_IN" ]; then
  "$ROOT/tools/build-app.sh"
  APP_IN="$ROOT/dist/SofaPad.app"
fi
[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_IN/Contents/Info.plist")" = "$VERSION" ] \
  || { echo "$APP_IN is not version $VERSION" >&2; exit 1; }
rm -rf "$OUT/$NAME" "$OUT/$NAME-macOS.zip" "$OUT/$NAME-macOS.zip.sha256"
mkdir -p "$OUT/$NAME"
ditto "$APP_IN" "$OUT/$NAME/SofaPad.app"
# links that work inside the zip: INSTALL.md next to the notes, the README on GitHub
REPO="https://github.com/rick-ray-wldd/sofapad/blob/main"
sed -e 's|](\.\./INSTALL\.md)|](INSTALL.md)|g' -e "s|](\.\./\.\./|]($REPO/|g" -e "s|](\.\./|]($REPO/docs/|g" \
  "$NOTES" > "$OUT/$NAME/RELEASE-NOTES.md"
sed -e "s|](\.\./|]($REPO/|g" "$ROOT/docs/INSTALL.md" > "$OUT/$NAME/INSTALL.md"
cp "$ROOT/LICENSE" "$OUT/$NAME/LICENSE"
cp "$APP_IN/Contents/Resources/Sparkle-LICENSE.txt" "$OUT/$NAME/Sparkle-LICENSE.txt"
# the demo page and its recording scripts (SOFA-9): the page is one offline file, the scripts link to each other
cp "$ROOT/demo/playground.html" "$OUT/$NAME/playground.html"
# the short recording version (SOFA-9): the same page with its mode meta set to video, so a double-click opens it
sed -e 's|<meta name="playground-mode" content="full">|<meta name="playground-mode" content="video">|' \
  "$ROOT/demo/playground.html" > "$OUT/$NAME/playground-video.html"
grep -q '<meta name="playground-mode" content="video">' "$OUT/$NAME/playground-video.html" \
  || { echo "playground-video.html: the mode meta was not found in demo/playground.html" >&2; exit 1; }
for f in DEMO-SCRIPT.md DEMO-SCRIPT.zh-TW.md; do
  sed -e "s|](\.\./|]($REPO/|g" "$ROOT/docs/$f" > "$OUT/$NAME/$f"
done
cd "$OUT"
if LC_ALL=C grep -r -a -l -F -e "$ROOT" -e "$HOME/" "$NAME"; then
  case "$APP_IN" in
    "$ROOT"/dist/update-test/*) echo "(an update-test build: it may carry this Mac's paths, it is never handed out)" ;;
    *) echo "a local path is in the package (above)" >&2; exit 1 ;;
  esac
fi
ditto -c -k --sequesterRsrc --keepParent "$NAME" "$NAME-macOS.zip"
shasum -a 256 "$NAME-macOS.zip" > "$NAME-macOS.zip.sha256"
echo "architectures: $(lipo -archs "$NAME/SofaPad.app/Contents/MacOS/SofaPad")"
codesign -dv "$NAME/SofaPad.app" 2>&1 | grep -E "^(Identifier|Signature|TeamIdentifier)" || true
echo "Packaged $OUT/$NAME-macOS.zip"
cat "$NAME-macOS.zip.sha256"
