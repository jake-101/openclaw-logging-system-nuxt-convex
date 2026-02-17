import { query } from './_generated/server'

/**
 * Single snapshot query for the dashboard home page.
 * Replaces four live subscriptions (logs.list, logs.countToday, sessions.list,
 * errors.unresolved) with one function so that each log write triggers one
 * re-execution instead of four.
 */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const [recentLogs, recentSessions, unresolvedErrors] = await Promise.all([
      ctx.db
        .query('logs')
        .withIndex('by_timestamp')
        .order('desc')
        .take(10),
      ctx.db
        .query('sessions')
        .withIndex('by_activity')
        .order('desc')
        .take(50),
      ctx.db
        .query('errors')
        .withIndex('by_unresolved', q => q.eq('resolved', false))
        .order('desc')
        .take(100)
    ])

    // O(1) point lookup from logCounters -- set by the atomic counter in logs.create
    const today = new Date().toISOString().split('T')[0]!
    const todayCounter = await ctx.db
      .query('logCounters')
      .withIndex('by_date', q => q.eq('date', today))
      .first()

    return {
      recentLogs,
      recentSessions,
      unresolvedErrors,
      logsToday: todayCounter?.count ?? 0
    }
  }
})
