import { httpRouter } from 'convex/server'
import { authComponent, createAuth } from './auth'

const http = httpRouter()

// Register Better Auth route handlers with CORS enabled for SPA cross-origin requests.
// Auth routes will be available at: https://<deployment>.convex.site/api/auth/*
authComponent.registerRoutes(http, createAuth, { cors: true })

export default http
