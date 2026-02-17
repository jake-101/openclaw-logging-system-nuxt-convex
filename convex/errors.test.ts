import { describe, it, expect } from 'vitest'

/**
 * Tests for error creation defaults and grouping logic
 * used in the errors dashboard.
 */

interface ErrorEntry {
  _id: string
  sessionKey: string
  timestamp: number
  errorType: string
  message: string
  stack?: string
  resolved: boolean
}

// Replicate the resolved default from errors.create handler
function buildErrorPayload(args: {
  sessionKey: string
  timestamp: number
  errorType: string
  message: string
  stack?: string
  resolved?: boolean
}) {
  return {
    ...args,
    resolved: args.resolved ?? false
  }
}

// Replicate the grouping logic from the errors dashboard
function groupErrors(errors: ErrorEntry[]) {
  const groups = new Map<string, ErrorEntry[]>()

  for (const error of errors) {
    const existing = groups.get(error.errorType) ?? []
    existing.push(error)
    groups.set(error.errorType, existing)
  }

  return Array.from(groups.entries()).map(([type, errors]) => ({
    type,
    errors,
    count: errors.length,
    latestTimestamp: Math.max(...errors.map(e => e.timestamp))
  })).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
}

describe('error creation defaults', () => {
  it('defaults resolved to false', () => {
    const payload = buildErrorPayload({
      sessionKey: 'session-001',
      timestamp: Date.now(),
      errorType: 'TypeError',
      message: 'Cannot read property'
    })
    expect(payload.resolved).toBe(false)
  })

  it('respects explicit resolved=true', () => {
    const payload = buildErrorPayload({
      sessionKey: 'session-001',
      timestamp: Date.now(),
      errorType: 'TypeError',
      message: 'Cannot read property',
      resolved: true
    })
    expect(payload.resolved).toBe(true)
  })

  it('preserves all fields', () => {
    const payload = buildErrorPayload({
      sessionKey: 'session-001',
      timestamp: 1000,
      errorType: 'NetworkError',
      message: 'Connection refused',
      stack: 'Error: Connection refused\n  at fetch'
    })
    expect(payload.sessionKey).toBe('session-001')
    expect(payload.errorType).toBe('NetworkError')
    expect(payload.stack).toContain('Connection refused')
  })
})

describe('error grouping logic', () => {
  const sampleErrors: ErrorEntry[] = [
    { _id: '1', sessionKey: 's1', timestamp: 1000, errorType: 'TypeError', message: 'null ref', resolved: false },
    { _id: '2', sessionKey: 's1', timestamp: 2000, errorType: 'TypeError', message: 'undefined', resolved: false },
    { _id: '3', sessionKey: 's2', timestamp: 3000, errorType: 'NetworkError', message: 'timeout', resolved: false },
    { _id: '4', sessionKey: 's2', timestamp: 500, errorType: 'NetworkError', message: 'refused', resolved: false },
    { _id: '5', sessionKey: 's3', timestamp: 4000, errorType: 'ValidationError', message: 'bad input', resolved: false }
  ]

  it('groups by errorType', () => {
    const groups = groupErrors(sampleErrors)
    expect(groups).toHaveLength(3)
    const typeNames = groups.map(g => g.type)
    expect(typeNames).toContain('TypeError')
    expect(typeNames).toContain('NetworkError')
    expect(typeNames).toContain('ValidationError')
  })

  it('counts errors per group', () => {
    const groups = groupErrors(sampleErrors)
    const typeError = groups.find(g => g.type === 'TypeError')
    const networkError = groups.find(g => g.type === 'NetworkError')
    expect(typeError?.count).toBe(2)
    expect(networkError?.count).toBe(2)
  })

  it('sorts by latest timestamp descending', () => {
    const groups = groupErrors(sampleErrors)
    expect(groups[0].type).toBe('ValidationError') // ts 4000
    expect(groups[1].type).toBe('NetworkError') // ts 3000
    expect(groups[2].type).toBe('TypeError') // ts 2000
  })

  it('tracks latest timestamp per group', () => {
    const groups = groupErrors(sampleErrors)
    const networkError = groups.find(g => g.type === 'NetworkError')
    expect(networkError?.latestTimestamp).toBe(3000) // max of 3000 and 500
  })

  it('returns empty for no errors', () => {
    const groups = groupErrors([])
    expect(groups).toHaveLength(0)
  })
})
