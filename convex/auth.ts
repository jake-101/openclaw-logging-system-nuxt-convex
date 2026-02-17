import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// --- Crypto helpers (Web Crypto API, available in Convex V8 runtime) ---

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )
  return hexEncode(derivedBits)
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return hexEncode(bytes.buffer as ArrayBuffer)
}

function generateSalt(): Uint8Array {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return salt
}

// Session lifetime: 7 days
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

// --- Mutations ---

/**
 * Register a new dashboard user.
 * Only works if no users exist yet (first-user setup) or if called
 * by an already-authenticated session.
 */
export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    existingToken: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Check if any users exist
    const existingUsers = await ctx.db.query('dashboardUsers').take(1)
    const isFirstUser = existingUsers.length === 0

    if (!isFirstUser) {
      // Require a valid session token to create additional users
      if (!args.existingToken) {
        throw new Error('Registration requires an existing admin session')
      }
      const session = await ctx.db
        .query('dashboardSessions')
        .withIndex('by_token', q => q.eq('token', args.existingToken!))
        .unique()
      if (!session || session.expiresAt < Date.now()) {
        throw new Error('Invalid or expired session')
      }
    }

    // Check for duplicate email
    const existing = await ctx.db
      .query('dashboardUsers')
      .withIndex('by_email', q => q.eq('email', args.email))
      .unique()
    if (existing) {
      throw new Error('Email already registered')
    }

    // Validate password strength
    if (args.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    // Hash password with PBKDF2
    const salt = generateSalt()
    const passwordHash = await hashPassword(args.password, salt)

    const userId = await ctx.db.insert('dashboardUsers', {
      email: args.email,
      passwordHash,
      passwordSalt: hexEncode(salt.buffer as ArrayBuffer),
      createdAt: Date.now()
    })

    // Create a session for the new user
    const token = generateToken()
    await ctx.db.insert('dashboardSessions', {
      userId,
      token,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
      createdAt: Date.now()
    })

    return { token, userId }
  }
})

/**
 * Log in with email and password. Returns a session token.
 */
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('dashboardUsers')
      .withIndex('by_email', q => q.eq('email', args.email))
      .unique()

    if (!user) {
      throw new Error('Invalid email or password')
    }

    // Verify password
    const salt = hexDecode(user.passwordSalt)
    const hash = await hashPassword(args.password, salt)
    if (hash !== user.passwordHash) {
      throw new Error('Invalid email or password')
    }

    // Create session
    const token = generateToken()
    await ctx.db.insert('dashboardSessions', {
      userId: user._id,
      token,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
      createdAt: Date.now()
    })

    return { token, email: user.email }
  }
})

/**
 * Log out by invalidating the session token.
 */
export const logout = mutation({
  args: {
    token: v.string()
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('dashboardSessions')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique()
    if (session) {
      await ctx.db.delete(session._id)
    }
  }
})

/**
 * Validate a session token and return the user info.
 * Used by the frontend to check if a stored token is still valid.
 */
export const validateSession = query({
  args: {
    token: v.string()
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('dashboardSessions')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique()

    if (!session || session.expiresAt < Date.now()) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    if (!user) {
      return null
    }

    return {
      email: user.email,
      expiresAt: session.expiresAt
    }
  }
})

/**
 * Check if any dashboard users exist (for first-time setup detection).
 */
export const hasUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('dashboardUsers').take(1)
    return users.length > 0
  }
})
