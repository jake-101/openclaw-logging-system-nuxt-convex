import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: {
    sessionKey: v.optional(v.string()),
    level: v.optional(v.union(
      v.literal('debug'),
      v.literal('info'),
      v.literal('warn'),
      v.literal('error')
    )),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    if (args.sessionKey) {
      return ctx.db
        .query('logs')
        .withIndex('by_session', q => q.eq('sessionKey', args.sessionKey!))
        .order('desc')
        .take(limit)
    }

    if (args.level) {
      return ctx.db
        .query('logs')
        .withIndex('by_level', q => q.eq('level', args.level!))
        .order('desc')
        .take(limit)
    }

    return ctx.db
      .query('logs')
      .withIndex('by_timestamp')
      .order('desc')
      .take(limit)
  }
})

export const create = mutation({
  args: {
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
    agentId: v.string(),
    model: v.optional(v.string()),
    channel: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolDuration: v.optional(v.number()),
    toolSuccess: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('logs', args)
  }
})
