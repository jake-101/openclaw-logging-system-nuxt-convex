#!/usr/bin/env python3
"""Sync OpenClaw session JSONL model usage (tokens/cost) to Convex.

Reads OpenClaw session JSONLs and:
- Creates modelUsage records (per API call)
- Aggregates totals per session and upserts sessions.totalTokens + sessions.estimatedCost
- Creates log events for notable actions (errors, slow turns, tool calls, etc.)

Deduplication:
- Tracks per-file byte offsets in a state file

Usage:
    python3 convex_log_sync.py
    python3 convex_log_sync.py --backfill

Environment Variables:
    CONVEX_URL     - Convex backend URL (default: http://localhost:3210)
    SESSIONS_DIR   - Path to OpenClaw session JSONLs (default: ~/.openclaw/agents/main/sessions)
    STATE_FILE     - Sync state file path (default: ~/.openclaw/workspace/memory/convex-sync-state.json)
    AGENT_ID       - Agent identifier (default: openclaw)
    CONVEX_DEBUG   - Set to any value to enable debug output
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Tuple, List

# ============================================================================
# CONFIGURATION - Override via environment variables
# ============================================================================

CONVEX_URL = os.environ.get("CONVEX_URL", "http://localhost:3210")
SESSIONS_DIR = os.environ.get(
    "SESSIONS_DIR",
    os.path.expanduser("~/.openclaw/agents/main/sessions")
)
STATE_FILE = os.environ.get(
    "STATE_FILE",
    os.path.expanduser("~/.openclaw/workspace/memory/convex-sync-state.json")
)
AGENT_ID = os.environ.get("AGENT_ID", "openclaw")

# ============================================================================
# HELPERS
# ============================================================================


def _debug(msg: str) -> None:
    """Print debug message if CONVEX_DEBUG is set."""
    if os.environ.get("CONVEX_DEBUG"):
        print(f"[convex_log_sync] {msg}", file=sys.stderr)


def mutation(path: str, args: dict) -> Optional[dict]:
    """Execute a Convex mutation."""
    try:
        data = json.dumps({"path": path, "args": args}).encode("utf-8")
        req = urllib.request.Request(
            f"{CONVEX_URL}/api/mutation",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        _debug(f"Mutation {path} failed: {e}")
        return None


def load_state() -> dict:
    """Load sync state from file."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_state(state: dict) -> None:
    """Save sync state to file."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, STATE_FILE)
    except FileNotFoundError:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, sort_keys=True)
            f.write("\n")


def _parse_ts_ms(ts: Any) -> int:
    """Parse ISO timestamp to milliseconds; fall back to now."""
    if isinstance(ts, str) and ts:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except Exception:
            pass
    return int(time.time() * 1000)


def _extract_usage_fields(obj: dict) -> Optional[dict]:
    """Return normalized usage payload or None."""
    container: dict[str, Any] = obj
    if isinstance(obj.get("message"), dict):
        container = obj["message"]

    usage = container.get("usage")
    if not isinstance(usage, dict):
        return None

    provider = container.get("provider")
    model = container.get("model")
    api = container.get("api")

    if not provider or not model:
        return None

    total = usage.get("totalTokens") or usage.get("total")
    input_t = usage.get("inputTokens") or usage.get("input")
    output_t = usage.get("outputTokens") or usage.get("output")

    if total is None and input_t is None and output_t is None:
        return None

    total_i = int(total or 0)
    input_i = int(input_t or 0)
    output_i = int(output_t or 0)

    cost_total = None
    cost = usage.get("cost")
    if isinstance(cost, dict):
        cost_total = cost.get("total")
    elif isinstance(cost, (int, float)):
        cost_total = cost

    cache_read = usage.get("cacheRead")
    cache_write = usage.get("cacheWrite")

    return {
        "timestamp_ms": _parse_ts_ms(obj.get("timestamp")),
        "provider": str(provider),
        "model": str(model),
        "api": str(api) if api else None,
        "inputTokens": input_i,
        "outputTokens": output_i,
        "totalTokens": total_i,
        "cacheReadTokens": int(cache_read or 0) if cache_read is not None else None,
        "cacheWriteTokens": int(cache_write or 0) if cache_write is not None else None,
        "costUsd": float(cost_total) if cost_total is not None else None,
        "durationMs": int(container.get("durationMs") or obj.get("durationMs") or 0),
    }


def _iter_session_files() -> list[str]:
    """List all session JSONL files."""
    return sorted(glob.glob(os.path.join(SESSIONS_DIR, "*.jsonl")))


def _read_session_id_and_kind(path: str) -> Tuple[Optional[str], str]:
    """Read session ID and kind from first few lines of file."""
    session_id = None
    kind = "main"
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for _ in range(10):
                line = f.readline()
                if not line:
                    break
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                if obj.get("type") == "session" and obj.get("id"):
                    session_id = str(obj.get("id"))
                if session_id:
                    break
    except Exception:
        pass
    return session_id, kind


def _make_log_args(
    *,
    session_key: str,
    agent_id: str,
    timestamp_ms: int,
    level: str,
    message: str,
    tool_name: Optional[str] = None,
    tool_duration: Optional[int] = None,
    tool_success: Optional[bool] = None,
    metadata: Any = None,
    model: Optional[str] = None,
    channel: Optional[str] = None,
) -> dict:
    """Build args dict for logs:create mutation."""
    args: dict[str, Any] = {
        "sessionKey": session_key,
        "agentId": agent_id,
        "timestamp": int(timestamp_ms),
        "level": level,
        "message": message,
    }
    if tool_name:
        args["toolName"] = tool_name
    if tool_duration is not None:
        args["toolDuration"] = int(tool_duration)
    if tool_success is not None:
        args["toolSuccess"] = bool(tool_success)
    if metadata is not None:
        args["metadata"] = metadata
    if model:
        args["model"] = model
    if channel:
        args["channel"] = channel
    return args


def sync_file(path: str, *, start_offset: int) -> Tuple[str, str, int, int, float, int, int, int, int, int]:
    """Process a single JSONL file starting at byte offset.

    Returns:
        (session_key, kind, calls_created, new_offset,
         delta_cost_usd, delta_tokens,
         delta_message_count, delta_tool_calls, delta_errors,
         logs_created)
    """
    calls_created = 0
    delta_tokens = 0
    delta_cost = 0.0

    msg_count = 0
    tool_calls = 0
    error_count = 0

    session_id, kind = _read_session_id_and_kind(path)
    session_key = session_id or os.path.basename(path).removesuffix(".jsonl")

    agent_id = AGENT_ID

    id_map: dict[str, int] = {}
    log_events: List[dict] = []
    last_model: Optional[str] = None

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        if start_offset > 0:
            f.seek(start_offset)

        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue

            msg_ts = _parse_ts_ms(obj.get("timestamp"))
            obj_id = obj.get("id")
            if obj_id:
                id_map[str(obj_id)] = int(msg_ts)

            duration_ms = 0
            parent_id = obj.get("parentId")
            if parent_id:
                parent_ts = id_map.get(str(parent_id))
                if parent_ts is not None:
                    duration_ms = max(0, int(msg_ts) - int(parent_ts))

            if obj.get("level") == "error" or obj.get("type") == "error":
                error_count += 1

            m = obj.get("message") if isinstance(obj.get("message"), dict) else None
            role = m.get("role") if isinstance(m, dict) else None

            if isinstance(m, dict):
                if m.get("stopReason") == "error":
                    error_count += 1
                details = m.get("details")
                if isinstance(details, dict) and details.get("status") == "error":
                    error_count += 1

            # (1) Errors
            if role == "assistant" and isinstance(m, dict) and m.get("stopReason") == "error":
                log_events.append(
                    _make_log_args(
                        session_key=session_key,
                        agent_id=agent_id,
                        timestamp_ms=msg_ts,
                        level="error",
                        message=f"API error: {m.get('stopReason')}",
                        model=(
                            f"{m.get('provider')}/{m.get('model')}"
                            if m.get("provider") and m.get("model")
                            else None
                        ),
                    )
                )

            if role == "toolResult" and isinstance(m, dict):
                is_err = False
                if m.get("isError") is True:
                    is_err = True
                details = m.get("details")
                if isinstance(details, dict) and details.get("status") == "error":
                    is_err = True
                if is_err:
                    tool_name = m.get("toolName") or m.get("name") or m.get("tool")
                    log_events.append(
                        _make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="error",
                            message=f"Tool failed: {tool_name or 'unknown'}",
                            tool_name=str(tool_name) if tool_name else None,
                            tool_success=False,
                        )
                    )

            if role == "assistant" and isinstance(m, dict):
                msg_count += 1

                provider = m.get("provider") or obj.get("provider")
                model = m.get("model") or obj.get("model")
                model_full = f"{provider}/{model}" if provider and model else None

                # (3) Slow turns
                if duration_ms and duration_ms > 20000:
                    usage = m.get("usage") if isinstance(m.get("usage"), dict) else {}
                    input_t = usage.get("inputTokens")
                    output_t = usage.get("outputTokens")
                    log_events.append(
                        _make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="warn",
                            message=f"Slow turn: {duration_ms}ms on {model_full or 'unknown'}",
                            model=model_full,
                            metadata={
                                "durationMs": int(duration_ms),
                                "inputTokens": int(input_t) if input_t is not None else None,
                                "outputTokens": int(output_t) if output_t is not None else None,
                            },
                        )
                    )

                # (4) Model switches
                if model_full and last_model and model_full != last_model:
                    log_events.append(
                        _make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="info",
                            message=f"Model switch: {last_model} → {model_full}",
                            model=model_full,
                        )
                    )
                if model_full:
                    last_model = model_full

                content = m.get("content")
                if isinstance(content, list):
                    tcalls = [
                        it
                        for it in content
                        if isinstance(it, dict) and it.get("type") == "toolCall"
                    ]
                    tool_calls += len(tcalls)

                    for tc in tcalls:
                        name = tc.get("name") or tc.get("toolName")
                        args = tc.get("arguments") if isinstance(tc.get("arguments"), dict) else {}

                        # (2) Sub-agent spawns
                        if name == "sessions_spawn":
                            label = args.get("label")
                            sub_model = args.get("model")
                            sub_agent = args.get("agentId")
                            log_events.append(
                                _make_log_args(
                                    session_key=session_key,
                                    agent_id=agent_id,
                                    timestamp_ms=msg_ts,
                                    level="info",
                                    message=f"Spawned sub-agent: {label} on {sub_model}",
                                    tool_name="sessions_spawn",
                                    tool_success=True,
                                    metadata={
                                        "label": label,
                                        "model": sub_model,
                                        "agentId": sub_agent,
                                    },
                                    model=model_full,
                                )
                            )

                        # (5) External messages
                        if name == "message":
                            channel = args.get("channel")
                            target = args.get("target")
                            log_events.append(
                                _make_log_args(
                                    session_key=session_key,
                                    agent_id=agent_id,
                                    timestamp_ms=msg_ts,
                                    level="info",
                                    message=f"Message sent via {channel}",
                                    tool_name="message",
                                    tool_success=True,
                                    metadata={"channel": channel, "target": target},
                                    model=model_full,
                                    channel=str(channel) if channel else None,
                                )
                            )

                        # (6) File writes
                        if name in ("Write", "write", "Edit", "edit"):
                            p = args.get("path") or args.get("file_path") or args.get("filePath")
                            log_events.append(
                                _make_log_args(
                                    session_key=session_key,
                                    agent_id=agent_id,
                                    timestamp_ms=msg_ts,
                                    level="info",
                                    message=f"File written: {p}",
                                    tool_name=str(name),
                                    tool_success=True,
                                    metadata={"path": p},
                                    model=model_full,
                                )
                            )

                        # (7) Cron jobs created
                        if name == "cron" and args.get("action") == "add":
                            job = args.get("job") if isinstance(args.get("job"), dict) else {}
                            job_name = job.get("name") or "unnamed"
                            schedule = job.get("schedule")
                            payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
                            payload_kind = payload.get("kind")
                            log_events.append(
                                _make_log_args(
                                    session_key=session_key,
                                    agent_id=agent_id,
                                    timestamp_ms=msg_ts,
                                    level="info",
                                    message=f"Cron job created: {job_name}",
                                    tool_name="cron",
                                    tool_success=True,
                                    metadata={
                                        "schedule": schedule,
                                        "payload_kind": payload_kind,
                                    },
                                    model=model_full,
                                )
                            )

            payload = _extract_usage_fields(obj)
            if not payload:
                continue

            delta_tokens += int(payload.get("totalTokens") or 0)
            if payload.get("costUsd") is not None:
                delta_cost += float(payload["costUsd"])

            mu_args: dict[str, Any] = {
                "sessionKey": session_key,
                "timestamp": int(payload["timestamp_ms"]),
                "provider": payload["provider"],
                "model": payload["model"],
                "inputTokens": int(payload["inputTokens"]),
                "outputTokens": int(payload["outputTokens"]),
                "totalTokens": int(payload["totalTokens"]),
                # NOTE: This is turn duration (time between parent message
                # and this response), not raw API latency. OpenClaw session
                # JSONLs don't expose per-call API latency separately.
                "durationMs": int(duration_ms),
            }
            if payload.get("cacheReadTokens") is not None:
                mu_args["cacheReadTokens"] = int(payload["cacheReadTokens"])
            if payload.get("cacheWriteTokens") is not None:
                mu_args["cacheWriteTokens"] = int(payload["cacheWriteTokens"])
            if payload.get("costUsd") is not None:
                mu_args["costUsd"] = float(payload["costUsd"])

            res = mutation("modelUsage:create", mu_args)
            if res and res.get("status") == "success":
                calls_created += 1
            else:
                _debug(f"modelUsage:create failed for sessionKey={session_key} ts={mu_args['timestamp']}")

        new_offset = f.tell()

    logs_created = 0
    for ev in log_events:
        res = mutation("logs:create", ev)
        if res and res.get("status") == "success":
            logs_created += 1
        else:
            _debug(
                f"logs:create failed for sessionKey={session_key} ts={ev.get('timestamp')} level={ev.get('level')}"
            )

    return (
        session_key,
        kind,
        calls_created,
        new_offset,
        float(delta_cost),
        int(delta_tokens),
        int(msg_count),
        int(tool_calls),
        int(error_count),
        int(logs_created),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync OpenClaw session data to Convex")
    ap.add_argument("--backfill", action="store_true", help="Process all session JSONLs from the start")
    args = ap.parse_args()

    files = _iter_session_files()
    if not files:
        print(f"[convex_log_sync] No session JSONL files found in {SESSIONS_DIR}")
        return 0

    state = load_state()
    state_files = state.get("files") if isinstance(state.get("files"), dict) else {}

    # First run safety: limit initial scan
    if not state_files:
        files = sorted(files, key=lambda p: os.stat(p).st_mtime, reverse=True)[:50]
        files = sorted(files)

    total_calls = 0
    total_files = 0
    total_tokens = 0
    total_cost = 0.0
    total_logs = 0

    t0 = time.time()
    recent_window_sec = 24 * 3600

    for idx, path in enumerate(files, 1):
        st = os.stat(path)
        prev = state_files.get(path, {}) if isinstance(state_files.get(path), dict) else {}

        if (not args.backfill) and (not prev):
            if (time.time() - float(st.st_mtime)) > recent_window_sec:
                continue

        if args.backfill:
            if (
                prev
                and prev.get("backfillDone") is True
                and int(prev.get("size") or 0) == int(st.st_size)
                and float(prev.get("mtime") or 0) == float(st.st_mtime)
            ):
                continue
            offset = 0
        else:
            offset = int(prev.get("offset") or 0)
            prev_size = int(prev.get("size") or 0)
            if prev_size and st.st_size < prev_size:
                offset = 0
            if offset >= st.st_size:
                continue

        (
            session_key,
            kind,
            calls_created,
            new_offset,
            delta_cost,
            delta_tokens,
            delta_message_count,
            delta_tool_calls,
            delta_errors,
            logs_created,
        ) = sync_file(path, start_offset=offset)

        total_files += 1
        total_calls += calls_created
        total_tokens += delta_tokens
        total_cost += delta_cost
        total_logs += int(logs_created)

        prev_tokens_total = float(prev.get("tokensTotal") or 0)
        prev_cost_total = float(prev.get("costTotal") or 0)
        prev_message_total = int(prev.get("messageCount") or 0)
        prev_tool_calls_total = int(prev.get("toolCalls") or 0)
        prev_errors_total = int(prev.get("errors") or 0)

        if args.backfill:
            tokens_total = float(delta_tokens)
            cost_total = float(delta_cost)
            message_total = int(delta_message_count)
            tool_calls_total = int(delta_tool_calls)
            errors_total = int(delta_errors)
        else:
            tokens_total = prev_tokens_total + float(delta_tokens)
            cost_total = prev_cost_total + float(delta_cost)
            message_total = prev_message_total + int(delta_message_count)
            tool_calls_total = prev_tool_calls_total + int(delta_tool_calls)
            errors_total = prev_errors_total + int(delta_errors)

        if (
            delta_tokens > 0
            or delta_cost > 0
            or delta_message_count > 0
            or delta_tool_calls > 0
            or delta_errors > 0
            or args.backfill
        ):
            mutation(
                "sessions:upsert",
                {
                    "sessionKey": session_key,
                    "agentId": AGENT_ID,
                    "kind": kind,
                    "totalTokens": int(tokens_total),
                    "estimatedCost": float(cost_total),
                    "messageCount": int(message_total),
                    "toolCalls": int(tool_calls_total),
                    "errors": int(errors_total),
                },
            )

        state_files[path] = {
            "offset": int(new_offset),
            "size": int(st.st_size),
            "mtime": float(st.st_mtime),
            "sessionKey": session_key,
            "tokensTotal": float(tokens_total),
            "costTotal": float(cost_total),
            "messageCount": int(message_total),
            "toolCalls": int(tool_calls_total),
            "errors": int(errors_total),
            **({"backfillDone": True} if args.backfill else {}),
        }

        if idx % 25 == 0 or idx == len(files):
            elapsed = time.time() - t0
            print(
                f"[convex_log_sync] Progress {idx}/{len(files)} files | "
                f"processed_files={total_files} new_calls={total_calls} new_logs={total_logs} "
                f"tokens={total_tokens} cost=${total_cost:.6f} elapsed={elapsed:.1f}s"
            )

        if args.backfill or (total_files % 10 == 0):
            state["files"] = state_files
            state["updatedAt"] = int(time.time())
            save_state(state)

    state["files"] = state_files
    state["updatedAt"] = int(time.time())
    state["lastRun"] = {
        "backfill": bool(args.backfill),
        "processedFiles": int(total_files),
        "newCalls": int(total_calls),
        "newLogs": int(total_logs),
        "tokens": int(total_tokens),
        "cost": float(total_cost),
    }
    save_state(state)

    print(
        f"[convex_log_sync] Done. processed_files={total_files} new_calls={total_calls} new_logs={total_logs} "
        f"tokens={total_tokens} cost=${total_cost:.6f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
