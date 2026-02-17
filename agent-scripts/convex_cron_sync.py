#!/usr/bin/env python3
"""Sync OpenClaw cron job data to Convex dashboard.

Reads cron job run history from the OpenClaw CLI and syncs to Convex.

Usage:
    python3 convex_cron_sync.py [--full]
    
By default, syncs last 24h of runs. Use --full for complete history.

Environment Variables:
    CONVEX_URL   - Convex backend URL (default: http://localhost:3210)
    CONVEX_DEBUG - Set to any value to enable debug output
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from typing import Any, Optional

# ============================================================================
# CONFIGURATION - Override via environment variables
# ============================================================================

CONVEX_URL = os.environ.get("CONVEX_URL", "http://localhost:3210")


def _debug(msg: str) -> None:
    """Print debug message if CONVEX_DEBUG is set."""
    if os.environ.get("CONVEX_DEBUG"):
        print(f"[convex_cron_sync] {msg}", file=sys.stderr)


def calculate_run_duration(run: dict) -> Optional[int]:
    """Calculate actual duration from embedded run.start/run.end events.
    
    Returns duration in milliseconds, or None if can't be calculated.
    """
    events = run.get("events", [])
    if not events:
        return None
    
    start_ts = None
    end_ts = None
    
    for event in events:
        event_type = event.get("type", "")
        ts = event.get("ts") or event.get("timestamp")
        
        if event_type == "run.start" and ts:
            start_ts = ts
        elif event_type == "run.end" and ts:
            end_ts = ts
    
    # Also check for start/end at top level of run
    if not start_ts:
        start_ts = run.get("startTs") or run.get("startedAt")
    if not end_ts:
        end_ts = run.get("endTs") or run.get("completedAt") or run.get("ts")
    
    if start_ts and end_ts:
        try:
            return int(end_ts - start_ts)
        except (TypeError, ValueError):
            pass
    
    return None


def mutation(path: str, args: dict) -> Optional[dict]:
    """Execute a Convex mutation."""
    try:
        data = json.dumps({"path": path, "args": args}).encode("utf-8")
        req = urllib.request.Request(
            f"{CONVEX_URL}/api/mutation",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        _debug(f"Mutation {path} failed: {e}")
        return None


def run_openclaw_cmd(args: list[str]) -> Optional[dict]:
    """Run an openclaw command and parse JSON output."""
    try:
        result = subprocess.run(
            ["openclaw"] + args + ["--json"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            _debug(f"Command failed: {result.stderr}")
            return None
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        _debug("Command timed out")
        return None
    except json.JSONDecodeError as e:
        _debug(f"JSON parse error: {e}")
        return None


def get_cron_jobs() -> list[dict]:
    """Get list of all cron jobs."""
    try:
        # Prefer JSON output if available
        result = subprocess.run(
            ["openclaw", "cron", "list", "--json"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                if isinstance(data, list):
                    return data
                return data.get("jobs", data.get("entries", []))
            except json.JSONDecodeError:
                pass

        # Fallback: parse text output
        result = subprocess.run(
            ["openclaw", "cron", "list"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            return []

        jobs = []
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        for line in lines:
            if not line.strip():
                continue
            parts = line.split()
            if parts and len(parts[0]) == 36:  # UUID length check
                jobs.append({
                    "jobId": parts[0],
                    "name": " ".join(parts[1:-3]) if len(parts) > 4 else parts[1] if len(parts) > 1 else "",
                    "status": parts[-1] if len(parts) >= 2 else "unknown",
                })
        return jobs
    except Exception as e:
        _debug(f"Failed to get jobs: {e}")
        return []


def get_job_runs(job_id: str) -> list[dict]:
    """Get run history for a specific job via cron tool."""
    try:
        result = subprocess.run(
            ["openclaw", "cron", "runs", job_id],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            return []
        
        try:
            data = json.loads(result.stdout)
            return data.get("entries", [])
        except json.JSONDecodeError:
            return []
    except Exception as e:
        _debug(f"Failed to get runs for {job_id}: {e}")
        return []


def sync_cron_data(full_sync: bool = False):
    """Sync cron job data to Convex."""
    print(f"[convex_cron_sync] Starting {'full' if full_sync else 'incremental'} sync...")
    
    # Get job list from openclaw cron list
    result = subprocess.run(
        ["openclaw", "cron", "list"],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        print(f"[convex_cron_sync] Failed to list jobs", file=sys.stderr)
        return
    
    # Parse job list
    lines = result.stdout.strip().split('\n')
    if len(lines) < 2:
        print("[convex_cron_sync] No jobs found")
        return
    
    jobs_synced = 0
    runs_synced = 0
    
    # Get unique job IDs from the listing
    job_ids = set()
    for line in lines[1:]:
        if line.strip():
            parts = line.split()
            if parts and len(parts[0]) == 36:  # UUID length
                job_ids.add(parts[0])
    
    print(f"[convex_cron_sync] Found {len(job_ids)} jobs")
    
    # Time cutoff for incremental sync
    cutoff_ms = None
    if not full_sync:
        cutoff_ms = int((datetime.now() - timedelta(days=1)).timestamp() * 1000)
    
    for job_id in job_ids:
        try:
            # Get runs for this job
            run_result = subprocess.run(
                ["openclaw", "cron", "runs", "--id", job_id],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if run_result.returncode != 0:
                continue
                
            runs_data = json.loads(run_result.stdout)
            entries = runs_data.get("entries", [])
            
            for run in entries:
                # Skip old runs in incremental mode
                if cutoff_ms and run.get("ts", 0) < cutoff_ms:
                    continue
                
                # Calculate actual duration from events
                duration_ms = calculate_run_duration(run)
                if duration_ms is None:
                    duration_ms = run.get("durationMs", 0)
                    if not duration_ms:
                        scheduled = run.get("runAtMs", 0)
                        completed = run.get("ts", 0)
                        if scheduled and completed and completed > scheduled:
                            duration_ms = completed - scheduled
                
                # Upsert run to Convex
                run_record = {
                    "jobId": job_id,
                    "runId": run.get("sessionId", f"{job_id}-{run.get('ts', 0)}"),
                    "scheduledAt": run.get("runAtMs", 0),
                    "completedAt": run.get("ts", 0),
                    "durationMs": duration_ms,
                    "status": run.get("status", "unknown"),
                    "summary": run.get("summary", ""),
                    "sessionKey": run.get("sessionKey", ""),
                }
                
                result = mutation("cronRuns:upsert", run_record)
                if result and result.get("status") == "success":
                    runs_synced += 1
                    
        except Exception as e:
            _debug(f"Error syncing job {job_id}: {e}")
            continue
        
        jobs_synced += 1
    
    print(f"[convex_cron_sync] Synced {jobs_synced} jobs, {runs_synced} runs")


def main():
    full_sync = "--full" in sys.argv
    sync_cron_data(full_sync)


if __name__ == "__main__":
    main()
