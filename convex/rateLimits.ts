import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const create = mutation({
  args: {
    sessionKey: v.string(),
    timestamp: v.number(),
    provider: v.string(),
    endpoint: v.optional(v.string()),
    retryAfter: v.optional(v.number()),
    context: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('rateLimits', args)
  }
})

export const listByProvider = query({
  args: {
    provider: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rateLimits')
      .withIndex('by_provider', q => q.eq('provider', args.provider))
      .order('desc')
      .take(args.limit ?? 100)
  }
})

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 24) * 60 * 60 * 1000

    return await ctx.db
      .query('rateLimits')
      .withIndex('by_time')
      .order('desc')
      .filter(q => q.gte(q.field('timestamp'), cutoff))
      .take(args.limit ?? 100)
  }
})

export const getStats = query({
  args: {
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 24) * 60 * 60 * 1000

    const events = await ctx.db
      .query('rateLimits')
      .withIndex('by_time')
      .order('desc')
      .filter(q => q.gte(q.field('timestamp'), cutoff))
      .collect()

    const byProvider: Record<string, number> = {}
    for (const event of events) {
      byProvider[event.provider] = (byProvider[event.provider] || 0) + 1
    }

    return {
      total: events.length,
      byProvider,
      hourlyRate: events.length / (args.hours ?? 24)
    }
  }
})
