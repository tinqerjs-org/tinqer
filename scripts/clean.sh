#!/usr/bin/env bash
# -------------------------------------------------------------------
# clean.sh – Clean build artifacts and node_modules across all packages
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "=== Cleaning Tinqer build artifacts ==="

# Define packages
PACKAGES=(
  "tinqer"
  "pg-promise-adapter"
  "pg-promise-adapter-integration"
  "better-sqlite3-adapter"
  "better-sqlite3-adapter-integration"
)

# Clean dist directories in all packages
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ -d "$pkg/dist" ]]; then
    echo "Removing $pkg/dist"
    rm -rf "$pkg/dist"
  fi
done

# Clean any .tsbuildinfo files
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

# Clean root node_modules if --all flag is passed
if [[ "${1:-}" == "--all" ]]; then
  if [[ -d "node_modules" ]]; then
    echo "Removing root node_modules"
    rm -rf node_modules
  fi

  # Clean node_modules from all packages
  for pkg_name in "${PACKAGES[@]}"; do
    pkg="packages/$pkg_name"
    if [[ -d "$pkg/node_modules" ]]; then
      echo "Removing $pkg/node_modules"
      rm -rf "$pkg/node_modules"
    fi
  done
fi

echo "=== Clean completed ==="