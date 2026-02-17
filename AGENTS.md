# AGENTS.md - OpenClaw Logging System

Agent logging and monitoring dashboard for OpenClaw agents (BadgerBot).
Nuxt 4 frontend with Convex real-time backend.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 Composition API, `<script setup>`)
- **Backend**: Convex (real-time database, TypeScript functions)
- **UI**: @nuxt/ui v4 (Reka UI + Tailwind CSS v4 + Tailwind Variants)
- **Icons**: @iconify-json/lucide, @iconify-json/simple-icons
- **Testing**: Vitest + @vue/test-utils + happy-dom
- **Package Manager**: pnpm (v10+, declared in `packageManager` field)

## Build / Dev / Test Commands

```bash
pnpm dev              # Start Nuxt dev server (HMR)
pnpm build            # Production build
pnpm preview          # Preview production build locally
pnpm lint             # ESLint check (no fix)
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # vue-tsc type checking via `nuxt typecheck`
pnpm test             # Run all tests once (vitest run)
pnpm test:watch       # Run tests in watch mode
```

### Running a Single Test

```bash
pnpm vitest run path/to/file.test.ts          # Single file
pnpm vitest run -t "test name pattern"         # By test name
pnpm vitest run path/to/file.test.ts -t "name" # File + name
```

### Convex

```bash
pnpm convex:dev       # Start Convex dev server (watches convex/ dir)
pnpm convex:deploy    # Deploy Convex functions to production
npx convex dev        # Alternative: direct npx invocation
```

Convex functions live in `convex/`. After changing `convex/schema.ts`, run
`npx convex dev` to regenerate `convex/_generated/`.

## Project Structure

```
app/                    # Nuxt 4 app directory (all frontend code)
  app.vue               # Root app shell (UApp + NuxtLayout + NuxtPage)
  app.config.ts         # App-level config (UI theme colors)
  assets/css/main.css   # Tailwind + Nuxt UI imports, theme overrides
  components/           # Auto-imported Vue components
    DashboardNavbar.vue  # Page title/icon from useNavigation()
    DashboardSidebar.vue # Sidebar nav menu + logout button
    StatCard.vue         # Reusable stat display (icon + value + label)
    EmptyState.vue       # Reusable empty state (icon + title + description)
  composables/           # Auto-imported composables
    useAuth.ts           # Authentication state + login/logout/register
    useChartOptions.ts   # Shared Chart.js option presets
    useNavigation.ts     # Single source of truth for route metadata
  layouts/               # Nuxt layouts
    default.vue          # Dashboard layout (sidebar + navbar + content)
  plugins/               # Nuxt plugins
    chartjs.client.ts    # Chart.js component registration (runs once)
    convex.client.ts     # Convex client setup + auth adapter wiring
  utils/                 # Auto-imported pure utility functions
    formatters.ts        # Shared formatting (timestamps, duration, cost, etc.)
  pages/                 # File-based routing
    login.vue            # Login / first-user setup page (layout: false)
convex/                 # Convex backend (schema + server functions)
  schema.ts             # Database schema (8 tables, including auth)
  auth.ts               # Dashboard auth: register, login, logout, validateSession
  logs.ts               # Log CRUD queries/mutations
  sessions.ts           # Session queries/mutations
  errors.ts             # Error tracking queries/mutations
  cronRuns.ts           # Cron job run tracking
  rateLimits.ts         # Rate limit event tracking
  modelUsage.ts         # Model API call tracking
  apiDocs.ts            # Self-documenting API endpoint
  _generated/           # Auto-generated (do NOT edit)
nuxt.config.ts          # Nuxt configuration
vitest.config.ts        # Vitest configuration
eslint.config.mjs       # ESLint flat config (extends @nuxt/eslint)
```

## Code Style

### ESLint (enforced via @nuxt/eslint with stylistic rules)

- **No trailing comma**: `commaDangle: 'never'` -- do NOT add trailing commas
- **Brace style**: `1tbs` (one true brace style) -- opening brace on same line
- **Single quotes** for strings (ESLint stylistic default)
- **No semicolons** (ESLint stylistic default)
- **2-space indentation** (set in .editorconfig)
- **LF line endings** (set in .editorconfig)
- Run `pnpm lint:fix` to auto-fix before committing

### TypeScript

