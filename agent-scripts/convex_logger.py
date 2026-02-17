"""
ConvexLogger - Python wrapper for OpenClaw Convex logging dashboard.

A lightweight logger that sends log events directly to your Convex backend.

Usage:
    from convex_logger import ConvexLogger, get_logger
    
    # Quick setup (uses env vars)
    logger = get_logger("my-script")
    logger.info("Script started")
    logger.error("Something failed", error_type="ValidationError", context={"input": data})
    
    # Or with explicit config
    logger = ConvexLogger(
        convex_url="http://localhost:3210",
        agent_id="myagent",
        script_name="my-script"
    )
    logger.start_session()
    logger.info("Processing...")
    logger.end_session()

Environment Variables:
    CONVEX_URL   - Convex backend URL (default: http://localhost:3210)
    AGENT_ID     - Agent identifier (default: openclaw)
    CONVEX_DEBUG - Set to any value to enable debug output
"""

import os
import time
import random
import string
from datetime import datetime
from typing import Any, Optional, Literal
import urllib.request
import json

# ============================================================================
# CONFIGURATION - Override via environment variables
# ============================================================================

LogLevel = Literal["debug", "info", "warn", "error"]


def _get_convex_url() -> str:
    """Get Convex URL from environment or use default."""
    return os.environ.get("CONVEX_URL", "http://localhost:3210")


def _get_agent_id() -> str:
    """Get agent ID from environment or use default."""
    return os.environ.get("AGENT_ID", "openclaw")


