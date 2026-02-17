import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'

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

// Combined query: one DB read, returns byModel + byProvider + latencyStats together.
// Use this instead of calling byModel/byProvider/latencyStats separately to
// avoid 3x subscription re-executions on every modelUsage write.
export const summary = query({
  args: {
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.hours ?? 6) * 60 * 60 * 1000

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
    const byProvider: Record<string, {
      calls: number
      totalTokens: number
      totalCost: number
      models: string[]
    }> = {}
    const modelLatencies: Record<string, number[]> = {}
    const modelSets: Record<string, Set<string>> = {}
    const allLatencies: number[] = []

    for (const u of usage) {
      // byModel
      if (!byModel[u.model]) {
        byModel[u.model] = { calls: 0, totalTokens: 0, totalCost: 0, avgLatency: 0 }
        modelLatencies[u.model] = []
      }
      byModel[u.model]!.calls++
      byModel[u.model]!.totalTokens += u.totalTokens
      byModel[u.model]!.totalCost += u.costUsd ?? 0
      modelLatencies[u.model]!.push(u.durationMs)

      // byProvider
      if (!byProvider[u.provider]) {
        byProvider[u.provider] = { calls: 0, totalTokens: 0, totalCost: 0, models: [] }
        modelSets[u.provider] = new Set()
      }
      byProvider[u.provider]!.calls++
      byProvider[u.provider]!.totalTokens += u.totalTokens
      byProvider[u.provider]!.totalCost += u.costUsd ?? 0
      modelSets[u.provider]!.add(u.model)

      allLatencies.push(u.durationMs)
    }

    for (const model of Object.keys(byModel)) {
      const lats = modelLatencies[model]!
      byModel[model]!.avgLatency = Math.round(
        lats.reduce((a, b) => a + b, 0) / lats.length
      )
    }
    for (const provider of Object.keys(byProvider)) {
      byProvider[provider]!.models = Array.from(modelSets[provider]!)
    }

    let latencyStats = null
    if (allLatencies.length > 0) {
      const sorted = [...allLatencies].sort((a, b) => a - b)
      const percentile = (p: number) => {
        const idx = Math.ceil((p / 100) * sorted.length) - 1
        return sorted[Math.max(0, idx)]
      }
      latencyStats = {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99)
      }
    }

    return { byModel, byProvider, latencyStats }
  }
})

/**
 * Read daily stats from the pre-aggregated dailyStats table.
 * Fast O(N days) lookup instead of scanning raw modelUsage rows.
 * Populated by the hourly cron (convex/crons.ts → aggregateHourlyStats).
 */
export const dailySummary = query({
  args: {
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const numDays = args.days ?? 7

    // Build a set of the last N date strings so we return all days
    // (even those with zero activity) in a predictable order
    const dates: string[] = []
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      dates.push(d.toISOString().split('T')[0]!)
    }

    // At most numDays rows -- no full-table scan
    const rows = await ctx.db
      .query('dailyStats')
      .withIndex('by_date')
      .order('desc')
      .take(numDays)

    const byDate = new Map(rows.map(r => [r.date, r]))
    const byDay: Record<string, { calls: number, tokens: number, cost: number }> = {}

    for (const date of dates) {
      const row = byDate.get(date)
      byDay[date] = {
        calls: row?.calls ?? 0,
        tokens: row?.totalTokens ?? 0,
        cost: row?.totalCostUsd ?? 0
      }
    }

    return byDay
  }
})

/**
 * Internal mutation called by the hourly cron to aggregate the previous
 * hour's modelUsage records into the dailyStats table.
 */
export const aggregateHourlyStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    // Aggregate the previous full hour (not the current in-progress hour)
    const hourAgo = now - 60 * 60 * 1000

    const usage = await ctx.db
      .query('modelUsage')
      .withIndex('by_time', q => q.gte('timestamp', hourAgo).lt('timestamp', now))
      .take(10000) // hard cap; at 250 calls/hour this is 40x headroom

    if (usage.length === 0) return

    // Group by day (a single hour could straddle midnight, hence the grouping)
    const byDay: Record<string, { calls: number, totalTokens: number, totalCostUsd: number }> = {}

    for (const u of usage) {
      const date = new Date(u.timestamp).toISOString().split('T')[0]!
      const entry = byDay[date] ?? { calls: 0, totalTokens: 0, totalCostUsd: 0 }
      entry.calls++
      entry.totalTokens += u.totalTokens
      entry.totalCostUsd += u.costUsd ?? 0
      byDay[date] = entry
    }

    // Upsert each day's aggregated stats
    for (const [date, delta] of Object.entries(byDay)) {
      const existing = await ctx.db
        .query('dailyStats')
        .withIndex('by_date', q => q.eq('date', date))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, {
          calls: existing.calls + delta.calls,
          totalTokens: existing.totalTokens + delta.totalTokens,
          totalCostUsd: existing.totalCostUsd + delta.totalCostUsd
        })
      } else {
        await ctx.db.insert('dailyStats', { date, ...delta })
      }
    }
  }
})
