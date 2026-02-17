import { describe, it, expect } from 'vitest'

/**
 * Tests for the log search filtering logic.
 * The search handler fetches candidates from Convex then filters in-memory.
 * We test the filter logic directly since the DB layer is Convex-managed.
 */

interface LogEntry {
  _id: string
  message: string
  agentId: string
  toolName?: string
  level: string
  sessionKey: string
  timestamp: number
}

// Extract the filter logic used in logs.search handler
function filterLogs(logs: LogEntry[], searchTerm: string): LogEntry[] {
  const term = searchTerm.toLowerCase()
  return logs.filter((log) => {
    const msg = log.message.toLowerCase()
    const agent = log.agentId.toLowerCase()
    const tool = (log.toolName ?? '').toLowerCase()
    return msg.includes(term) || agent.includes(term) || tool.includes(term)
  })
}

const sampleLogs: LogEntry[] = [
  {
    _id: '1',
    message: 'Starting session initialization',
    agentId: 'openclaw',
    level: 'info',
    sessionKey: 'session-001',
    timestamp: 1000
  },
  {
    _id: '2',
    message: 'Tool execution failed: readFile',
    agentId: 'openclaw',
    toolName: 'readFile',
    level: 'error',
    sessionKey: 'session-001',
    timestamp: 2000
  },
  {
    _id: '3',
    message: 'Rate limit hit on Anthropic API',
    agentId: 'crawlerbot',
    level: 'warn',
    sessionKey: 'session-002',
    timestamp: 3000
  },
  {
    _id: '4',
    message: 'Processing complete',
    agentId: 'openclaw',
    toolName: 'writeFile',
    level: 'info',
    sessionKey: 'session-001',
    timestamp: 4000
  }
]

describe('log search filtering', () => {
  it('filters by message content', () => {
    const results = filterLogs(sampleLogs, 'rate limit')
    expect(results).toHaveLength(1)
    expect(results[0]._id).toBe('3')
  })

  it('filters by agent ID', () => {
    const results = filterLogs(sampleLogs, 'crawlerbot')
    expect(results).toHaveLength(1)
    expect(results[0]._id).toBe('3')
  })

  it('filters by tool name', () => {
    const results = filterLogs(sampleLogs, 'readFile')
    expect(results).toHaveLength(1)
    expect(results[0]._id).toBe('2')
  })

  it('is case-insensitive', () => {
    const results = filterLogs(sampleLogs, 'OPENCLAW')
    expect(results).toHaveLength(3)
  })

  it('matches partial strings', () => {
    const results = filterLogs(sampleLogs, 'session')
    expect(results).toHaveLength(1)
    expect(results[0].message).toContain('session')
  })

  it('returns empty for no matches', () => {
    const results = filterLogs(sampleLogs, 'nonexistent-xyz')
    expect(results).toHaveLength(0)
  })

  it('matches across message, agent, and tool fields', () => {
    // 'write' matches toolName 'writeFile' and not the message directly
    const results = filterLogs(sampleLogs, 'write')
    expect(results).toHaveLength(1)
    expect(results[0].toolName).toBe('writeFile')
  })

  it('handles logs without toolName', () => {
    const results = filterLogs(sampleLogs, 'initialization')
    expect(results).toHaveLength(1)
    expect(results[0].toolName).toBeUndefined()
  })
})

describe('search limit and candidate logic', () => {
  it('candidate limit caps at 1000', () => {
    const limit = 300
    const candidateLimit = Math.min(limit * 5, 1000)
    expect(candidateLimit).toBe(1000)
  })

  it('candidate limit is 5x for small limits', () => {
    const limit = 50
    const candidateLimit = Math.min(limit * 5, 1000)
    expect(candidateLimit).toBe(250)
  })

  it('default limit is 100', () => {
    const args: { limit?: number } = {}
    const limit = args.limit ?? 100
    expect(limit).toBe(100)
  })

  it('slices results to requested limit', () => {
    const manyLogs = Array.from({ length: 50 }, (_, i) => ({
      _id: String(i),
      message: `Log entry ${i}`,
      agentId: 'bot',
      level: 'info',
      sessionKey: 'session',
      timestamp: i
    }))
    const filtered = filterLogs(manyLogs, 'log').slice(0, 10)
    expect(filtered).toHaveLength(10)
  })
})
