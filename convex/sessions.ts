import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: {
    limit: v.optional(v.number()),
    activeOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    return ctx.db
      .query('sessions')
      .withIndex('by_activity')
      .order('desc')
      .take(limit)
  }
})

export const get = query({
  args: {
    sessionKey: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('sessions')
      .withIndex('by_key', q => q.eq('sessionKey', args.sessionKey))
      .first()
  }
})

export const upsert = mutation({
  args: {
    sessionKey: v.string(),
    agentId: v.string(),
    kind: v.string(),
    messageCount: v.optional(v.number()),
    toolCalls: v.optional(v.number()),
    errors: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    estimatedCost: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_key', q => q.eq('sessionKey', args.sessionKey))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
        messageCount: args.messageCount ?? existing.messageCount,
        toolCalls: args.toolCalls ?? existing.toolCalls,
        errors: args.errors ?? existing.errors,
        totalTokens: args.totalTokens ?? existing.totalTokens,
        estimatedCost: args.estimatedCost ?? existing.estimatedCost
      })
      return existing._id
    }

    return ctx.db.insert('sessions', {
      sessionKey: args.sessionKey,
      startedAt: now,
      lastActiveAt: now,
      agentId: args.agentId,
      kind: args.kind,
      messageCount: args.messageCount ?? 0,
      toolCalls: args.toolCalls ?? 0,
      errors: args.errors ?? 0,
      totalTokens: args.totalTokens,
      estimatedCost: args.estimatedCost
    })
  }
})