def _short_id() -> str:
    """Generate a short random ID."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


class ConvexLogger:
    """Sync logger for Convex dashboard."""
    
    def __init__(
        self,
        convex_url: Optional[str] = None,
        agent_id: Optional[str] = None,
        script_name: Optional[str] = None,
        kind: str = "script",
        auto_start: bool = True,
    ):
        """Initialize the logger.
        
        Args:
            convex_url: Convex backend URL. Defaults to CONVEX_URL env var or localhost.
            agent_id: Agent identifier. Defaults to AGENT_ID env var or 'openclaw'.
            script_name: Name of the script/task for session key generation.
            kind: Session kind (e.g., 'script', 'main', 'cron').
            auto_start: Whether to automatically start the session on init.
        """
        self.convex_url = convex_url or _get_convex_url()
        self.agent_id = agent_id or _get_agent_id()
        self.script_name = script_name
        self.kind = kind
        
        # Generate session key
        date = datetime.now().strftime("%Y-%m-%d")
        prefix = script_name or "script"
        self.session_key = f"{self.agent_id}-{prefix}-{date}-{_short_id()}"
        
        # Stats tracking
        self._stats = {
            "message_count": 0,
            "tool_calls": 0,
            "errors": 0,
        }
        self._started = False
        
        if auto_start:
            self.start_session()
    
    def _mutation(self, path: str, args: dict) -> Optional[dict]:
        """Execute a Convex mutation (sync)."""
        try:
            data = json.dumps({"path": path, "args": args}).encode("utf-8")
            req = urllib.request.Request(
                f"{self.convex_url}/api/mutation",
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            # Fail silently - logging shouldn't break scripts
            if os.environ.get("CONVEX_DEBUG"):
                print(f"[convex_logger] Mutation {path} failed: {e}")
            return None
    
    def start_session(self) -> str:
        """Initialize session in Convex.
        
        Returns:
            The session key.
        """
        self._mutation("sessions:upsert", {
            "sessionKey": self.session_key,
            "agentId": self.agent_id,
            "kind": self.kind,
        })
        self._started = True
        return self.session_key
    
    def log(
        self,
        level: LogLevel,
        message: str,
        *,
        metadata: Optional[dict] = None,
        model: Optional[str] = None,
        channel: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_duration: Optional[int] = None,
        tool_success: Optional[bool] = None,
    ) -> None:
        """Log a message at any level.
        
        Args:
            level: Log level (debug, info, warn, error).
            message: Log message.
            metadata: Additional metadata dict.
            model: Model identifier (e.g., 'anthropic/claude-3').
            channel: Communication channel (e.g., 'discord', 'telegram').
            tool_name: Name of tool being executed.
            tool_duration: Tool execution duration in ms.
            tool_success: Whether tool succeeded.
        """
        self._stats["message_count"] += 1
        if tool_name:
            self._stats["tool_calls"] += 1
        
        args: dict[str, Any] = {
            "sessionKey": self.session_key,
            "timestamp": int(time.time() * 1000),
            "level": level,
            "message": message,
            "agentId": self.agent_id,
        }
        
        if metadata:
            args["metadata"] = metadata
        if model:
            args["model"] = model
        if channel:
            args["channel"] = channel
        if tool_name:
            args["toolName"] = tool_name
        if tool_duration is not None:
            args["toolDuration"] = tool_duration
        if tool_success is not None:
            args["toolSuccess"] = tool_success
        
        self._mutation("logs:create", args)
    
    def debug(self, message: str, **kwargs) -> None:
        """Log debug message."""
        self.log("debug", message, **kwargs)
    
    def info(self, message: str, **kwargs) -> None:
        """Log info message."""
        self.log("info", message, **kwargs)
    
    def warn(self, message: str, **kwargs) -> None:
        """Log warning message."""
        self.log("warn", message, **kwargs)
    
    def error(
        self,
        message: str,
        error_type: str = "ScriptError",
        stack: Optional[str] = None,
        context: Optional[dict] = None,
        **kwargs
    ) -> None:
        """Log error and create error entry.
        
        Args:
            message: Error message.
            error_type: Type/class of error.
            stack: Stack trace.
            context: Additional context dict.
            **kwargs: Additional args passed to log().
        """
        self._stats["errors"] += 1
        self.log("error", message, **kwargs)
        
        # Also create error entry
        error_args: dict[str, Any] = {
            "sessionKey": self.session_key,
            "timestamp": int(time.time() * 1000),
            "errorType": error_type,
            "message": message,
        }
        if stack:
            error_args["stack"] = stack
        if context:
            error_args["context"] = context
        
        self._mutation("errors:create", error_args)
    
    def log_tool_call(
        self,
        tool_name: str,
        duration_ms: int,
        success: bool,
        message: Optional[str] = None,
    ) -> None:
        """Log a tool/command execution.
        
        Args:
            tool_name: Name of the tool.
            duration_ms: Execution time in milliseconds.
            success: Whether the tool succeeded.
            message: Optional custom message.
        """
        self.log(
            "info" if success else "error",
            message or f"Tool {tool_name} {'succeeded' if success else 'failed'} ({duration_ms}ms)",
            tool_name=tool_name,
            tool_duration=duration_ms,
            tool_success=success,
        )
    
    def log_rate_limit(
        self,
        provider: str,
        endpoint: str,
        retry_after: Optional[int] = None,
        context: Optional[dict] = None,
    ) -> None:
        """Log a rate limit event (429 or approaching limit).
        
        Args:
            provider: API provider name.
            endpoint: Specific endpoint that was rate limited.
            retry_after: Seconds to wait before retry.
            context: Additional context.
        """
        self._mutation("rateLimits:create", {
            "sessionKey": self.session_key,
            "timestamp": int(time.time() * 1000),
            "provider": provider,
            "endpoint": endpoint,
            "retryAfter": retry_after,
            "context": context or {},
        })
        self.log("warn", f"Rate limit hit: {provider} ({endpoint})", metadata={
            "provider": provider,
            "endpoint": endpoint,
            "retry_after": retry_after,
        })
    
    def flush_stats(self, total_tokens: int = 0, estimated_cost: float = 0) -> None:
        """Flush current stats to session.
        
        Args:
            total_tokens: Total tokens used in session.
            estimated_cost: Estimated cost in USD.
        """
        self._mutation("sessions:upsert", {
            "sessionKey": self.session_key,
            "agentId": self.agent_id,
            "kind": self.kind,
            "messageCount": self._stats["message_count"],
            "toolCalls": self._stats["tool_calls"],
            "errors": self._stats["errors"],
            "totalTokens": total_tokens,
            "estimatedCost": estimated_cost,
        })
    
    def end_session(self, total_tokens: int = 0, estimated_cost: float = 0) -> None:
        """End session and flush final stats.
        
        Args:
            total_tokens: Total tokens used in session.
            estimated_cost: Estimated cost in USD.
        """
        self.info("Session ended")
        self.flush_stats(total_tokens, estimated_cost)
    
    # Context manager support
    def __enter__(self):
        if not self._started:
            self.start_session()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            import traceback
            self.error(
                str(exc_val),
                error_type=exc_type.__name__,
                stack=traceback.format_exc(),
            )
        self.end_session()
        return False  # Don't suppress exceptions


def get_logger(
    script_name: Optional[str] = None,
    agent_id: Optional[str] = None,
    kind: str = "script",
) -> ConvexLogger:
    """Quick helper to get a logger instance.
    
    Args:
        script_name: Name of the script for session key.
        agent_id: Agent identifier. Defaults to AGENT_ID env var.
        kind: Session kind.
        
    Returns:
        Configured ConvexLogger instance.
    """
    return ConvexLogger(
        agent_id=agent_id,
        script_name=script_name,
        kind=kind,
        auto_start=True,
    )


# Example usage / CLI test
if __name__ == "__main__":
    import sys
    
    script_name = sys.argv[1] if len(sys.argv) > 1 else "test-script"
    
    with ConvexLogger(script_name=script_name) as logger:
        print(f"Session: {logger.session_key}")
        
        logger.info("Script started", metadata={"args": sys.argv})
        
        # Simulate some work
        start = time.time()
        time.sleep(0.1)
        logger.log_tool_call("sleep", int((time.time() - start) * 1000), True)
        
        logger.warn("This is a test warning")
        
        print("✅ Test logs sent")
