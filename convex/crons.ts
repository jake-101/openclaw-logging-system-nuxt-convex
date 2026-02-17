import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Aggregate the previous hour of modelUsage into dailyStats every hour.
// This keeps dailySummary fast (reads at most 7 rows from dailyStats)
// and accurate (not capped by MAX_RECORDS like the old implementation).
crons.hourly(
  'aggregate-model-usage-into-daily-stats',
  { minuteUTC: 5 }, // Run at :05 past every hour
  internal.modelUsage.aggregateHourlyStats
)

export default crons
