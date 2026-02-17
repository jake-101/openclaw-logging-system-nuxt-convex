#!/usr/bin/env python3
"""One-off backfill: create Convex log events for session JSONLs modified recently.

This script creates log events for notable actions (errors, slow turns, tool calls, etc.)
but does NOT create modelUsage records or update session stats. Use convex_log_sync.py
with --backfill for full historical sync.

Usage:
    python3 backfill_logs_6h.py
    HOURS=12 python3 backfill_logs_6h.py

Environment Variables:
    CONVEX_URL   - Convex backend URL (default: http://localhost:3210)
    SESSIONS_DIR - Path to OpenClaw session JSONLs (default: ~/.openclaw/agents/main/sessions)
    AGENT_ID     - Agent identifier (default: openclaw)
    HOURS        - Hours of history to process (default: 6)
    CONVEX_DEBUG - Set to any value to enable debug output
"""

from __future__ import annotations

import os
import sys
import json
import time
from typing import Any, Optional, List

# Add lib directory to path for imports
LIB_DIR = os.path.dirname(__file__)
sys.path.insert(0, LIB_DIR)

import convex_log_sync as cls  # type: ignore

# ============================================================================
# CONFIGURATION - Override via environment variables
# ============================================================================

AGENT_ID = os.environ.get("AGENT_ID", "openclaw")


def _model_full(m: dict, obj: dict) -> Optional[str]:
    """Build full model identifier (provider/model)."""
    provider = m.get("provider") or obj.get("provider")
    model = m.get("model") or obj.get("model")
    if provider and model:
        return f"{provider}/{model}"
    return None


def backfill_file(path: str) -> int:
    """Process a single file and create log events.
    
    Args:
        path: Path to the session JSONL file.
        
    Returns:
        Number of log events created.
    """
    session_id, _kind = cls._read_session_id_and_kind(path)
    session_key = session_id or os.path.basename(path).removesuffix(".jsonl")

    agent_id = AGENT_ID
    id_map: dict[str, int] = {}
    log_events: List[dict] = []
    last_model: Optional[str] = None

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue

            msg_ts = cls._parse_ts_ms(obj.get("timestamp"))
            obj_id = obj.get("id")
            if obj_id:
                id_map[str(obj_id)] = int(msg_ts)

            duration_ms = 0
            parent_id = obj.get("parentId")
            if parent_id:
                parent_ts = id_map.get(str(parent_id))
                if parent_ts is not None:
                    duration_ms = max(0, int(msg_ts) - int(parent_ts))

            m = obj.get("message") if isinstance(obj.get("message"), dict) else None
            role = m.get("role") if isinstance(m, dict) else None

            # (1) Errors: assistant stopReason
            if role == "assistant" and isinstance(m, dict) and m.get("stopReason") == "error":
                log_events.append(
                    cls._make_log_args(
                        session_key=session_key,
                        agent_id=agent_id,
                        timestamp_ms=msg_ts,
                        level="error",
                        message=f"API error: {m.get('stopReason')}",
                        model=_model_full(m, obj),
                    )
                )

            # (1) Errors: toolResult errors
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
                        cls._make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="error",
                            message=f"Tool failed: {tool_name or 'unknown'}",
                            tool_name=str(tool_name) if tool_name else None,
                            tool_success=False,
                        )
                    )

            if role != "assistant" or not isinstance(m, dict):
                continue

            model_full = _model_full(m, obj)

            # (3) Slow turns
            if duration_ms and duration_ms > 20000:
                usage = m.get("usage") if isinstance(m.get("usage"), dict) else {}
                input_t = usage.get("inputTokens")
                output_t = usage.get("outputTokens")
                log_events.append(
                    cls._make_log_args(
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
                    cls._make_log_args(
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
            if not isinstance(content, list):
                continue

            tcalls = [it for it in content if isinstance(it, dict) and it.get("type") == "toolCall"]
            for tc in tcalls:
                name = tc.get("name") or tc.get("toolName")
                args = tc.get("arguments") if isinstance(tc.get("arguments"), dict) else {}

                # (2) Sub-agent spawns
                if name == "sessions_spawn":
                    label = args.get("label")
                    sub_model = args.get("model")
                    sub_agent = args.get("agentId")
                    log_events.append(
                        cls._make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="info",
                            message=f"Spawned sub-agent: {label} on {sub_model}",
                            tool_name="sessions_spawn",
                            tool_success=True,
                            metadata={"label": label, "model": sub_model, "agentId": sub_agent},
                            model=model_full,
                        )
                    )

                # (5) External messages
                if name == "message":
                    channel = args.get("channel")
                    target = args.get("target")
                    log_events.append(
                        cls._make_log_args(
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
                        cls._make_log_args(
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
                        cls._make_log_args(
                            session_key=session_key,
                            agent_id=agent_id,
                            timestamp_ms=msg_ts,
                            level="info",
                            message=f"Cron job created: {job_name}",
                            tool_name="cron",
                            tool_success=True,
                            metadata={"schedule": schedule, "payload_kind": payload_kind},
                            model=model_full,
                        )
                    )

    created = 0
    for ev in log_events:
        res = cls.mutation("logs:create", ev)
        if res and res.get("status") == "success":
            created += 1
        else:
            cls._debug(
                f"logs:create failed (backfill) sessionKey={session_key} ts={ev.get('timestamp')} level={ev.get('level')}"
            )
    return created


def main() -> int:
    """Main entry point."""
    hours = float(os.environ.get("HOURS", "6"))
    cutoff = time.time() - hours * 3600

    files = [p for p in cls._iter_session_files() if os.stat(p).st_mtime >= cutoff]
    if not files:
        print(f"[backfill_logs_6h] No session JSONL files modified in last {hours}h")
        return 0

    total_logs = 0
    for idx, path in enumerate(files, 1):
        created = backfill_file(path)
        total_logs += created
        print(f"[backfill_logs_6h] {idx}/{len(files)} {os.path.basename(path)} logs_created={created}")

    print(f"[backfill_logs_6h] Done. files={len(files)} logs_created={total_logs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
