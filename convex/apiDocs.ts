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
        sessionKey: 'Unique string per agent session. Recommended format: "{agentId}-{ISO date}-{short-uuid}" e.g. "badgerbot-2026-02-16-a3f2dd"',
        agentId: 'Stable identifier for the agent instance, e.g. "badgerbot"',
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
        }
      },

      queries: {
        'logs.list': 'List logs, optionally filtered by sessionKey, level, limit',
        'logs.search': 'Search logs by message/agent/tool content with optional sessionKey and level filters',
        'sessions.list': 'List sessions ordered by last activity',
        'sessions.get': 'Get a single session by sessionKey',
        'errors.unresolved': 'List all unresolved errors',
        'errors.bySession': 'List errors for a specific session',
        'apiDocs.describe': 'This endpoint -- returns API documentation'
      }
    }
  }
})
