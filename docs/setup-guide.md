# Setup Guide

End-to-end setup for the OpenClaw Logging System -- from Convex deployment to syncing your first agent data.

## What You're Setting Up

```
OpenClaw Agent  -->  Session JSONL files  -->  Python sync scripts  -->  Convex  -->  Nuxt Dashboard
```

The system has three parts:

1. **Convex backend** -- real-time database storing logs, sessions, errors, model usage, cron runs, and rate limits
2. **Nuxt dashboard** -- web UI for viewing and analyzing agent activity
3. **Python sync scripts** -- read OpenClaw session files and push data to Convex

## Prerequisites

- **Node.js 20+** and **pnpm 10+**
- **Python 3.10+** (for the sync scripts -- no pip dependencies needed)
- **A Convex deployment** -- either [self-hosted](https://github.com/get-convex/convex-backend) or [Convex cloud](https://dashboard.convex.dev)
- **OpenClaw** running with session logging enabled

---

## Step 1: Clone and Install

```bash
git clone https://github.com/jake-101/openclaw-logging-system-nuxt-convex.git
cd openclaw-logging-system-nuxt-convex
pnpm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Convex URLs:

```env
# For local/self-hosted Convex:
CONVEX_URL=http://localhost:3210
CONVEX_SITE_URL=http://localhost:3210
CONVEX_SELF_HOSTED_URL=http://localhost:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=your-admin-key

# For Convex cloud:
# CONVEX_URL=https://your-project-123.convex.cloud
# CONVEX_SITE_URL=https://your-project-123.convex.site
```

**Important:** `CONVEX_URL` and `CONVEX_SITE_URL` are different in production. `CONVEX_URL` is the database endpoint (`.convex.cloud`). `CONVEX_SITE_URL` is the HTTP endpoint for auth routes (`.convex.site`). In local dev they're typically both `http://localhost:3210`.

## Step 3: Set Convex Environment Variables

Better Auth needs a secret key and your app's URL set on the Convex deployment:

```bash
# Generate and set the auth secret
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# Set your app URL (for CORS -- the URL where the Nuxt dashboard runs)
npx convex env set SITE_URL "http://localhost:3000"
```

## Step 4: Deploy Convex Functions

```bash
# Development (watches for changes, auto-deploys)
pnpm convex:dev

# Or production (one-time deploy)
pnpm convex:deploy
```

This deploys the schema and all server functions. Leave `pnpm convex:dev` running in a terminal during development.

## Step 5: Create Your Admin Account

Sign-up is disabled by default. To create the first account:

1. **Temporarily enable sign-up** -- in `convex/auth.ts`, set `disableSignUp: false`
2. **Redeploy** -- save the file (if `pnpm convex:dev` is running, it auto-deploys)
3. **Create the account:**

```bash
curl -X POST http://<CONVEX_SITE_URL>/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","name":"Admin"}'
```

4. **Re-enable protection** -- set `disableSignUp: true` in `convex/auth.ts` and redeploy

To add more users later, repeat this process temporarily.

## Step 6: Start the Dashboard

In a separate terminal:

```bash
pnpm dev
```

Open `http://localhost:3000` and log in with the account you created.

**Verify it works:** You should see the dashboard with empty charts and "No logs found" states. If you get redirected to `/login` endlessly, check that `CONVEX_SITE_URL` is set correctly in your `.env`.

## Step 7: Set Up the Sync Scripts

The Python sync scripts in `agent-scripts/` read OpenClaw session JSONL files and push data to Convex. Copy them to a convenient location or run them from the repo.

### Initial Backfill

```bash
# Sync all historical session data
CONVEX_URL=http://localhost:3210 python3 agent-scripts/convex_log_sync.py --backfill
```

### Verify Data

After the backfill, refresh the dashboard. You should see:
- Log entries in the Log Viewer
- Session summaries in the Session Browser
- Model usage charts populated with token/cost data

If nothing appears, enable debug output:

```bash
CONVEX_DEBUG=1 CONVEX_URL=http://localhost:3210 python3 agent-scripts/convex_log_sync.py --backfill
```

## Step 8: Set Up Recurring Sync

### Option A: OpenClaw Cron (Recommended)

```bash
# Sync model usage and logs every 15 minutes
openclaw cron add --name "convex-sync" \
  --schedule "*/15 * * * *" \
  --payload '{"kind":"exec","command":"CONVEX_URL=http://localhost:3210 python3 /path/to/agent-scripts/convex_log_sync.py"}'

# Sync cron run history every hour
openclaw cron add --name "convex-cron-sync" \
  --schedule "0 * * * *" \
  --payload '{"kind":"exec","command":"CONVEX_URL=http://localhost:3210 python3 /path/to/agent-scripts/convex_cron_sync.py"}'
```

### Option B: System Crontab

```bash
crontab -e

# Add:
*/15 * * * * CONVEX_URL=http://localhost:3210 python3 /path/to/agent-scripts/convex_log_sync.py
0 * * * * CONVEX_URL=http://localhost:3210 python3 /path/to/agent-scripts/convex_cron_sync.py
```

---

## Environment Variable Reference

### Nuxt Dashboard (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_URL` | Yes | Convex database URL |
| `CONVEX_SITE_URL` | Yes | Convex HTTP endpoint for auth routes |
| `CONVEX_SELF_HOSTED_URL` | Self-hosted only | URL for `npx convex dev` CLI |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Self-hosted only | Admin key for self-hosted Convex |
| `APP_NAME` | No | Dashboard title (default: "OpenClaw") |
| `APP_LOGO_URL` | No | Logo URL for the dashboard |

### Convex Server (set via `npx convex env set`)

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Random secret for signing auth sessions |
| `SITE_URL` | Yes | Your Nuxt app URL (for CORS) |

### Python Sync Scripts (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `CONVEX_URL` | `http://localhost:3210` | Convex backend URL |
| `SESSIONS_DIR` | `~/.openclaw/agents/main/sessions` | Path to OpenClaw session JSONL files |
| `STATE_FILE` | `~/.openclaw/workspace/memory/convex-sync-state.json` | Sync state persistence file |
| `AGENT_ID` | `openclaw` | Agent identifier for session keys |
| `HOURS` | `6` | (backfill script only) Hours of history |
| `CONVEX_DEBUG` | (unset) | Set to any value for debug output |

---

## Troubleshooting

### Auth redirect loop (stuck on /login)

- Check `CONVEX_SITE_URL` is set in `.env` and points to the correct Convex HTTP endpoint
- Check `BETTER_AUTH_SECRET` is set on the Convex deployment: `npx convex env get BETTER_AUTH_SECRET`
- Check `SITE_URL` on the Convex deployment matches your Nuxt app URL: `npx convex env get SITE_URL`

### Sync script runs but no data appears

- Enable debug: `CONVEX_DEBUG=1 python3 agent-scripts/convex_log_sync.py`
- Verify Convex is reachable: `curl http://localhost:3210/version`
- Check session files exist: `ls ~/.openclaw/agents/main/sessions/*.jsonl`
- Try the backfill flag: `python3 agent-scripts/convex_log_sync.py --backfill`

### "No session JSONL files found"

- Verify `SESSIONS_DIR` points to the correct path
- OpenClaw must have run at least one session to generate JSONL files
- Check the default path: `~/.openclaw/agents/main/sessions/`

### Convex functions won't deploy

- Ensure `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` are set (for self-hosted)
- For cloud: run `npx convex login` first

---

## Next Steps

- **Custom logging from your own scripts** -- See [agent-scripts/README.md](../agent-scripts/README.md) for the `ConvexLogger` Python wrapper
- **TypeScript/JS integration** -- See [docs/agent-integration.md](agent-integration.md) for the TypeScript `ConvexLogger` class
- **API discovery** -- Your agent can query `apiDocs.describe` at runtime to discover all available mutations and their arguments
