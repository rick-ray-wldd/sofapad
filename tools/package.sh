#!/bin/bash
# Local release package (SOFA-6): builds dist/SofaPad.app, then dist/release/SofaPad-<version>-macOS.zip with the
# release notes and the install guide, and its SHA-256. Nothing is signed with a Developer ID, notarized or uploaded.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
NAME="SofaPad-$VERSION"
"$ROOT/tools/build-app.sh"
OUT="$ROOT/dist/release"
rm -rf "$OUT"
mkdir -p "$OUT/$NAME"
ditto "$ROOT/dist/SofaPad.app" "$OUT/$NAME/SofaPad.app"
# links that work inside the zip: INSTALL.md next to the notes, the README on GitHub
REPO="https://github.com/rick-ray-wldd/sofapad/blob/main"
sed -e 's|](\.\./INSTALL\.md)|](INSTALL.md)|g' -e "s|](\.\./\.\./|]($REPO/|g" \
  "$ROOT/docs/release/$VERSION.md" > "$OUT/$NAME/RELEASE-NOTES.md"
sed -e "s|](\.\./|]($REPO/|g" "$ROOT/docs/INSTALL.md" > "$OUT/$NAME/INSTALL.md"
cp "$ROOT/LICENSE" "$OUT/$NAME/LICENSE"
cd "$OUT"
if LC_ALL=C grep -r -a -l -F -e "$ROOT" -e "$HOME/" "$NAME"; then echo "a local path is in the package (above)" >&2; exit 1; fi
ditto -c -k --sequesterRsrc --keepParent "$NAME" "$NAME-macOS.zip"
shasum -a 256 "$NAME-macOS.zip" > "$NAME-macOS.zip.sha256"
echo "architectures: $(lipo -archs "$NAME/SofaPad.app/Contents/MacOS/SofaPad")"
codesign -dv "$NAME/SofaPad.app" 2>&1 | grep -E "^(Identifier|Signature|TeamIdentifier)" || true
echo "Packaged $OUT/$NAME-macOS.zip"
cat "$NAME-macOS.zip.sha256"
