import { useTheme } from 'next-themes'

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'
  return {
    tooltipBg:      isDark ? '#1E2030' : '#FFFFFF',
    borderColor:    isDark ? '#2D3050' : '#E2E8F0',
    textColor:      isDark ? '#E2E8F0' : '#0F172A',
    axisColor:      isDark ? '#2D3050' : '#E2E8F0',
    splitColor:     isDark ? '#2D3050' : '#E2E8F0',
    labelColor:     isDark ? '#64748B' : '#94A3B8',
    legendColor:    isDark ? '#94A3B8' : '#64748B',
    nodeFill:       isDark ? '#252840' : '#F1F5F9',
    bgColor:        isDark ? '#161829' : '#F8FAFC',
    surface:        isDark ? '#1E2030' : '#FFFFFF',
  }
}
