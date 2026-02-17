import { describe, it, expect } from 'vitest'

/**
 * Tests for session upsert logic.
 * The upsert handler checks for existing sessions and either patches or inserts.
 * We test the merge/default logic used in the handler.
 */

interface SessionArgs {
  sessionKey: string
  agentId: string
  kind: string
  messageCount?: number
  toolCalls?: number
  errors?: number
  totalTokens?: number
  estimatedCost?: number
}

interface ExistingSession {
  _id: string
  sessionKey: string
  startedAt: number
  lastActiveAt: number
  agentId: string
  kind: string
  messageCount: number
  toolCalls: number
  errors: number
  totalTokens?: number
  estimatedCost?: number
}

// Replicate the insert defaults logic from sessions.upsert handler
function buildInsertPayload(args: SessionArgs, now: number) {
  return {
    sessionKey: args.sessionKey,
    startedAt: now,
    lastActiveAt: now,
    agentId: args.agentId,
    kind: args.kind,
    messageCount: args.messageCount ?? 0,
    toolCalls: args.toolCalls ?? 0,
    errors: args.errors ?? 0,
    totalTokens: args.totalTokens,
    estimatedCost: args.estimatedCost
  }
}

// Replicate the patch logic from sessions.upsert handler
function buildPatchPayload(args: SessionArgs, existing: ExistingSession, now: number) {
  return {
    lastActiveAt: now,
    messageCount: args.messageCount ?? existing.messageCount,
    toolCalls: args.toolCalls ?? existing.toolCalls,
    errors: args.errors ?? existing.errors,
    totalTokens: args.totalTokens ?? existing.totalTokens,
    estimatedCost: args.estimatedCost ?? existing.estimatedCost
  }
}

describe('session upsert - insert (new session)', () => {
  const now = 1700000000000

  it('creates session with default zero stats', () => {
    const payload = buildInsertPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main'
    }, now)

    expect(payload.messageCount).toBe(0)
    expect(payload.toolCalls).toBe(0)
    expect(payload.errors).toBe(0)
    expect(payload.startedAt).toBe(now)
    expect(payload.lastActiveAt).toBe(now)
  })

  it('uses provided stats when given', () => {
    const payload = buildInsertPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main',
      messageCount: 5,
      toolCalls: 3,
      errors: 1,
      totalTokens: 10000,
      estimatedCost: 0.05
    }, now)

    expect(payload.messageCount).toBe(5)
    expect(payload.toolCalls).toBe(3)
    expect(payload.errors).toBe(1)
    expect(payload.totalTokens).toBe(10000)
    expect(payload.estimatedCost).toBe(0.05)
  })

  it('leaves optional fields undefined when not provided', () => {
    const payload = buildInsertPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main'
    }, now)

    expect(payload.totalTokens).toBeUndefined()
    expect(payload.estimatedCost).toBeUndefined()
  })
})

describe('session upsert - patch (existing session)', () => {
  const now = 1700000000000
  const existing: ExistingSession = {
    _id: 'abc123',
    sessionKey: 'test-session',
    startedAt: 1699999990000,
    lastActiveAt: 1699999995000,
    agentId: 'openclaw',
    kind: 'main',
    messageCount: 10,
    toolCalls: 5,
    errors: 2,
    totalTokens: 50000,
    estimatedCost: 0.25
  }

  it('updates lastActiveAt to now', () => {
    const patch = buildPatchPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main'
    }, existing, now)

    expect(patch.lastActiveAt).toBe(now)
  })

  it('keeps existing stats when args not provided', () => {
    const patch = buildPatchPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main'
    }, existing, now)

    expect(patch.messageCount).toBe(10)
    expect(patch.toolCalls).toBe(5)
    expect(patch.errors).toBe(2)
    expect(patch.totalTokens).toBe(50000)
    expect(patch.estimatedCost).toBe(0.25)
  })

  it('overrides stats when args provided', () => {
    const patch = buildPatchPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main',
      messageCount: 20,
      toolCalls: 12,
      errors: 3,
      totalTokens: 100000,
      estimatedCost: 0.50
    }, existing, now)

    expect(patch.messageCount).toBe(20)
    expect(patch.toolCalls).toBe(12)
    expect(patch.errors).toBe(3)
    expect(patch.totalTokens).toBe(100000)
    expect(patch.estimatedCost).toBe(0.50)
  })

  it('handles partial updates correctly', () => {
    const patch = buildPatchPayload({
      sessionKey: 'test-session',
      agentId: 'openclaw',
      kind: 'main',
      messageCount: 15
      // only updating messageCount
    }, existing, now)

    expect(patch.messageCount).toBe(15)
    expect(patch.toolCalls).toBe(5) // kept from existing
    expect(patch.errors).toBe(2) // kept from existing
  })
})
