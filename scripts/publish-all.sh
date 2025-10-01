#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

publish_package() {
  local manifest=$1
  local pkg_dir
  pkg_dir=$(dirname "$manifest")

  local name
  name=$(PKG_MANIFEST="$manifest" node -pe "const pkg = require(process.env.PKG_MANIFEST); console.log(pkg.name || '')")

  local is_private
  is_private=$(PKG_MANIFEST="$manifest" node -pe "const pkg = require(process.env.PKG_MANIFEST); console.log(pkg.private ? 'true' : 'false')")

  if [[ "$is_private" == "true" ]]; then
    echo "Skipping $name (private package)"
    return
  fi

  echo "Publishing $name from $pkg_dir"
  (cd "$pkg_dir" && npm publish "$@")
}

publish_package "$ROOT_DIR/package.json" "$@"

for manifest in "$ROOT_DIR"/packages/*/package.json; do
  [[ -f "$manifest" ]] || continue
  publish_package "$manifest" "$@"
done
