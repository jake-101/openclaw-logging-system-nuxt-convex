import type { ChartOptions } from 'chart.js'

/**
 * Shared Chart.js option presets used across analytics pages.
 *
 * Returns reactive-compatible plain objects. Each page can spread or
 * extend these with page-specific overrides.
 */
export function useChartOptions() {
  const bar: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  }

  const costBar: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value: string | number) => `$${value}` }
      }
    }
  }

  const durationBar: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value: string | number) => `${value}ms` }
      }
    }
  }

  const line: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value: string | number) => `$${value}` }
      }
    }
  }

  const doughnut: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  }

  const doughnutRight: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } }
  }

  return {
    bar,
    costBar,
    durationBar,
    line,
    doughnut,
    doughnutRight
  }
}
