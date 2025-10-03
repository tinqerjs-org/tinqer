#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

publish_package() {
  local pkg_dir=$1
  shift

  local name
  name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$pkg_dir/package.json" | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

  echo "Publishing $name from $pkg_dir"
  (cd "$pkg_dir" && npm publish --access public "$@")
}

# Publish packages in dependency order
publish_package "$ROOT_DIR/packages/tinqer" "$@"
publish_package "$ROOT_DIR/packages/tinqer-sql-pg-promise" "$@"
publish_package "$ROOT_DIR/packages/tinqer-sql-better-sqlite3" "$@"
