# Agent Scripts

Python scripts for syncing OpenClaw session data to the Convex logging dashboard.

These scripts read OpenClaw session JSONL files and push structured data to your Convex backend. No pip dependencies -- Python standard library only.

## Scripts

| Script | Description |
|--------|-------------|
| `convex_log_sync.py` | Main sync. Reads session JSONLs, creates modelUsage records, updates session stats, creates log events for notable actions. |
| `convex_logger.py` | Python logger wrapper. Use in your own scripts to log directly to Convex. |
| `convex_cron_sync.py` | Syncs OpenClaw cron job run history to Convex. Requires the `openclaw` CLI. |
| `backfill_logs_6h.py` | One-off backfill for recent sessions (log events only, no modelUsage). |

## Requirements

- Python 3.10+
- A running Convex backend with the logging system schema deployed
- OpenClaw CLI installed (for `convex_cron_sync.py` only)

## Configuration

All scripts use environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONVEX_URL` | `http://localhost:3210` | Convex backend URL |
| `SESSIONS_DIR` | `~/.openclaw/agents/main/sessions` | Path to OpenClaw session JSONL files |
| `STATE_FILE` | `~/.openclaw/workspace/memory/convex-sync-state.json` | Sync state persistence file |
| `AGENT_ID` | `openclaw` | Agent identifier for session keys |
| `HOURS` | `6` | (backfill only) Hours of history to process |
| `CONVEX_DEBUG` | (unset) | Set to any value to enable debug output |

## Usage

### convex_log_sync.py

The main sync script. Tracks byte offsets per file for efficient incremental syncing.

```bash
# Incremental sync (only new data since last run)
python3 convex_log_sync.py

# Full historical backfill
python3 convex_log_sync.py --backfill

# With custom config
CONVEX_URL=http://myserver:3210 AGENT_ID=myagent python3 convex_log_sync.py
```

### convex_logger.py

Use in your own Python scripts for direct logging to the dashboard:

```python
from convex_logger import ConvexLogger, get_logger

# Quick setup
logger = get_logger("my-script")
logger.info("Script started")
logger.warn("Something looks off", metadata={"count": 42})
logger.error("Failed!", error_type="ValueError", context={"input": "bad"})

# With context manager (auto start/end session)
with ConvexLogger(script_name="my-task") as logger:
    logger.info("Processing...")
    logger.log_tool_call("fetch", 150, success=True)
    # Session automatically ends on exit
```

Run standalone to test connectivity:

```bash
python3 convex_logger.py my-test-script
```

### convex_cron_sync.py

Syncs cron job run history. Requires the `openclaw` CLI.

```bash
# Incremental sync (last 24h)
python3 convex_cron_sync.py

# Full history
python3 convex_cron_sync.py --full
```

### backfill_logs_6h.py

Quick backfill for recent sessions. Creates log events only (no modelUsage records).

```bash
# Default: last 6 hours
python3 backfill_logs_6h.py

# Custom time window
HOURS=12 python3 backfill_logs_6h.py
```

## What Gets Synced

### From convex_log_sync.py

**Model Usage** (`modelUsage` table) -- per API call:
- Tokens (input, output, total, cache read/write)
- Cost (USD estimate)
- Duration, provider, model, session key

**Sessions** (`sessions` table) -- aggregated per session:
- Message count, tool calls, error count
- Total tokens and estimated cost

**Log Events** (`logs` table) -- notable actions extracted from sessions:
- API errors and tool failures
- Slow turns (>20s)
- Model switches
- Sub-agent spawns
- External messages (Telegram, Discord, etc.)
- File write/edit operations
- Cron job creation

### From convex_cron_sync.py

**Cron Runs** (`cronRuns` table):
- Job ID, run ID, scheduled/completion times
- Duration, status, session key link

## Sync State

`convex_log_sync.py` maintains state in `STATE_FILE` to track byte offsets per file and accumulated totals per session. This enables efficient incremental syncing without re-processing entire files.

To reset sync state and start fresh:

```bash
rm ~/.openclaw/workspace/memory/convex-sync-state.json
python3 convex_log_sync.py --backfill
```

## Debugging

```bash
CONVEX_DEBUG=1 python3 convex_log_sync.py
```

## Full Setup

For end-to-end setup including the Convex backend and Nuxt dashboard, see the [Setup Guide](../docs/setup-guide.md).