- Strict mode via Nuxt's generated tsconfig
- Use `defineNuxtConfig`, `defineAppConfig`, `definePageMeta` -- auto-imported
- Prefer explicit types for function parameters and return values
- Use `v.` validators from `convex/values` for all Convex function args
- Never use `any` unless wrapping untyped metadata blobs (use `v.any()` sparingly)

### Vue Components

- Always use `<script setup lang="ts">` (Composition API only, no Options API)
- Components in `app/components/` are auto-imported (no manual imports needed)
- Composables in `app/composables/` are auto-imported
- Use Nuxt UI components (`UButton`, `UCard`, `UTable`, etc.) -- not raw HTML
- Use `NuxtLink` instead of `<a>`, `NuxtImg` instead of `<img>`
- Wrap root layout in `<UApp>` for toast/tooltip context

### Naming Conventions

- **Components**: PascalCase filenames (`LogViewer.vue`, `SessionList.vue`)
- **Composables**: camelCase with `use` prefix (`useLogStream.ts`)
- **Pages**: kebab-case filenames (`session-[key].vue`)
- **Convex functions**: camelCase exports (`logs.create`, `sessions.upsert`)
- **Types/Interfaces**: PascalCase, no `I` prefix (`LogEntry`, `SessionStats`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants

### Imports

- Nuxt auto-imports: `ref`, `computed`, `watch`, `useFetch`, `useRoute`,
  `navigateTo`, `definePageMeta`, `useHead`, `useSeoMeta` -- do NOT import these
- Convex imports: `import { api } from '#convex/_generated/api'`
  (`#convex` alias is defined in nuxt.config.ts, resolves to project-root `convex/`)
- Convex server: `import { query, mutation } from './_generated/server'`
- Convex values: `import { v } from 'convex/values'`

### DRY Patterns (Shared Code)

The codebase follows strict DRY principles. Before adding new code, check
whether a shared utility, composable, or component already exists:

- **Formatting functions** (`formatTimestamp`, `formatDuration`, `formatCost`,
  `formatRelativeTime`, etc.) live in `app/utils/formatters.ts`. Never
  redefine these in page components -- import from utils (auto-imported).
- **Color constants** (`LOG_LEVEL_COLORS`, `STATUS_COLORS`,
  `ACTIVE_SESSION_THRESHOLD_MS`) live in `app/utils/formatters.ts`.
- **Chart.js registration** happens once in `app/plugins/chartjs.client.ts`.
  Never call `ChartJS.register()` in page components.
- **Chart options** (`bar`, `costBar`, `durationBar`, `line`, `doughnut`,
  `doughnutRight`) are returned by `useChartOptions()` composable. Use these
  presets or extend them -- don't duplicate option objects in pages.
- **Navigation metadata** (route labels, icons, sidebar groups) lives in
  `useNavigation()` composable. DashboardNavbar and DashboardSidebar both
  consume this single source of truth.
- **Stat cards** use the `<StatCard>` component (icon, value, label, color).
  Don't inline UCard + UIcon + text for stat displays.
- **Empty states** use the `<EmptyState>` component (icon, title, description).
  Don't inline the empty state div pattern in pages.
- **Page metadata** -- every page should call `definePageMeta({ title: '...' })`
  at the top of `<script setup>`.

### Error Handling

- Convex mutations/queries throw on validation failure -- wrap calls in try/catch
  at the component level and surface errors via `useToast()`
- Use the `errors` table for persistent error tracking from agents
- Log errors with `level: 'error'` to the `logs` table for dashboard visibility
- Never swallow errors silently -- always log or surface to the user

## Authentication

The dashboard is protected by simple token-based authentication:

- **Backend**: `convex/auth.ts` with PBKDF2 password hashing (Web Crypto API)
- **Frontend**: `useAuth()` composable manages localStorage tokens
- **Route guard**: `@convex-vue/core` navigation guard redirects to `/login`
- **First-user setup**: If no users exist, the login page shows a registration
  form. Subsequent users require an existing admin session.

**Tables**: `dashboardUsers` (email, passwordHash, passwordSalt) and
`dashboardSessions` (userId, token, expiresAt). Sessions expire after 7 days.

**Auth composable** (`useAuth()`):
- `login(email, password)` -- authenticate and store session token
- `register(email, password)` -- create first user (or with admin token)
- `logout()` -- invalidate server session and clear local token
- `checkHasUsers()` -- detect first-user setup mode
- `isAuthenticated`, `isLoading`, `userEmail` -- reactive state
- `getToken()` -- returns token for Convex auth adapter

**Convex plugin** (`convex.client.ts`) passes the auth adapter to
`createConvexVue()` with `installNavigationGuard: true`. All routes except
`/login` require authentication.

**Important**: Auth functions use `makeFunctionReference` from `convex/server`
instead of `api.auth.*` to avoid dependency on generated types. After running
`npx convex dev` to regenerate types, you can switch to typed `api.auth.*`
references if preferred.

## Convex Schema Overview

Eight tables: `dashboardUsers`, `dashboardSessions`, `logs`, `sessions`,
`errors`, `cronRuns`, `rateLimits`, `modelUsage`.

- **logs**: Individual log entries with session/agent context and optional tool
  tracking. Indexed by session+timestamp, timestamp, level, and toolName.
- **sessions**: Aggregated session summaries with stats (messageCount, toolCalls,
  errors, tokenUsage, cost). Upserted on each activity.
- **errors**: Dedicated error tracking with resolution state. Query `unresolved`
  for the error dashboard.
- **cronRuns**: Cron job execution records with duration, status, and optional
  error messages. Upserted by jobId+runId.
- **rateLimits**: Rate limit events from API providers with retry-after and
  endpoint info. Queried by time window for alerting.
- **modelUsage**: Per-request model API call tracking with token counts, cost,
  latency, and cache metrics. Aggregated by model, provider, and day.

All timestamps are Unix milliseconds (`Date.now()`). Session keys are
string identifiers linking logs to sessions.

## Testing Conventions

- Test files: colocate as `*.test.ts` or `*.spec.ts` next to source
- Use `describe`/`it` blocks with clear descriptions
- Test Convex functions independently (unit test handler logic)
- Test Vue components with `@vue/test-utils` mount/shallowMount
- Environment: happy-dom (configured in `vitest.config.ts`)

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:
1. `pnpm install`
2. `pnpm lint`
3. `pnpm typecheck`

Tests are not yet in CI -- add `pnpm test` step when test suite exists.

## Environment Variables

- `CONVEX_URL`: Convex deployment URL (required for runtime)
- See `.env.example` for template
- Never commit `.env` files (listed in `.gitignore`)

## Skills / Agent Instructions

When working in this codebase, load the **nuxt** skill and follow Nuxt 4 best
practices. Key points:

- This is **Nuxt 4** -- use Nuxt 4 patterns, not Nuxt 2/3 legacy patterns.
  Use `<NuxtPage />` (not `<Nuxt />`), typed router with route names,
  `useRequestURL()` (not `window.origin`), and `getRouterParam()` for server
  route params.
- Load the nuxt skill sub-references on demand based on the task:
  - `server.md` -- API routes, server middleware, validation
  - `routing.md` -- file-based routing, route groups, typed router
  - `middleware-plugins.md` -- route middleware, plugins, lifecycle
  - `nuxt-composables.md` -- useFetch, useRequestURL, navigation helpers
  - `nuxt-components.md` -- NuxtLink, NuxtImg, NuxtTime
  - `nuxt-config.md` -- nuxt.config.ts, modules, auto-imports
- Load the **vue** skill when writing `.vue` components or composables.
- Load the **nuxt-ui** skill when using @nuxt/ui components (Button, Modal,
  Form, Table, Toast, etc.) or customizing the theme.
- Load the **vitest** skill when writing or debugging tests.
- A Convex skill does not exist yet. Refer to the Convex schema and function
  files in `convex/` as the source of truth for backend patterns.

## Keeping Docs in Sync

When you add or change Convex functions (mutations, queries, actions),
you **must** update these two places:

1. **`convex/apiDocs.ts`** -- The `describe` query returns the full API
   schema to agents at runtime. This is the authoritative source. Update
   the mutations/queries/conventions objects to reflect any changes.
2. **`docs/agent-integration.md`** -- Human-readable setup guide and
   `ConvexLogger` wrapper. Update the wrapper class, usage examples, and
   tables if args change or new endpoints are added.

The `apiDocs.describe` endpoint is what agents call on connect, so if
it's wrong, agents will send bad data. Treat it like a public contract.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
