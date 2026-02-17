import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Max records to aggregate in a single query to avoid Convex execution timeout.
// With ~250 calls/hour, 2000 covers ~8 hours of data safely.
const MAX_RECORDS = 2000

export const create = mutation({
  args: {
    sessionKey: v.string(),
    timestamp: v.number(),
    provider: v.string(),
    model: v.string(),
    channel: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    totalTokens: v.number(),
    durationMs: v.number(),
    costUsd: v.optional(v.number()),
    contextLimit: v.optional(v.number()),
    contextUsed: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('modelUsage', args)
  }
})

export const byModel = query({
  args: {
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 24) * 60 * 60 * 1000

    const usage = await ctx.db
      .query('modelUsage')
      .withIndex('by_time', q => q.gte('timestamp', cutoff))
      .order('desc')
      .take(MAX_RECORDS)

    const byModel: Record<string, {
      calls: number
      totalTokens: number
      totalCost: number
      avgLatency: number
    }> = {}
    const latencies: Record<string, number[]> = {}

    for (const u of usage) {
      if (!byModel[u.model]) {
        byModel[u.model] = { calls: 0, totalTokens: 0, totalCost: 0, avgLatency: 0 }
        latencies[u.model] = []
      }
      const entry = byModel[u.model]!
      entry.calls++
      entry.totalTokens += u.totalTokens
      entry.totalCost += u.costUsd ?? 0
      latencies[u.model]!.push(u.durationMs)
    }

    for (const model of Object.keys(byModel)) {
      const lats = latencies[model]!
      byModel[model]!.avgLatency = Math.round(
        lats.reduce((a, b) => a + b, 0) / lats.length
      )
    }

    return byModel
  }
})

export const byProvider = query({
  args: {
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 24) * 60 * 60 * 1000

    const usage = await ctx.db
      .query('modelUsage')
      .withIndex('by_time', q => q.gte('timestamp', cutoff))
      .order('desc')
      .take(MAX_RECORDS)

    const byProvider: Record<string, {
      calls: number
      totalTokens: number
      totalCost: number
      models: string[]
    }> = {}
    const modelSets: Record<string, Set<string>> = {}

    for (const u of usage) {
      if (!byProvider[u.provider]) {
        byProvider[u.provider] = { calls: 0, totalTokens: 0, totalCost: 0, models: [] }
        modelSets[u.provider] = new Set()
      }
      const entry = byProvider[u.provider]!
      entry.calls++
      entry.totalTokens += u.totalTokens
      entry.totalCost += u.costUsd ?? 0
      modelSets[u.provider]!.add(u.model)
    }

    for (const provider of Object.keys(byProvider)) {
      byProvider[provider]!.models = Array.from(modelSets[provider]!)
    }

    return byProvider
  }
})

export const latencyStats = query({
  args: {
    model: v.optional(v.string()),
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 24) * 60 * 60 * 1000

    const usage = await ctx.db
      .query('modelUsage')
      .withIndex('by_time', q => q.gte('timestamp', cutoff))
      .order('desc')
      .take(MAX_RECORDS)

    const filtered = args.model
      ? usage.filter(u => u.model === args.model)
      : usage

    if (filtered.length === 0) {
      return null
    }

    const latencies = filtered.map(u => u.durationMs).sort((a, b) => a - b)

    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * latencies.length) - 1
      return latencies[Math.max(0, idx)]
    }

    return {
      count: latencies.length,
      min: latencies[0],
      max: latencies[latencies.length - 1],
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99)
    }
  }
})

export const dailySummary = query({
  args: {
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.days ?? 7) * 24 * 60 * 60 * 1000

    const usage = await ctx.db
      .query('modelUsage')
      .withIndex('by_time', q => q.gte('timestamp', cutoff))
      .order('desc')
      .take(MAX_RECORDS)

    const byDay: Record<string, {
      calls: number
      tokens: number
      cost: number
    }> = {}

    for (const u of usage) {
      const day = new Date(u.timestamp).toISOString().split('T')[0]!
      if (!byDay[day]) {
        byDay[day] = { calls: 0, tokens: 0, cost: 0 }
      }
      const entry = byDay[day]!
      entry.calls++
      entry.tokens += u.totalTokens
      entry.cost += u.costUsd ?? 0
    }

    return byDay
  }
})
