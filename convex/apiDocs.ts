import { query } from './_generated/server'

/**
 * Self-documenting API endpoint. Agents should call this on first
 * connect to discover available mutations, expected arguments, and
 * conventions. This is the source of truth -- if docs/agent-integration.md
 * drifts, this endpoint is authoritative.
 */
export const describe = query({
  args: {},
  handler: async () => {
    return {
      version: '1.0.0',
      description: 'OpenClaw Agent Logging System API',

      conventions: {
        timestamps: 'Unix milliseconds (Date.now())',
        sessionKey: 'Unique string per agent session. Recommended format: "{agentId}-{ISO date}-{short-uuid}" e.g. "openclaw-2026-02-16-a3f2dd"',
        agentId: 'Stable identifier for the agent instance, e.g. "openclaw"',
        logLevels: {
          debug: 'Verbose internals -- tool args, prompt fragments, decision traces. Off by default in dashboard.',
          info: 'Normal operations -- session start/end, task completed, message sent.',
          warn: 'Recoverable issues -- retry needed, rate limit hit, fallback used.',
          error: 'Failures -- unhandled exception, tool crash, API timeout. Also creates an entry in the errors table.'
        }
      },

      lifecycle: {
        description: 'Recommended call sequence for an agent session',
        steps: [
          '1. Call sessions.upsert with sessionKey, agentId, kind to register the session',
          '2. Call logs.create for each loggable event during the session',
          '3. On errors, call both logs.create (level: "error") AND errors.create for the error dashboard',
          '4. Periodically call sessions.upsert to update stats (messageCount, toolCalls, tokenUsage, cost)',
          '5. At session end, call sessions.upsert one final time with totals'
        ]
      },

      mutations: {
        'logs.create': {
          description: 'Write a single log entry',
          args: {
            sessionKey: { type: 'string', required: true },
            timestamp: { type: 'number', required: true, note: 'Date.now()' },
            level: { type: '"debug" | "info" | "warn" | "error"', required: true },
            message: { type: 'string', required: true },
            agentId: { type: 'string', required: true },
            metadata: { type: 'any', required: false, note: 'Arbitrary JSON blob for structured data' },
            model: { type: 'string', required: false, note: 'LLM model name, e.g. "claude-sonnet-4-20250514"' },
            channel: { type: 'string', required: false, note: 'Communication channel, e.g. "discord", "slack"' },
            toolName: { type: 'string', required: false, note: 'Name of tool if this log is about a tool call' },
            toolDuration: { type: 'number', required: false, note: 'Tool execution time in ms' },
            toolSuccess: { type: 'boolean', required: false, note: 'Whether the tool call succeeded' }
          }
        },
        'sessions.upsert': {
          description: 'Create or update a session. Call on session start and periodically to update stats.',
          args: {
            sessionKey: { type: 'string', required: true },
            agentId: { type: 'string', required: true },
            kind: { type: 'string', required: true, note: '"main", "isolated", "background", etc.' },
            messageCount: { type: 'number', required: false },
            toolCalls: { type: 'number', required: false },
            errors: { type: 'number', required: false },
            totalTokens: { type: 'number', required: false },
            estimatedCost: { type: 'number', required: false, note: 'USD estimate' }
          }
        },
        'errors.create': {
          description: 'Track an error for the error dashboard. Use alongside a logs.create(level: "error") call.',
          args: {
            sessionKey: { type: 'string', required: true },
            timestamp: { type: 'number', required: true },
            errorType: { type: 'string', required: true, note: 'Error class name or category, e.g. "ToolExecutionError"' },
            message: { type: 'string', required: true },
            stack: { type: 'string', required: false },
            context: { type: 'any', required: false, note: 'JSON blob with relevant context' },
            resolved: { type: 'boolean', required: false, note: 'Defaults to false' }
          }
        },
        'cronRuns.upsert': {
          description: 'Record or update a cron job run. Idempotent on jobId+runId.',
          args: {
            jobId: { type: 'string', required: true, note: 'OpenClaw cron job identifier' },
            runId: { type: 'string', required: true, note: 'Unique run identifier' },
            jobName: { type: 'string', required: false, note: 'Human-readable job name' },
            scheduledAt: { type: 'number', required: true, note: 'When the job was supposed to run (ms)' },
            completedAt: { type: 'number', required: true, note: 'When the job actually finished (ms)' },
            durationMs: { type: 'number', required: true, note: 'Execution time in ms' },
            status: { type: 'string', required: true, note: '"ok" | "failed" | "timeout"' },
            summary: { type: 'string', required: false, note: 'Brief description of what happened' },
            sessionKey: { type: 'string', required: false, note: 'Link to agent session if applicable' },
            error: { type: 'string', required: false, note: 'Error message if failed' }
          }
        },
        'rateLimits.create': {
          description: 'Record a rate limit event from an API provider.',
          args: {
            sessionKey: { type: 'string', required: true },
            timestamp: { type: 'number', required: true },
            provider: { type: 'string', required: true, note: '"anthropic" | "openai" | "openrouter" | etc' },
            endpoint: { type: 'string', required: false, note: 'API endpoint that was rate limited' },
            retryAfter: { type: 'number', required: false, note: 'Seconds until retry (from response header)' },
            context: { type: 'any', required: false, note: 'Additional context about the request' }
          }
        },
        'modelUsage.create': {
          description: 'Record a model API call with token counts, latency, and cost.',
          args: {
            sessionKey: { type: 'string', required: true },
            timestamp: { type: 'number', required: true },
            provider: { type: 'string', required: true, note: '"anthropic" | "openai" | "openrouter" | etc' },
            model: { type: 'string', required: true, note: '"claude-sonnet-4-5" | "gpt-5.2" | etc' },
            channel: { type: 'string', required: false, note: '"telegram" | "discord" | "cron"' },
            inputTokens: { type: 'number', required: true },
            outputTokens: { type: 'number', required: true },
            cacheReadTokens: { type: 'number', required: false },
            cacheWriteTokens: { type: 'number', required: false },
            totalTokens: { type: 'number', required: true },
            durationMs: { type: 'number', required: true, note: 'API call duration in ms' },
            costUsd: { type: 'number', required: false, note: 'Estimated cost in USD' },
            contextLimit: { type: 'number', required: false, note: 'Max context window tokens' },
            contextUsed: { type: 'number', required: false, note: 'Tokens used in context' }
          }
        }
      },

      authentication: {
        description: 'Dashboard is protected by Better Auth (https://better-auth.com) via the @convex-dev/better-auth Convex component. Agent API endpoints (logs, sessions, errors, etc.) do not require auth -- only the dashboard web UI does.',
        note: 'Auth is handled via HTTP endpoints on the Convex site deployment (*.convex.site/api/auth/*). Users are managed through Better Auth directly -- not via Convex mutations.',
        queries: {
          'auth.getCurrentUser': 'Get the currently authenticated user from the Better Auth component. Returns user object or null.'
        }
      },

      queries: {
        'logs.list': 'List logs, optionally filtered by sessionKey, level, limit',
        'logs.countToday': 'O(1) count of logs created today -- reads from atomic logCounters table',
        'logs.search': 'Search logs by message/agent/tool content with optional sessionKey and level filters',
        'sessions.list': 'List sessions ordered by last activity',
        'sessions.get': 'Get a single session by sessionKey',
        'errors.unresolved': 'List all unresolved errors',
        'errors.bySession': 'List errors for a specific session',
        'cronRuns.listRecent': 'List recent cron runs, optionally filtered by status',
        'cronRuns.listByJob': 'List runs for a specific job ID',
        'cronRuns.getJobStats': 'Get success/failure/duration stats for a job over N days (uses index range, no full collect)',
        'rateLimits.listRecent': 'List recent rate limit events within N hours',
        'rateLimits.listByProvider': 'List rate limit events for a specific provider',
        'rateLimits.getStats': 'Get rate limit stats (total, by provider, hourly rate) over N hours',
        'modelUsage.byModel': 'Aggregate model usage stats (calls, tokens, cost, latency) over N hours',
        'modelUsage.byProvider': 'Aggregate provider usage stats (calls, tokens, cost, models) over N hours',
        'modelUsage.latencyStats': 'Get latency percentiles (p50/p90/p95/p99) optionally filtered by model',
        'modelUsage.dailySummary': 'Daily aggregated calls, tokens, and cost over N days -- reads from pre-aggregated dailyStats table (max 7 rows)',
        'analytics.summary': 'Server-side analytics aggregate for the dashboard (totalCost, totalTokens, totalToolCalls, costTimeline, tokenTimeline, toolStats, levelDistribution)',
        'dashboard.snapshot': 'Single snapshot query for the dashboard home page (recentLogs, recentSessions, unresolvedErrors, logsToday)',
        'apiDocs.describe': 'This endpoint -- returns API documentation'
      }
    }
  }
})
