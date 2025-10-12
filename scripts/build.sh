#!/usr/bin/env bash
# -------------------------------------------------------------------
# build.sh – monorepo-aware build helper for Tinqer
#
# Flags:
#   --install    Force npm install in every package even if node_modules exists
#   --no-format  Skip prettier formatting (faster builds during development)
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "=== Building Tinqer ==="

# Define the build order
PACKAGES=(
  "tinqer"
  "tinqer-sql-pg-promise"
  "tinqer-sql-pg-promise-integration"
  "tinqer-sql-better-sqlite3"
  "tinqer-sql-better-sqlite3-integration"
)

# 1 ▸ clean first
./scripts/clean.sh

# 2 ▸ install dependencies
if [[ "$*" == *--install* ]]; then
  ./scripts/install-deps.sh --force
else
  ./scripts/install-deps.sh
fi

# 3 ▸ build each package that defines a build script, in order
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ ! -f "$pkg/package.json" ]]; then
    continue
  fi
  # Use node to check for build script instead of jq
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)"; then
    echo "Building $pkg…"
    (cd "$pkg" && npm run build)
  else
    echo "Skipping build for $pkg (no build script)"
  fi
done

# 4 ▸ verify test files compile with strict mode
echo "Verifying test files compile with strict mode…"
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ ! -f "$pkg/package.json" ]]; then
    continue
  fi
  # Check if test:build script exists
  if node -e "process.exit(require('./$pkg/package.json').scripts?.['test:build'] ? 0 : 1)"; then
    echo "Checking test compilation in $pkg…"
    (cd "$pkg" && npm run test:build)
  fi
done

# 5 ▸ run prettier formatting (unless --no-format is passed)
if [[ "$*" != *--no-format* ]]; then
  echo "Running prettier formatting…"
  ./scripts/format-all.sh
else
  echo "Skipping prettier formatting (--no-format flag)"
fi

echo "=== Build completed successfully ==="