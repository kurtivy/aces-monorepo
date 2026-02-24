# Syncing Convex Dev → Production

Development and production use different Convex deployments:

| Environment | Deployment             | URL                                           |
| ----------- | ---------------------- | --------------------------------------------- |
| **Dev**     | outstanding-marlin-672 | `https://outstanding-marlin-672.convex.cloud` |
| **Prod**    | benevolent-gecko-492   | `https://benevolent-gecko-492.convex.cloud`   |

Data is **not** automatically replicated. To copy data from dev to prod (e.g. after curating content in dev):

## Option 1: Script (recommended)

From the repo root:

```bash
bash apps/frontend/sync-convex-dev-to-prod.sh
```

Or from this directory:

```bash
cd apps/frontend && bash sync-convex-dev-to-prod.sh
```

**Requirements:**

- `apps/frontend/.env.local` must set `CONVEX_DEPLOYMENT=dev:outstanding-marlin-672` so the export runs against dev.
- You will be prompted for Convex auth if needed.

**What it does:**

1. Exports a full snapshot of the **dev** deployment to a timestamped ZIP file (e.g. `convex-dev-export-20250209-123456.zip`).
2. Imports that ZIP into **production** with `--replace -y` (production data is replaced by the dev snapshot; `-y` skips the confirmation prompt).

**Warning:** `--replace` overwrites all existing production table data with the export. Back up prod first in the [Convex dashboard](https://dashboard.convex.dev) (Backup Now) if you need to restore.

## Option 2: Dashboard + CLI

1. **Export from dev**
   - Open [Convex Dashboard](https://dashboard.convex.dev) → select the **dev** deployment (outstanding-marlin-672).
   - Go to **Settings → Backups** → **Backup Now** → wait for completion → **Download** the ZIP.

2. **Import into prod**
   - From `apps/frontend`:  
     `npx convex import --prod --replace /path/to/downloaded-backup.zip`

## Option 3: CLI only

From `apps/frontend` with `.env.local` pointing at dev:

```bash
# Export from dev (uses CONVEX_DEPLOYMENT from .env.local)
npx convex export --path ./convex-dev-export.zip

# Import into prod
npx convex import --prod --replace ./convex-dev-export.zip
```

---

For single-table imports (e.g. CSV/JSON), see [Convex Data Import](https://docs.convex.dev/database/import-export/import).
