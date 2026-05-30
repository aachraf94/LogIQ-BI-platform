import type {
  LoginResponse, User, UserPreferences, LoginSession,
  DashboardBookmark, UserActivity, Announcement,
  Notification, NotificationCount, AlertRule, AlertRuleWithPreference, UserAlertRulePreference, Alert,
  ETLRun, DataFreshness, HealthStatus, PlatformStats,
  UserStats, AdminActivity, PaginatedResponse, Role,
} from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

// ─── Token storage ────────────────────────────────────────────────────────────

const KEYS = { access: 'logiq_access', refresh: 'logiq_refresh' } as const

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEYS.access)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEYS.refresh)
}

export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem(KEYS.access, access)
  localStorage.setItem(KEYS.refresh, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(KEYS.access)
  localStorage.removeItem(KEYS.refresh)
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, public data: Record<string, unknown>) {
    super(ApiError.extractMessage(data) ?? `API Error ${status}`)
    this.name = 'ApiError'
  }

  private static extractMessage(data: Record<string, unknown>): string | null {
    if (!data) return null
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.non_field_errors)) return (data.non_field_errors as string[]).join(', ')
    const entries = Object.entries(data)
    if (entries.length > 0) {
      return entries
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ')
    }
    return null
  }
}

// ─── Token refresh (singleton promise — prevents race conditions) ─────────────

let _refreshing: Promise<string | null> | null = null

async function attemptTokenRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing

  _refreshing = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) return null

    const res = await fetch(`${BASE_URL}/users/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })

    if (!res.ok) {
      clearTokens()
      return null
    }

    const data = await res.json()
    saveTokens(data.access, data.refresh ?? refresh)
    return data.access as string
  })().finally(() => { _refreshing = null })

  return _refreshing
}

// ─── Core request ─────────────────────────────────────────────────────────────

async function requestList<T>(
  path: string,
  init: RequestInit = {},
): Promise<T[]> {
  const data = await request<PaginatedResponse<T> | T[]>(path, init)
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<T>).results ?? []
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<T> {
  const access = getAccessToken()

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (access) headers['Authorization'] = `Bearer ${access}`

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (res.status === 401 && _retry) {
    const newAccess = await attemptTokenRefresh()
    if (newAccess) return request<T>(path, init, false)

    clearTokens()
    if (typeof window !== 'undefined') window.location.replace('/login')
    throw new ApiError(401, { detail: 'Session expired' })
  }

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body)

  return body as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/users/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: (refresh: string) =>
    request('/users/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    }),
}

// ─── Current user ─────────────────────────────────────────────────────────────

export const meApi = {
  get: () => request<User>('/users/me/'),

  completeOnboarding: () =>
    request('/users/me/onboarding/complete/', { method: 'POST' }),

  getPreferences: () => request<UserPreferences>('/users/me/preferences/'),

  updatePreferences: (data: Partial<UserPreferences>) =>
    request<UserPreferences>('/users/me/preferences/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getSessions: () => requestList<LoginSession>('/users/me/sessions/'),

  getBookmarks: () => requestList<DashboardBookmark>('/users/me/bookmarks/'),

  createBookmark: (data: Omit<DashboardBookmark, 'id' | 'created_at' | 'owner_name'>) =>
    request<DashboardBookmark>('/users/me/bookmarks/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBookmark: (id: number, data: Partial<DashboardBookmark>) =>
    request<DashboardBookmark>(`/users/me/bookmarks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteBookmark: (id: number) =>
    request(`/users/me/bookmarks/${id}/`, { method: 'DELETE' }),

  getActivity: () => request<UserActivity[]>('/users/me/activity/'),

  trackActivity: (dashboard: string, action = 'view') =>
    request('/users/activity/track/', {
      method: 'POST',
      body: JSON.stringify({ dashboard, action }),
    }).catch(() => undefined), // fire-and-forget
}

// ─── Announcements ────────────────────────────────────────────────────────────

