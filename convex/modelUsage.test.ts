import { describe, it, expect } from 'vitest'

/**
 * Tests for model usage aggregation logic extracted from
 * the byModel, byProvider, and latencyStats query handlers.
 */

interface UsageEntry {
  model: string
  provider: string
  totalTokens: number
  costUsd?: number
  durationMs: number
  timestamp: number
}

// Replicate the byModel aggregation logic
function aggregateByModel(usage: UsageEntry[]) {
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
    byModel[u.model]!.calls++
    byModel[u.model]!.totalTokens += u.totalTokens
    byModel[u.model]!.totalCost += u.costUsd ?? 0
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

// Replicate the latencyStats percentile logic
function computeLatencyStats(durations: number[]) {
  if (durations.length === 0) return null

  const sorted = [...durations].sort((a, b) => a - b)

  const percentile = (p: number) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)]
  }

  return {
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

// Replicate dailySummary grouping
function aggregateDaily(usage: UsageEntry[]) {
  const byDay: Record<string, { calls: number, tokens: number, cost: number }> = {}

  for (const u of usage) {
    const day = new Date(u.timestamp).toISOString().split('T')[0]!
    if (!byDay[day]) {
      byDay[day] = { calls: 0, tokens: 0, cost: 0 }
    }
    byDay[day]!.calls++
    byDay[day]!.tokens += u.totalTokens
    byDay[day]!.cost += u.costUsd ?? 0
  }

  return byDay
}

const sampleUsage: UsageEntry[] = [
  { model: 'claude-sonnet-4-5', provider: 'anthropic', totalTokens: 5000, costUsd: 0.02, durationMs: 1200, timestamp: new Date('2026-02-15').getTime() },
  { model: 'claude-sonnet-4-5', provider: 'anthropic', totalTokens: 8000, costUsd: 0.03, durationMs: 1800, timestamp: new Date('2026-02-15').getTime() },
  { model: 'gpt-5.2', provider: 'openai', totalTokens: 3000, costUsd: 0.01, durationMs: 800, timestamp: new Date('2026-02-16').getTime() },
  { model: 'claude-sonnet-4-5', provider: 'anthropic', totalTokens: 6000, costUsd: 0.025, durationMs: 1500, timestamp: new Date('2026-02-16').getTime() },
  { model: 'gpt-5.2', provider: 'openai', totalTokens: 4000, durationMs: 900, timestamp: new Date('2026-02-16').getTime() }
]

describe('aggregateByModel', () => {
  it('groups usage by model name', () => {
    const result = aggregateByModel(sampleUsage)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['claude-sonnet-4-5']).toBeDefined()
    expect(result['gpt-5.2']).toBeDefined()
  })

  it('counts calls correctly', () => {
    const result = aggregateByModel(sampleUsage)
    expect(result['claude-sonnet-4-5']!.calls).toBe(3)
    expect(result['gpt-5.2']!.calls).toBe(2)
  })

  it('sums tokens correctly', () => {
    const result = aggregateByModel(sampleUsage)
    expect(result['claude-sonnet-4-5']!.totalTokens).toBe(19000) // 5000+8000+6000
    expect(result['gpt-5.2']!.totalTokens).toBe(7000) // 3000+4000
  })

  it('sums cost, treating undefined as 0', () => {
    const result = aggregateByModel(sampleUsage)
    expect(result['claude-sonnet-4-5']!.totalCost).toBeCloseTo(0.075) // 0.02+0.03+0.025
    expect(result['gpt-5.2']!.totalCost).toBeCloseTo(0.01) // 0.01+0 (undefined)
  })

  it('calculates average latency', () => {
    const result = aggregateByModel(sampleUsage)
    expect(result['claude-sonnet-4-5']!.avgLatency).toBe(1500) // (1200+1800+1500)/3
    expect(result['gpt-5.2']!.avgLatency).toBe(850) // (800+900)/2
  })

  it('returns empty for no usage', () => {
    const result = aggregateByModel([])
    expect(Object.keys(result)).toHaveLength(0)
  })
})

describe('computeLatencyStats', () => {
  it('returns null for empty array', () => {
    expect(computeLatencyStats([])).toBeNull()
  })

  it('computes basic stats', () => {
    const result = computeLatencyStats([100, 200, 300, 400, 500])!
    expect(result.count).toBe(5)
    expect(result.min).toBe(100)
    expect(result.max).toBe(500)
    expect(result.avg).toBe(300)
  })

  it('computes percentiles', () => {
    // 100 values from 1 to 100
    const durations = Array.from({ length: 100 }, (_, i) => i + 1)
    const result = computeLatencyStats(durations)!
    expect(result.p50).toBe(50)
    expect(result.p90).toBe(90)
    expect(result.p95).toBe(95)
    expect(result.p99).toBe(99)
  })

  it('handles single value', () => {
    const result = computeLatencyStats([42])!
    expect(result.count).toBe(1)
    expect(result.min).toBe(42)
    expect(result.max).toBe(42)
    expect(result.p50).toBe(42)
    expect(result.p99).toBe(42)
  })
})

describe('aggregateDaily', () => {
  it('groups by ISO date', () => {
    const result = aggregateDaily(sampleUsage)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['2026-02-15']).toBeDefined()
    expect(result['2026-02-16']).toBeDefined()
  })

  it('counts calls per day', () => {
    const result = aggregateDaily(sampleUsage)
    expect(result['2026-02-15']!.calls).toBe(2)
    expect(result['2026-02-16']!.calls).toBe(3)
  })

  it('sums tokens per day', () => {
    const result = aggregateDaily(sampleUsage)
    expect(result['2026-02-15']!.tokens).toBe(13000) // 5000+8000
    expect(result['2026-02-16']!.tokens).toBe(13000) // 3000+6000+4000
  })

  it('sums cost per day, treating undefined as 0', () => {
    const result = aggregateDaily(sampleUsage)
    expect(result['2026-02-15']!.cost).toBeCloseTo(0.05) // 0.02+0.03
    expect(result['2026-02-16']!.cost).toBeCloseTo(0.035) // 0.01+0.025+0
  })
})
