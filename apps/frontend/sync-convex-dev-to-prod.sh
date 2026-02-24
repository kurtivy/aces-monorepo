#!/usr/bin/env bash
# Sync Convex data from Development to Production.
# Dev: outstanding-marlin-672 | Prod: benevolent-gecko-492
#
# Prerequisites:
#   - .env.local with CONVEX_DEPLOYMENT=dev:outstanding-marlin-672 (so export runs against dev).
#
# Usage (run from repo root or apps/frontend):
#   bash apps/frontend/sync-convex-dev-to-prod.sh
#   cd apps/frontend && bash sync-convex-dev-to-prod.sh
#
# Warning: --replace overwrites existing production data with the dev snapshot.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ -f .env.local ]; then
  set -a
  # shellcheck source=/dev/null
  source .env.local
  set +a
  echo "Using CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT:-<not set>} for export"
fi

# Use timestamped path so re-runs don't fail; set ZIP_PATH to reuse an existing export
ZIP_PATH="${ZIP_PATH:-./convex-dev-export-$(date +%Y%m%d-%H%M%S).zip}"
echo "Exporting from dev deployment to $ZIP_PATH ..."
npx convex export --path "$ZIP_PATH"

echo "Importing to production (--replace overwrites existing prod data; -y skips confirmation) ..."
npx convex import --prod --replace -y "$ZIP_PATH"

echo "Done. Production Convex now matches dev. You can remove $ZIP_PATH if desired."
