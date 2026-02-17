# OpenClaw Logging System

Real-time agent logging and monitoring dashboard for OpenClaw agents (BadgerBot). Built with Nuxt 4 and Convex.

## Features

- **Log Viewer** -- Real-time log stream with level filtering and full-text search
- **Session Browser** -- Aggregated session summaries with token usage, cost, and tool call stats
- **Error Dashboard** -- Dedicated error tracking with resolution state management
- **Analytics** -- Charts for log volume, error rates, and session trends over time
- **Model Usage** -- Per-model and per-provider token/cost/latency analytics
- **Cron Monitoring** -- Track cron job executions with duration and status
- **Rate Limit Tracking** -- Monitor API rate limit events with retry-after info
- **Self-Documenting API** -- Agents can query `apiDocs.describe` to discover the full API schema at runtime

## Tech Stack

- **Framework**: [Nuxt 4](https://nuxt.com) (Vue 3 Composition API)
- **Backend**: [Convex](https://convex.dev) (real-time database + TypeScript functions)
- **UI**: [@nuxt/ui v4](https://ui.nuxt.com) (Reka UI + Tailwind CSS v4)
- **Charts**: [Chart.js](https://www.chartjs.org) via vue-chartjs
- **Testing**: [Vitest](https://vitest.dev) + @vue/test-utils + happy-dom
- **Package Manager**: pnpm

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- A Convex deployment (cloud or [self-hosted](https://github.com/get-convex/convex-backend))

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/openclaw-logging-system.git
cd openclaw-logging-system

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Convex URL and admin key

# Start Convex dev server (watches convex/ for changes)
pnpm convex:dev

# Start Nuxt dev server
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

### Authentication

The dashboard uses [Better Auth](https://better-auth.com) via the `@convex-dev/better-auth` Convex component. Auth routes are served from the Convex site deployment (`CONVEX_SITE_URL`).

**First-time setup — create your admin account:**

```bash
curl -X POST http://<CONVEX_SITE_URL>/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","name":"Admin"}'
```

**After creating your account, disable sign-up** so no further accounts can be registered. In `convex/auth.ts`, set `disableSignUp: true`:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,   // add this after initial setup
},
```

Then redeploy: `pnpm convex:dev` (or `pnpm convex:deploy` for production).

To re-enable sign-up temporarily (e.g. to add another user), flip it back to `false`, deploy, create the account via the API, then set it back to `true` and redeploy.

### Agent Integration

See [docs/agent-integration.md](docs/agent-integration.md) for the full integration guide, including a ready-to-use `ConvexLogger` wrapper class.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Nuxt dev server with HMR |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm convex:dev` | Start Convex dev server |
| `pnpm convex:deploy` | Deploy Convex functions to production |

## Project Structure

```
app/                      # Nuxt 4 frontend
  components/             # Auto-imported Vue components
  composables/            # Shared composables (charts, navigation)
  pages/                  # File-based routing (9 pages)
  plugins/                # Chart.js registration, Convex client
  utils/                  # Formatting helpers, color constants
convex/                   # Convex backend
  schema.ts               # Database schema (6 tables)
  logs.ts                 # Log CRUD
  sessions.ts             # Session management
  errors.ts               # Error tracking
  cronRuns.ts             # Cron job tracking
  rateLimits.ts           # Rate limit events
  modelUsage.ts           # Model API call tracking
  apiDocs.ts              # Self-documenting API endpoint
docs/                     # Integration documentation
```

## Database Schema

Six tables: `logs`, `sessions`, `errors`, `cronRuns`, `rateLimits`, `modelUsage`.

All timestamps are Unix milliseconds. Session keys (format: `{agentId}-{date}-{shortId}`) link logs to sessions.

For the full schema, see [`convex/schema.ts`](convex/schema.ts) or query the `apiDocs.describe` endpoint at runtime.

## License

[MIT](LICENSE)
