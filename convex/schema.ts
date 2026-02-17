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
    .index('by_unresolved', ['resolved', 'timestamp'])
})
