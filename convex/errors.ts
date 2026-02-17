import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const unresolved = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('errors')
      .withIndex('by_unresolved', q => q.eq('resolved', false))
      .order('desc')
      .take(100)
  }
})

export const bySession = query({
  args: {
    sessionKey: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('errors')
      .withIndex('by_session', q => q.eq('sessionKey', args.sessionKey))
      .order('desc')
      .take(100)
  }
})

export const create = mutation({
  args: {
    sessionKey: v.string(),
    timestamp: v.number(),
    errorType: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.optional(v.any()),
    resolved: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('errors', {
      ...args,
      resolved: args.resolved ?? false
    })
  }
})

export const markResolved = mutation({
  args: {
    id: v.id('errors')
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { resolved: true })
  }
})
