# OpenClaw Agent Integration Guide

Connect your OpenClaw agent to the logging dashboard.

## Quick Start

### 1. Install the Convex client

```bash
npm install convex
# or
pnpm add convex
```

### 2. Set the environment variable

```bash
CONVEX_URL=http://your-convex-host:3210  # Your self-hosted Convex instance
```

### 3. Discover the API

The logging system is self-documenting. On first connect, query the API
schema to get current mutations, args, and conventions:

```typescript
import { ConvexHttpClient } from 'convex/browser'
import { api } from './path-to/convex/_generated/api'

const client = new ConvexHttpClient(process.env.CONVEX_URL!)
const docs = await client.query(api.apiDocs.describe)
console.log(docs)
// Returns: full API schema, arg types, conventions, lifecycle docs
```

This endpoint (`apiDocs.describe`) is the source of truth. If this doc
drifts from the actual API, the endpoint is authoritative.

## ConvexLogger Wrapper

Copy this into your agent project. It wraps the three core mutations
with sensible defaults and session management.

```typescript
import { ConvexHttpClient } from 'convex/browser'
import { api } from './convex/_generated/api'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  metadata?: any
  model?: string
  channel?: string
  toolName?: string
  toolDuration?: number
  toolSuccess?: boolean
}

export class ConvexLogger {
  private client: ConvexHttpClient
  private sessionKey: string
  private agentId: string
  private kind: string
  private stats = { messageCount: 0, toolCalls: 0, errors: 0 }

  constructor(convexUrl: string, agentId: string, kind = 'main') {
    this.client = new ConvexHttpClient(convexUrl)
    this.agentId = agentId
    this.kind = kind
    // Generate a unique session key
    const date = new Date().toISOString().split('T')[0]
    const id = Math.random().toString(36).slice(2, 8)
    this.sessionKey = `${agentId}-${date}-${id}`
  }

  /** Call at session start */
  async startSession(): Promise<string> {
    await this.client.mutation(api.sessions.upsert, {
      sessionKey: this.sessionKey,
      agentId: this.agentId,
      kind: this.kind
    })
    return this.sessionKey
  }

  /** Log a message at any level */
  async log(level: LogLevel, message: string, options: LogOptions = {}): Promise<void> {
    this.stats.messageCount++

    if (options.toolName) {
      this.stats.toolCalls++
    }

    await this.client.mutation(api.logs.create, {
      sessionKey: this.sessionKey,
      timestamp: Date.now(),
      level,
      message,
      agentId: this.agentId,
      ...options
    })
  }

  /** Convenience methods */
  async debug(message: string, options?: LogOptions): Promise<void> {
    return this.log('debug', message, options)
  }

  async info(message: string, options?: LogOptions): Promise<void> {
    return this.log('info', message, options)
  }

  async warn(message: string, options?: LogOptions): Promise<void> {
    return this.log('warn', message, options)
  }

  async error(message: string, errorType: string, options?: LogOptions & {
    stack?: string
    context?: any
  }): Promise<void> {
    this.stats.errors++

    // Log to both logs table and errors table
    await Promise.all([
      this.log('error', message, options),
      this.client.mutation(api.errors.create, {
        sessionKey: this.sessionKey,
        timestamp: Date.now(),
        errorType,
        message,
        stack: options?.stack,
        context: options?.context
      })
    ])
  }

  /** Log a tool call with timing */
  async logToolCall(
    toolName: string,
    durationMs: number,
    success: boolean,
    message?: string
  ): Promise<void> {
    await this.log(
      success ? 'info' : 'error',
      message || `Tool ${toolName} ${success ? 'succeeded' : 'failed'} (${durationMs}ms)`,
      { toolName, toolDuration: durationMs, toolSuccess: success }
    )
  }

  /** Flush session stats -- call periodically and at session end */
  async flushStats(extra?: {
    totalTokens?: number
    estimatedCost?: number
  }): Promise<void> {
    await this.client.mutation(api.sessions.upsert, {
      sessionKey: this.sessionKey,
      agentId: this.agentId,
      kind: this.kind,
      messageCount: this.stats.messageCount,
      toolCalls: this.stats.toolCalls,
      errors: this.stats.errors,
      ...extra
    })
  }

  /** Call at session end */
  async endSession(extra?: {
    totalTokens?: number
    estimatedCost?: number
  }): Promise<void> {
    await this.info('Session ended')
    await this.flushStats(extra)
  }

  getSessionKey(): string {
    return this.sessionKey
  }
}
```

## Usage Example

```typescript
const logger = new ConvexLogger(
  process.env.CONVEX_URL!,
  'my-agent',
  'main'
)

// Start
const sessionKey = await logger.startSession()
await logger.info('Agent session started', { channel: 'discord' })

// During operation
await logger.info('Received message from user', {
  metadata: { userId: '12345', content: 'help me debug this' }
})

// Tool calls
const start = Date.now()
try {
  const result = await someToolCall()
  await logger.logToolCall('web-search', Date.now() - start, true)
} catch (err) {
  await logger.logToolCall('web-search', Date.now() - start, false, err.message)
  await logger.error(err.message, 'ToolExecutionError', {
    stack: err.stack,
    context: { tool: 'web-search' }
  })
}

// Periodic stats flush (e.g. every 30 seconds or after batches)
await logger.flushStats({ totalTokens: 15000, estimatedCost: 0.03 })

// End
await logger.endSession({ totalTokens: 42000, estimatedCost: 0.08 })
```

## Log Level Guide

| Level   | When to use                                          | Examples                                            |
|---------|------------------------------------------------------|-----------------------------------------------------|
| `debug` | Verbose internals, off by default in dashboard       | Tool args, prompt fragments, decision traces        |
| `info`  | Normal operations                                    | Session start/end, task completed, message received |
| `warn`  | Recoverable issues                                   | Retry needed, rate limit, fallback used             |
| `error` | Failures (also call `errors.create` for error board) | Unhandled exception, tool crash, API timeout        |

## Session Key Conventions

Format: `{agentId}-{YYYY-MM-DD}-{short-id}`

Examples:
- `my-agent-2026-02-16-a3f2dd`
- `my-agent-2026-02-16-x8k2p1`

The session key links logs to sessions. Use one key per logical work
session. If the agent restarts, generate a new key.

## API Reference

Call `apiDocs.describe` for the full, always-current API reference:

```typescript
const docs = await client.query(api.apiDocs.describe)
```

This returns all mutations, queries, argument schemas, conventions,
and the recommended lifecycle sequence. Prefer this over static docs
when building integrations programmatically.
