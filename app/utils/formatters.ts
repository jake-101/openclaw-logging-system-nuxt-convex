/**
 * Shared formatting utilities used across dashboard pages.
 *
 * These are pure functions (no Vue reactivity) so they live in utils/
 * rather than composables/. Nuxt auto-imports everything in utils/.
 */

/** Format a Unix-ms timestamp to a locale time string (e.g. "3:42:15 PM"). */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

/** Format a Unix-ms timestamp to a locale date string (e.g. "2/16/2026"). */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

/** Format a Unix-ms timestamp to a full locale date+time string. */
export function formatFullTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

/** Format a duration between two Unix-ms timestamps as a human-readable string. */
export function formatDuration(start: number, end: number): string {
  const diff = end - start
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/** Format a millisecond duration as a human-readable string. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

/** Format a Unix-ms timestamp as a relative time string (e.g. "5m ago"). */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

/** Format a cost value as a USD string, or em-dash if undefined/null. */
export function formatCost(cost: number | undefined | null): string {
  if (cost === undefined || cost === null) return '—'
  return `$${cost.toFixed(4)}`
}

/** Map log levels to Nuxt UI badge colors. */
export const LOG_LEVEL_COLORS: Record<string, 'neutral' | 'primary' | 'warning' | 'error'> = {
  debug: 'neutral',
  info: 'primary',
  warn: 'warning',
  error: 'error'
}

/** Map cron run statuses to Nuxt UI badge colors. */
export const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  ok: 'success',
  failed: 'error',
  timeout: 'warning'
}

/** Threshold (in ms) for considering a session "active". Default: 5 minutes. */
export const ACTIVE_SESSION_THRESHOLD_MS = 5 * 60 * 1000

/** Check whether a session is active based on its lastActiveAt timestamp. */
export function isSessionActive(lastActiveAt: number): boolean {
  return Date.now() - lastActiveAt < ACTIVE_SESSION_THRESHOLD_MS
}
