import type { NavigationMenuItem } from '@nuxt/ui'

export interface NavRoute {
  label: string
  icon: string
  to: string
}

/**
 * Single source of truth for dashboard navigation routes.
 * Used by DashboardSidebar (navigation menu) and DashboardNavbar (page title/icon).
 */

const mainRoutes: NavRoute[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Logs', icon: 'i-lucide-scroll-text', to: '/logs' },
  { label: 'Sessions', icon: 'i-lucide-activity', to: '/sessions' },
  { label: 'Errors', icon: 'i-lucide-alert-triangle', to: '/errors' },
  { label: 'Cron Jobs', icon: 'i-lucide-timer', to: '/crons' },
  { label: 'Rate Limits', icon: 'i-lucide-shield-alert', to: '/rate-limits' },
  { label: 'Models', icon: 'i-lucide-cpu', to: '/models' }
]

const secondaryRoutes: NavRoute[] = [
  { label: 'Analytics', icon: 'i-lucide-bar-chart-3', to: '/analytics' }
]

/** All navigation routes (main + secondary). */
const allRoutes: NavRoute[] = [...mainRoutes, ...secondaryRoutes]

/** Dynamic route patterns that don't appear in the sidebar. */
const dynamicRoutes: NavRoute[] = [
  { label: 'Session Detail', icon: 'i-lucide-activity', to: '/session-' }
]

export function useNavigation() {
  /** Navigation menu items grouped for the sidebar. */
  const sidebarGroups: NavigationMenuItem[][] = [
    mainRoutes as NavigationMenuItem[],
    secondaryRoutes as NavigationMenuItem[]
  ]

  /** Resolve the page title for a given route path. */
  function getPageTitle(path: string): string {
    const staticRoute = allRoutes.find(r => r.to === path)
    if (staticRoute) return staticRoute.label

    const dynamicRoute = dynamicRoutes.find(r => path.startsWith(r.to))
    if (dynamicRoute) return dynamicRoute.label

    return 'OpenClaw'
  }

  /** Resolve the page icon for a given route path. */
  function getPageIcon(path: string): string | undefined {
    const staticRoute = allRoutes.find(r => r.to === path)
    if (staticRoute) return staticRoute.icon

    const dynamicRoute = dynamicRoutes.find(r => path.startsWith(r.to))
    if (dynamicRoute) return dynamicRoute.icon

    return undefined
  }

  return {
    mainRoutes,
    secondaryRoutes,
    allRoutes,
    sidebarGroups,
    getPageTitle,
    getPageIcon
  }
}