export const announcementsApi = {
  list: () => requestList<Announcement>('/users/announcements/'),

  create: (data: Partial<Announcement>) =>
    request<Announcement>('/users/announcements/manage/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Announcement>) =>
    request<Announcement>(`/users/announcements/manage/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/users/announcements/manage/${id}/`, { method: 'DELETE' }),
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    requestList<Notification>(`/notifications/${unreadOnly ? '?unread=true' : ''}`),

  count: () => request<NotificationCount>('/notifications/count/'),

  markRead: (id: number) =>
    request(`/notifications/${id}/read/`, { method: 'POST' }),

  markAllRead: () => request('/notifications/read-all/', { method: 'POST' }),

  streamUrl: (): string => {
    const token = getAccessToken()
    return `${BASE_URL}/notifications/stream/?token=${token ?? ''}`
  },
}

// ─── Alert rules ──────────────────────────────────────────────────────────────

export const alertRulesApi = {
  list: () => requestList<AlertRule>('/notifications/rules/'),

  create: (data: Partial<AlertRule>) =>
    request<AlertRule>('/notifications/rules/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => request<AlertRule>(`/notifications/rules/${id}/`),

  update: (id: number, data: Partial<AlertRule>) =>
    request<AlertRule>(`/notifications/rules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/notifications/rules/${id}/`, { method: 'DELETE' }),
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsApi = {
  list: (unacknowledged?: boolean) =>
    requestList<Alert>(
      `/notifications/alerts/${unacknowledged ? '?unacknowledged=true' : ''}`
    ),

  acknowledge: (id: number, note = '') =>
    request(`/notifications/alerts/${id}/acknowledge/`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
}

// ─── User alert rule preferences ──────────────────────────────────────────────

export const myAlertRulesApi = {
  list: () => requestList<AlertRuleWithPreference>('/notifications/my-rules/'),

  setSubscription: (ruleId: number, isSubscribed: boolean) =>
    request<UserAlertRulePreference>(`/notifications/my-rules/${ruleId}/subscribe/`, {
      method: 'POST',
      body: JSON.stringify({ is_subscribed: isSubscribed }),
    }),
}

// ─── Overview analytics ───────────────────────────────────────────────────────

export interface OverviewKpis {
  transport_requests:        number
  pop_transport_requests:    number
  transport_on_time_pct:     number
  pop_transport_on_time:     number
  parcel_handled:            number
  pop_parcel_handled:        number
  parcel_delivery_rate_pct:  number
  pop_parcel_delivery_rate:  number
  total_revenue:             number
  pop_total_revenue:         number
  transport_revenue:         number
  parcel_revenue:            number
}

export interface OverviewActivityPoint {
  period:              string   // YYYY-MM
  transport_requests:  number
  parcel_handled:      number
}

export const overviewApi = {
  kpis: () =>
    request<OverviewKpis>('/analytics/overview/kpis/'),
  activityTrend: () =>
    request<OverviewActivityPoint[]>('/analytics/overview/activity-trend/'),
}

// ─── ETL ──────────────────────────────────────────────────────────────────────

export const etlApi = {
  runs: (params?: { job_name?: string; status?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : ''
    return request<ETLRun[]>(`/integrations/etl/runs/${qs}`)
  },

  freshness: () => request<DataFreshness>('/integrations/etl/freshness/'),
}

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => request<HealthStatus>('/integrations/health/'),
  stats: () => request<PlatformStats>('/integrations/health/stats/'),
}

// ─── Admin — users ────────────────────────────────────────────────────────────

export interface SyncResult {
  total_fetched: number
  created: number
  updated: number
  skipped: number
  errors: number
}

export interface AdminUserPatch {
  role?: number | null
  is_active?: boolean
  is_staff?: boolean
  phone?: string
  department?: string
  avatar_url?: string
}

export const adminUsersApi = {
  list: (params?: {
    search?: string
    is_active?: boolean
    role?: number
    page?: number
  }) => {
    const filtered = Object.fromEntries(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
    const qs = Object.keys(filtered).length
      ? '?' + new URLSearchParams(filtered).toString()
      : ''
    return request<PaginatedResponse<User>>(`/users/admin/users/${qs}`)
  },

  stats: () => request<UserStats>('/users/admin/users/stats/'),

  get: (id: string) => request<User>(`/users/admin/users/${id}/`),

  update: (id: string, data: AdminUserPatch) =>
    request<User>(`/users/admin/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  syncHRForce: () =>
    request<SyncResult>('/users/admin/users/sync-hrforce/', { method: 'POST' }),

  bulkActivate: (userIds: string[], isActive: boolean) =>
    request('/users/admin/users/activate/', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds, is_active: isActive }),
    }),

  bulkAssignRole: (userIds: string[], roleId: number | null) =>
    request('/users/admin/users/assign-role/', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds, role_id: roleId }),
    }),

  getSessions: (id: string) =>
    requestList<LoginSession>(`/users/admin/users/${id}/sessions/`),

  forceLogout: (id: string) =>
    request(`/users/admin/users/${id}/force-logout/`, { method: 'POST' }),

  activity: () => request<AdminActivity>('/users/admin/activity/'),
}

// ─── Transport analytics ──────────────────────────────────────────────────────

function _qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  return entries.length ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : ""
}

export interface TransportFilters {
  year?: number | null
  month?: number | null
  service_type?: string
  company_id?: number | null
}

export const transportApi = {
  summary: (f: TransportFilters = {}) =>
    request<import("@/types/transport").TransportSummary>(
      `/analytics/transport/summary/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  trends: (f: { service_type?: string; company_id?: number | null; from_year_month?: string; to_year_month?: string } = {}) =>
    request<import("@/types/transport").TransportTrendPoint[]>(
      `/analytics/transport/trends/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  costBreakdown: (f: { year?: number | null; month?: number | null; service_type?: string } = {}) =>
    request<import("@/types/transport").TransportCostBreakdown>(
      `/analytics/transport/cost-breakdown/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  byService: (f: { year?: number | null; month?: number | null } = {}) =>
    request<import("@/types/transport").TransportServiceData[]>(
      `/analytics/transport/by-service/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  byVehicle: (f: { year?: number | null; month?: number | null; service_type?: string } = {}) =>
    request<import("@/types/transport").TransportVehicleData[]>(
      `/analytics/transport/by-vehicle/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  corridors: (f: {
    year?: number | null; month?: number | null;
    service_type?: string; client_type?: string;
    limit?: number; sort_by?: string
  } = {}) =>
    request<import("@/types/transport").TransportCorridor[]>(
      `/analytics/transport/corridors/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  odMatrix: (f: { year?: number | null; month?: number | null } = {}) =>
    request<import("@/types/transport").ODMatrixCell[]>(
      `/analytics/transport/od-matrix/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  byAgency: (f: { year?: number | null; month?: number | null; region?: string; service_type?: string } = {}) =>
    request<import("@/types/transport").TransportAgencyData[]>(
      `/analytics/transport/by-agency/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  delayDistribution: (f: { year?: number | null; month?: number | null; service_type?: string } = {}) =>
    request<import("@/types/transport").DelayBucket[]>(
      `/analytics/transport/delay-distribution/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),
}

// ─── Transport analytics (tabbed, date-range based) ───────────────────────────

export type TransportAnalyticsFilters = {
  start_date: string
  end_date: string
  service_type?: string
}

const _ta = (f: TransportAnalyticsFilters) =>
  _qs(f as unknown as Record<string, string | number | undefined | null>)

export const transportAnalyticsApi = {
  // Operations
  opsKpis: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportOpsKpis>(
      `/analytics/transport-analytics/ops-kpis/${_ta(f)}`
    ),
  monthlyTrend: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportMonthlyTrendPoint[]>(
      `/analytics/transport-analytics/monthly-trend/${_ta(f)}`
    ),
  serviceBreakdown: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportServiceBreakdownItem[]>(
      `/analytics/transport-analytics/service-breakdown/${_ta(f)}`
    ),
  odMatrix: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportODItem[]>(
      `/analytics/transport-analytics/od-matrix/${_ta(f)}`
    ),
  distanceCategory: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportDistanceCategoryItem[]>(
      `/analytics/transport-analytics/distance-category/${_ta(f)}`
    ),

  // Cost & Profitability
  costKpis: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportCostKpis>(
      `/analytics/transport-analytics/cost-kpis/${_ta(f)}`
    ),
  revCostTrend: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportRevCostTrendPoint[]>(
      `/analytics/transport-analytics/rev-cost-trend/${_ta(f)}`
    ),
  costCategories: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportCostCategoryItem[]>(
      `/analytics/transport-analytics/cost-categories/${_ta(f)}`
    ),
  costPerKm: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportCostPerKmItem[]>(
      `/analytics/transport-analytics/cost-per-km/${_ta(f)}`
    ),
  topCorridors: (f: TransportAnalyticsFilters & { limit?: number }) =>
    request<import("@/types/transport_analytics").TransportCorridorItem[]>(
      `/analytics/transport-analytics/top-corridors/${_ta(f)}`
    ),

  // Performance
  perfKpis: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportPerfKpis>(
      `/analytics/transport-analytics/perf-kpis/${_ta(f)}`
    ),
  onTimeTrend: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportOnTimeTrendPoint[]>(
      `/analytics/transport-analytics/on-time-trend/${_ta(f)}`
    ),
  delayBuckets: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportDelayBucketItem[]>(
      `/analytics/transport-analytics/delay-buckets/${_ta(f)}`
    ),
  ratingBuckets: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportRatingBucketItem[]>(
      `/analytics/transport-analytics/rating-buckets/${_ta(f)}`
    ),
  vehiclePerf: (f: TransportAnalyticsFilters) =>
    request<import("@/types/transport_analytics").TransportVehiclePerfItem[]>(
      `/analytics/transport-analytics/vehicle-perf/${_ta(f)}`
    ),

  // Paginated KPI data tables
  opsTable: (f: TransportAnalyticsFilters & { kpi?: string; page?: number; page_size?: number }) =>
    request<import("@/types/transport_analytics").TransportTablePage<import("@/types/transport_analytics").TransportOpsRow>>(
      `/analytics/transport-analytics/table/ops/${_ta(f as unknown as TransportAnalyticsFilters)}`
    ),
  costTable: (f: TransportAnalyticsFilters & { kpi?: string; page?: number; page_size?: number }) =>
    request<import("@/types/transport_analytics").TransportTablePage<import("@/types/transport_analytics").TransportCostRow>>(
      `/analytics/transport-analytics/table/cost/${_ta(f as unknown as TransportAnalyticsFilters)}`
    ),
  perfTable: (f: TransportAnalyticsFilters & { kpi?: string; page?: number; page_size?: number }) =>
    request<import("@/types/transport_analytics").TransportTablePage<import("@/types/transport_analytics").TransportPerfRow>>(
      `/analytics/transport-analytics/table/perf/${_ta(f as unknown as TransportAnalyticsFilters)}`
    ),
}

// ─── Parcel costs analytics ───────────────────────────────────────────────────

export interface ParcelCostsFilters {
  year?: number | null
  month?: number | null
  delivery_type?: string
  agence_id?: number | null
  region?: string
  company_id?: number | null
}

export const parcelCostsApi = {
  summary: (f: ParcelCostsFilters = {}) =>
    request<import("@/types/parcel_costs").ParcelCostsSummaryData>(
      `/analytics/parcel-costs/summary/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  trends: (f: {
    from_year_month?: string; to_year_month?: string;
    delivery_type?: string; agence_id?: number | null
  } = {}) =>
    request<import("@/types/parcel_costs").ParcelCostsTrendPoint[]>(
      `/analytics/parcel-costs/trends/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  pccSummary: (f: ParcelCostsFilters = {}) =>
    request<import("@/types/parcel_costs").ParcelPCCSummary>(
      `/analytics/parcel-costs/pcc-summary/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  pccByAgency: (f: {
    year?: number | null; month?: number | null;
    region?: string; delivery_type?: string; sort_by?: string; limit?: number
  } = {}) =>
    request<import("@/types/parcel_costs").ParcelPCCAgency[]>(
      `/analytics/parcel-costs/pcc-by-agency/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  ecartDistribution: (f: { year: number; month: number; agence_id?: number | null }) =>
    request<import("@/types/parcel_costs").EcartBucketItem[]>(
      `/analytics/parcel-costs/ecart-distribution/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  pccByWilaya: (f: { year: number; month: number; agence_id?: number | null }) =>
    request<import("@/types/parcel_costs").PCCByWilayaItem[]>(
      `/analytics/parcel-costs/pcc-by-wilaya/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  costStructure: (f: ParcelCostsFilters = {}) =>
    request<import("@/types/parcel_costs").CostStructureData>(
      `/analytics/parcel-costs/cost-structure/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  costByNature: (f: { year?: number | null; month?: number | null; agence_id?: number | null } = {}) =>
    request<import("@/types/parcel_costs").CostByNatureItem[]>(
      `/analytics/parcel-costs/cost-by-nature/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  byAgency: (f: { year?: number | null; month?: number | null; region?: string; delivery_type?: string } = {}) =>
    request<import("@/types/parcel_costs").ParcelAgencyData[]>(
      `/analytics/parcel-costs/by-agency/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  byDeliveryType: (f: { year?: number | null; month?: number | null; agence_id?: number | null } = {}) =>
    request<import("@/types/parcel_costs").ParcelDeliveryTypeData[]>(
      `/analytics/parcel-costs/by-delivery-type/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  dailyVolume: (f: { year?: number | null; month?: number | null; agence_id?: number | null } = {}) =>
    request<import("@/types/parcel_costs").DailyVolumePoint[]>(
      `/analytics/parcel-costs/daily-volume/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  durationDistribution: (f: { year: number; month: number; agence_id?: number | null; delivery_type?: string }) =>
    request<import("@/types/parcel_costs").DurationBucket[]>(
      `/analytics/parcel-costs/duration-distribution/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  sinistres: (f: { year?: number | null; month?: number | null; agence_id?: number | null } = {}) =>
    request<import("@/types/parcel_costs").SinistresData>(
      `/analytics/parcel-costs/sinistres/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  freelanceEfficiency: (f: { year?: number | null; month?: number | null; agence_id?: number | null } = {}) =>
    request<import("@/types/parcel_costs").FreelanceEfficiencyItem[]>(
      `/analytics/parcel-costs/freelance-efficiency/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  parcels: (f: {
    year: number; month: number;
    agence_id?: number | null; delivery_type?: string;
    ecart_direction?: string; sort_by?: string; page?: number; page_size?: number
  }) =>
    request<import("@/types/parcel_costs").ParcelsPaginatedResponse>(
      `/analytics/parcel-costs/parcels/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),
}

// ─── Parcel Delivery analytics (date-range based) ────────────────────────────

export interface ParcelDeliveryFilters {
  start_date: string
  end_date: string
  delivery_type?: string
}

export const parcelDeliveryApi = {
  // Operations
  opsKpis: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelOpsKpis>(
      `/analytics/parcel-delivery/ops-kpis/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  opsTrend: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelTrendPoint[]>(
      `/analytics/parcel-delivery/ops-trend/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  statusBreakdown: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelStatusItem[]>(
      `/analytics/parcel-delivery/status-breakdown/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  zoneBreakdown: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelZoneItem[]>(
      `/analytics/parcel-delivery/zone-breakdown/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  regionFlow: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelRegionFlowItem[]>(
      `/analytics/parcel-delivery/region-flow/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  regionProfit: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelRegionProfitItem[]>(
      `/analytics/parcel-delivery/region-profit/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  zoneProfit: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelZoneProfitItem[]>(
      `/analytics/parcel-delivery/zone-profit/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  // Cost & Profitability
  costKpis: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelCostKpis>(
      `/analytics/parcel-delivery/cost-kpis/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  revenueCostTrend: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelRevenueCostPoint[]>(
      `/analytics/parcel-delivery/revenue-cost-trend/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  costByNature: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelCostNatureItem[]>(
      `/analytics/parcel-delivery/cost-by-nature/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  // Performance
  perfKpis: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelPerfKpis>(
      `/analytics/parcel-delivery/perf-kpis/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  perfTrend: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelPerfTrendPoint[]>(
      `/analytics/parcel-delivery/perf-trend/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  durationDistribution: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelDurationBucket[]>(
      `/analytics/parcel-delivery/duration-distribution/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  centerExpeditionRanking: (f: ParcelDeliveryFilters & { limit?: number }) =>
    request<import("@/types/parcel_delivery").ParcelCenterExpedition[]>(
      `/analytics/parcel-delivery/center-expedition-ranking/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),

  claimsTypes: (f: ParcelDeliveryFilters) =>
    request<import("@/types/parcel_delivery").ParcelClaimsType[]>(
      `/analytics/parcel-delivery/claims-types/${_qs(f as unknown as Record<string, string | number | undefined | null>)}`
    ),
}

// ─── Admin — roles ────────────────────────────────────────────────────────────

export const adminRolesApi = {
  list: () => requestList<Role>('/users/admin/roles/'),

  create: (data: Partial<Role>) =>
    request<Role>('/users/admin/roles/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => request<Role>(`/users/admin/roles/${id}/`),

  update: (id: number, data: Partial<Role>) =>
    request<Role>(`/users/admin/roles/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/users/admin/roles/${id}/`, { method: 'DELETE' }),
}
