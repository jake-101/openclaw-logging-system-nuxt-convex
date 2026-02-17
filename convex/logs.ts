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

export const search = query({
  args: {
    searchTerm: v.string(),
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
    const term = args.searchTerm.toLowerCase()

    // Fetch a larger set then filter client-side for message content
    // Convex doesn't support full-text search without a search index
    const candidateLimit = Math.min(limit * 5, 1000)

    let candidates
    if (args.sessionKey) {
      candidates = await ctx.db
        .query('logs')
        .withIndex('by_session', q => q.eq('sessionKey', args.sessionKey!))
        .order('desc')
        .take(candidateLimit)
    } else if (args.level) {
      candidates = await ctx.db
        .query('logs')
        .withIndex('by_level', q => q.eq('level', args.level!))
        .order('desc')
        .take(candidateLimit)
    } else {
      candidates = await ctx.db
        .query('logs')
        .withIndex('by_timestamp')
        .order('desc')
        .take(candidateLimit)
    }

    return candidates
      .filter((log) => {
        const msg = log.message.toLowerCase()
        const agent = log.agentId.toLowerCase()
        const tool = (log.toolName ?? '').toLowerCase()
        return msg.includes(term) || agent.includes(term) || tool.includes(term)
      })
      .slice(0, limit)
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
