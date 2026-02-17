import { v } from 'convex/values'
import { query } from './_generated/server'

// Max records per query to avoid Convex execution timeouts
const MAX_SESSIONS = 200
const MAX_LOGS = 500

/**
 * Single server-side aggregate query for the analytics page.
 * Replaces two live subscriptions (sessions.list + logs.list) with one
 * function that transfers only computed summaries instead of raw rows.
 */
export const summary = query({
  args: {
    sessionLimit: v.optional(v.number()),
    logLimit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const sessionLimit = Math.min(args.sessionLimit ?? MAX_SESSIONS, MAX_SESSIONS)
    const logLimit = Math.min(args.logLimit ?? MAX_LOGS, MAX_LOGS)

    const [sessions, logs] = await Promise.all([
      ctx.db
        .query('sessions')
        .withIndex('by_activity')
        .order('desc')
        .take(sessionLimit),
      ctx.db
        .query('logs')
        .withIndex('by_timestamp')
        .order('desc')
        .take(logLimit)
    ])

    // --- Aggregated totals from sessions ---
    let totalCost = 0
    let totalTokens = 0
    let totalToolCalls = 0

    const costTimeline: Array<{ date: string, cost: number }> = []
    const tokenTimeline: Array<{ sessionKey: string, tokens: number }> = []

    for (const s of sessions) {
      totalCost += s.estimatedCost ?? 0
      totalTokens += s.totalTokens ?? 0
      totalToolCalls += s.toolCalls

      if (s.estimatedCost !== undefined && s.estimatedCost !== null) {
        costTimeline.push({
          date: new Date(s.startedAt).toLocaleDateString(),
          cost: s.estimatedCost
        })
      }
      if (s.totalTokens !== undefined && s.totalTokens !== null && s.totalTokens > 0) {
        tokenTimeline.push({
          sessionKey: s.sessionKey.length > 16 ? `${s.sessionKey.slice(0, 16)}...` : s.sessionKey,
          tokens: s.totalTokens
        })
      }
    }

    // Sort timelines by session start time (they come in desc order)
    costTimeline.reverse()
    tokenTimeline.reverse()

    // --- Tool breakdown from logs ---
    const toolBreakdown: Record<string, {
      calls: number
      success: number
      totalDuration: number
      durationCount: number
    }> = {}

    const levelDistribution: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0 }

    for (const log of logs) {
      levelDistribution[log.level] = (levelDistribution[log.level] ?? 0) + 1

      if (log.toolName) {
        const tool = toolBreakdown[log.toolName] ?? { calls: 0, success: 0, totalDuration: 0, durationCount: 0 }
        tool.calls++
        if (log.toolSuccess) tool.success++
        if (log.toolDuration) {
          tool.totalDuration += log.toolDuration
          tool.durationCount++
        }
        toolBreakdown[log.toolName] = tool
      }
    }

    const toolStats = Object.entries(toolBreakdown)
      .map(([name, stats]) => ({
        name,
        calls: stats.calls,
        successRate: stats.calls > 0 ? Math.round((stats.success / stats.calls) * 100) : 0,
        avgDuration: stats.durationCount > 0 ? Math.round(stats.totalDuration / stats.durationCount) : 0
      }))
      .sort((a, b) => b.calls - a.calls)

    return {
      totalCost,
      totalTokens,
      totalToolCalls,
      costTimeline,
      tokenTimeline,
      toolStats,
      levelDistribution
    }
  }
})
