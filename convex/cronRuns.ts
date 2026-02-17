import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('cronRuns')
      .withIndex('by_job', q => q.eq('jobId', args.jobId))
      .filter(q => q.eq(q.field('runId'), args.runId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, args)
      return existing._id
    }

    return await ctx.db.insert('cronRuns', args)
  }
})

export const listByJob = query({
  args: {
    jobId: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cronRuns')
      .withIndex('by_job', q => q.eq('jobId', args.jobId))
      .order('desc')
      .take(args.limit ?? 50)
  }
})

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query('cronRuns')
        .withIndex('by_status', q => q.eq('status', args.status!))
        .order('desc')
        .take(args.limit ?? 100)
    }

    return await ctx.db
      .query('cronRuns')
      .withIndex('by_time')
      .order('desc')
      .take(args.limit ?? 100)
  }
})

export const getJobStats = query({
  args: {
    jobId: v.string(),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.days ?? 30) * 24 * 60 * 60 * 1000

    const MAX_RUNS = 1000
    const runs = await ctx.db
      .query('cronRuns')
      .withIndex('by_job', q => q.eq('jobId', args.jobId).gte('completedAt', cutoff))
      .take(MAX_RUNS)

    const stats = {
      totalRuns: runs.length,
      successful: runs.filter(r => r.status === 'ok').length,
      failed: runs.filter(r => r.status === 'failed').length,
      avgDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: Infinity
    }

    if (runs.length > 0) {
      const durations = runs.map(r => r.durationMs)
      stats.avgDurationMs = Math.round(durations.reduce((a, b) => a + b, 0) / runs.length)
      stats.maxDurationMs = Math.max(...durations)
      stats.minDurationMs = Math.min(...durations)
    }

    return stats
  }
})
