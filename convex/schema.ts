import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Main log entries
  logs: defineTable({
    sessionKey: v.string(),
    timestamp: v.number(),
    level: v.union(
      v.literal('debug'),
      v.literal('info'),
      v.literal('warn'),
      v.literal('error')
    ),
    message: v.string(),
    metadata: v.optional(v.any()),

    // Agent context
    agentId: v.string(),
    model: v.optional(v.string()),
    channel: v.optional(v.string()),

    // Tool execution tracking
    toolName: v.optional(v.string()),
    toolDuration: v.optional(v.number()),
    toolSuccess: v.optional(v.boolean())
  })
    .index('by_session', ['sessionKey', 'timestamp'])
    .index('by_timestamp', ['timestamp'])
    .index('by_level', ['level', 'timestamp'])
    .index('by_tool', ['toolName', 'timestamp']),

  // Session summaries
  sessions: defineTable({
    sessionKey: v.string(),
    startedAt: v.number(),
    lastActiveAt: v.number(),
    agentId: v.string(),
    kind: v.string(),

    // Aggregated stats
    messageCount: v.number(),
    toolCalls: v.number(),
    errors: v.number(),

    // Cost tracking
    totalTokens: v.optional(v.number()),
    estimatedCost: v.optional(v.number())
  })
    .index('by_key', ['sessionKey'])
    .index('by_activity', ['lastActiveAt']),

  // Error tracking
  errors: defineTable({
    sessionKey: v.string(),
    timestamp: v.number(),
    errorType: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.optional(v.any()),
    resolved: v.boolean()
  })
    .index('by_session', ['sessionKey', 'timestamp'])
    .index('by_unresolved', ['resolved', 'timestamp']),

  // Cron job runs
  cronRuns: defineTable({
    jobId: v.string(),
    runId: v.string(),
    jobName: v.optional(v.string()),
    scheduledAt: v.number(),
    completedAt: v.number(),
    durationMs: v.number(),
    status: v.string(),
    summary: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    error: v.optional(v.string())
  })
    .index('by_job', ['jobId', 'completedAt'])
    .index('by_status', ['status', 'completedAt'])
    .index('by_time', ['completedAt']),

  // Rate limit events
  rateLimits: defineTable({
    sessionKey: v.string(),
    timestamp: v.number(),
    provider: v.string(),
    endpoint: v.optional(v.string()),
    retryAfter: v.optional(v.number()),
    context: v.optional(v.any())
  })
    .index('by_provider', ['provider', 'timestamp'])
    .index('by_time', ['timestamp']),

  // Model usage tracking
  modelUsage: defineTable({
    sessionKey: v.string(),
    timestamp: v.number(),
    provider: v.string(),
    model: v.string(),
    channel: v.optional(v.string()),

    // Tokens
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    totalTokens: v.number(),

    // Performance
    durationMs: v.number(),
    costUsd: v.optional(v.number()),

    // Context
    contextLimit: v.optional(v.number()),
    contextUsed: v.optional(v.number())
  })
    .index('by_model', ['model', 'timestamp'])
    .index('by_provider', ['provider', 'timestamp'])
    .index('by_time', ['timestamp'])
    .index('by_session', ['sessionKey', 'timestamp'])
})
