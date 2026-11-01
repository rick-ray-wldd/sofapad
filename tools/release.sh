#!/bin/bash
# One command for a release (SOFA-12, docs/RELEASING.md):
#
#   tools/release.sh 4.5.0
#   tools/release.sh 4.5.0 --identity "Developer ID Application: … (TEAMID)" --notary-profile sofapad-notary
#
# bump the version → test → build → sign → (notarize, staple) → zip → sign the zip and write the update feed
# (appcast.xml, EdDSA) → release notes → print the `gh release create` command.
# It never pushes, tags or publishes anything, and never asks for or reads an Apple password: notarization uses a
# Keychain profile the owner made with `xcrun notarytool store-credentials`.
#
# Without --identity the app is signed ad-hoc (and the script says so): macOS blocks its first launch, and the
# Accessibility permission may have to be given again after an update. A Developer ID fixes both (phase 2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
usage() {
  echo "usage: tools/release.sh <version> [--identity \"Developer ID Application: …\" [--notary-profile NAME]]" >&2
  echo "                         [--skip-browser-tests]" >&2
  exit 2
}
die() { echo "release: $*" >&2; exit 1; }
[ $# -ge 1 ] || usage
VERSION="$1"; shift
IDENTITY="-"
PROFILE=""
BROWSER=1
while [ $# -gt 0 ]; do
  case "$1" in
    --identity) IDENTITY="${2:?}"; shift 2 ;;
    --notary-profile) PROFILE="${2:?}"; shift 2 ;;
    --skip-browser-tests) BROWSER=0; shift ;;
    *) usage ;;
  esac
done
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "the version is three numbers, like 4.5.0"
[ -z "$PROFILE" ] || [ "$IDENTITY" != "-" ] || die "--notary-profile needs --identity (a Developer ID Application identity)"
if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app ]; then export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; fi
REPO_SLUG="rick-ray-wldd/sofapad"
OUT="$ROOT/dist/release"
ZIP="SofaPad-$VERSION-macOS.zip"
NOTES="docs/release/$VERSION.md"
ACCOUNT="sofapad"   # the Keychain account of SofaPad's EdDSA key (generate_keys --account sofapad)
SPARKLE_BIN="$ROOT/mac/.build/artifacts/sparkle/Sparkle/bin"
step() { printf '\n== %s\n' "$*"; }

if [ "$IDENTITY" = "-" ]; then
  echo "Signing: ad-hoc (no --identity). macOS will block the first launch of a downloaded copy, and the"
  echo "Accessibility permission may reset after an update. Phase 2 (Developer ID + notarization): docs/RELEASING.md."
elif [ -z "$PROFILE" ]; then
  echo "Signing: $IDENTITY, NOT notarized (no --notary-profile): macOS still blocks the first launch."
fi

# ---- release notes and changelog: written by hand, before this script
if [ ! -f "$NOTES" ]; then
  cat > "$NOTES" <<EOF
# SofaPad $VERSION

## What's new

- …

## Known limits

- …

---

# SofaPad $VERSION（繁體中文）

## 這一版

- …

## 已知限制

- …
EOF
  die "wrote a skeleton $NOTES: fill it in (English, a --- line, then Chinese) and run again"
fi
grep -q '^---[[:space:]]*$' "$NOTES" || die "$NOTES: English first, then a line with --- , then Chinese"
if grep -q '^- …$' "$NOTES"; then die "$NOTES still has the skeleton's - … lines"; fi
grep -q "^## $VERSION " CHANGELOG.md || die "CHANGELOG.md has no \"## $VERSION (date)\" entry"

# ---- 1. version
step "1/7 version $VERSION"
echo "$VERSION" > VERSION
sed -i '' "s/public static let sourceVersion = \"[^\"]*\"/public static let sourceVersion = \"$VERSION\"/" mac/Sources/PKMCore/BuildInfo.swift
sed -i '' "s/export const VERSION = '[^']*';/export const VERSION = '$VERSION';/" web/js/version.js
grep -q "sourceVersion = \"$VERSION\"" mac/Sources/PKMCore/BuildInfo.swift || die "BuildInfo.swift was not bumped"
grep -q "VERSION = '$VERSION'" web/js/version.js || die "web/js/version.js was not bumped"
git --no-pager diff --stat -- VERSION mac/Sources/PKMCore/BuildInfo.swift web/js/version.js || true

