#!/usr/bin/env bash
# -------------------------------------------------------------------
# lint-all.sh – run linting across all packages
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

# Check for --fix flag
FIX_FLAG=""
if [[ "${1:-}" == "--fix" ]]; then
  FIX_FLAG="--fix"
  echo "Running linting with auto-fix across all packages..."
else
  echo "Running linting across all packages..."
fi

# Define packages
PACKAGES=(
  "tinqer"
  "tinqer-sql-pg-promise"
  "tinqer-sql-pg-promise-integration"
)

# Track overall success
all_passed=true

# Lint each package
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ ! -f "$pkg/package.json" ]]; then
    continue
  fi

  # Check if lint script exists
  if node -e "process.exit(require('./$pkg/package.json').scripts?.lint ? 0 : 1)"; then
    echo ""
    echo "Linting $pkg_name..."

    # Run with or without fix flag
    if [ -n "$FIX_FLAG" ]; then
      # Check if lint:fix script exists
      if node -e "process.exit(require('./$pkg/package.json').scripts?.['lint:fix'] ? 0 : 1)"; then
        if (cd "$pkg" && npm run lint:fix); then
          echo "✓ $pkg_name lint:fix passed"
        else
          echo "✗ $pkg_name lint:fix failed"
          all_passed=false
        fi
      else
        # Fall back to lint with --fix flag
        if (cd "$pkg" && npm run lint -- --fix); then
          echo "✓ $pkg_name lint --fix passed"
        else
          echo "✗ $pkg_name lint --fix failed"
          all_passed=false
        fi
      fi
    else
      if (cd "$pkg" && npm run lint); then
        echo "✓ $pkg_name lint passed"
      else
        echo "✗ $pkg_name lint failed"
        all_passed=false
      fi
    fi
  fi
done

echo ""
echo "================================"
if [ "$all_passed" = true ]; then
  echo "✓ All packages passed linting!"
  exit 0
else
  echo "✗ Some packages failed linting"
  exit 1
fi