# ---- 2. tests
step "2/7 tests"
mkdir -p dist
(cd mac && swift test) > dist/release-swift-test.log 2>&1 || { tail -30 dist/release-swift-test.log; die "swift test failed"; }
echo "swift test: $(grep -E 'Executed [0-9]+ tests' dist/release-swift-test.log | tail -1 | sed 's/^[[:space:]]*//')"
(cd web && node --test test/*.test.mjs) > dist/release-node-test.log 2>&1 || { tail -30 dist/release-node-test.log; die "JS unit tests failed"; }
echo "node --test: $(grep -E '^ℹ (tests|fail)' dist/release-node-test.log | tr '\n' ' ')"
if [ "$BROWSER" = 1 ]; then
  [ -d tools/node_modules/playwright-core ] || die "browser tests need (cd tools && npm ci); or --skip-browser-tests"
  (cd mac && swift build >/dev/null)
  for t in v2-browser sofa12-follow; do
    node "tools/$t.mjs" > "dist/release-$t.log" 2>&1 || { tail -20 "dist/release-$t.log"; die "tools/$t.mjs failed"; }
    echo "$t: $(grep -E 'PASS|FAIL' "dist/release-$t.log" | tail -1)"
  done
else
  echo "browser tests skipped (--skip-browser-tests)"
fi

# ---- 3. build and sign
step "3/7 build and sign"
tools/build-app.sh --identity "$IDENTITY"
APP="$ROOT/dist/SofaPad.app"
PLIST="$APP/Contents/Info.plist"
[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")" = "$VERSION" ] || die "the app is not $VERSION"

# ---- 4. notarize and staple (phase 2)
step "4/7 notarize"
if [ -n "$PROFILE" ]; then
  NZ="$ROOT/dist/notarize/SofaPad-$VERSION.zip"
  rm -rf "$(dirname "$NZ")"; mkdir -p "$(dirname "$NZ")"
  ditto -c -k --keepParent "$APP" "$NZ"
  RESULT="$(xcrun notarytool submit "$NZ" --keychain-profile "$PROFILE" --wait --output-format json)"
  echo "$RESULT"
  echo "$RESULT" | grep -q '"status" *: *"Accepted"' || die "not accepted; see: xcrun notarytool log <id> --keychain-profile $PROFILE"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"
  spctl --assess --type execute --verbose=2 "$APP"
else
  echo "not notarized (no --notary-profile)"
fi

# ---- 5. zip
step "5/7 package"
tools/package.sh --app "$APP" --version "$VERSION"

# ---- 6. sign the zip, write and sign the update feed
step "6/7 update feed (EdDSA)"
[ -x "$SPARKLE_BIN/sign_update" ] || (cd mac && swift package resolve >/dev/null)
PUBLIC="$(tr -d '[:space:]' < tools/sparkle-public-key.txt)"
[ "$("$SPARKLE_BIN/generate_keys" --account "$ACCOUNT" -p)" = "$PUBLIC" ] \
  || die "the EdDSA key in the Keychain (account $ACCOUNT) is not the one in tools/sparkle-public-key.txt (docs/RELEASING.md)"
[ "$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$PLIST")" = "$PUBLIC" ] || die "the app carries another SUPublicEDKey"
# The private key goes from the Keychain to sign_update through a file in a private folder that is removed at once.
# generate_keys made the Keychain item, so it reads it without a prompt; nothing is printed.
KEYDIR="$(mktemp -d)"
trap 'rm -rf "$KEYDIR"' EXIT
chmod 700 "$KEYDIR"
"$SPARKLE_BIN/generate_keys" --account "$ACCOUNT" -x "$KEYDIR/key" >/dev/null
SIG="$("$SPARKLE_BIN/sign_update" --ed-key-file - -p "$OUT/$ZIP" < "$KEYDIR/key")"
URL="https://github.com/$REPO_SLUG/releases/download/v$VERSION/$ZIP"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")"
node tools/appcast.mjs write --version "$VERSION" --build "$BUILD" --url "$URL" --zip "$OUT/$ZIP" \
  --signature "$SIG" --notes "$NOTES" --out "$OUT/appcast.xml"
"$SPARKLE_BIN/sign_update" --ed-key-file - "$OUT/appcast.xml" < "$KEYDIR/key"
rm -rf "$KEYDIR"
node tools/appcast.mjs verify --feed "$OUT/appcast.xml" --zip "$OUT/$ZIP" --key "$PUBLIC"

# ---- 7. release notes for the GitHub release
step "7/7 release notes"
BLOB="https://github.com/$REPO_SLUG/blob/v$VERSION"
sed -e "s|](\.\./\.\./|]($BLOB/|g" -e "s|](\.\./|]($BLOB/docs/|g" "$NOTES" > "$OUT/RELEASE-NOTES-$VERSION.md"
echo "$OUT/RELEASE-NOTES-$VERSION.md"

TARGET="$(git rev-parse HEAD)"
DIRTY="$(git status --porcelain --untracked-files=no)"
printf '\nReady: dist/release/%s (+ .sha256), dist/release/appcast.xml. Nothing was pushed, tagged or published.\n' "$ZIP"
if [ -n "$DIRTY" ]; then
  echo "NOTE: these changes are not committed, so they are not in $TARGET; commit them and run this again:"
  echo "$DIRTY"
fi
echo "To publish (coordinator, from the repository folder, after pushing $TARGET):"
echo
echo "gh release create v$VERSION --repo $REPO_SLUG --target $TARGET --title \"SofaPad $VERSION\"" \
  "--notes-file dist/release/RELEASE-NOTES-$VERSION.md dist/release/$ZIP dist/release/$ZIP.sha256 dist/release/appcast.xml"
