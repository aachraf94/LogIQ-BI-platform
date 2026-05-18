import type {
  LoginResponse, User, UserPreferences, LoginSession,
  DashboardBookmark, UserActivity, Announcement,
  Notification, NotificationCount, AlertRule, Alert,
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

  getSessions: () => request<LoginSession[]>('/users/me/sessions/'),

  getBookmarks: () => request<DashboardBookmark[]>('/users/me/bookmarks/'),

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
    request('/activity/track/', {
      method: 'POST',
      body: JSON.stringify({ dashboard, action }),
    }).catch(() => undefined), // fire-and-forget
}

// ─── Announcements ────────────────────────────────────────────────────────────

export const announcementsApi = {
  list: () => request<Announcement[]>('/users/announcements/'),

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
    request<Notification[]>(`/notifications/${unreadOnly ? '?unread=true' : ''}`),

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
  list: () => request<AlertRule[]>('/notifications/rules/'),

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
    request<Alert[]>(
      `/notifications/alerts/${unacknowledged ? '?unacknowledged=true' : ''}`
    ),

  acknowledge: (id: number, note = '') =>
    request(`/notifications/alerts/${id}/acknowledge/`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
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

  update: (id: string, data: Partial<User>) =>
    request<User>(`/users/admin/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

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
    request<LoginSession[]>(`/users/admin/users/${id}/sessions/`),

  forceLogout: (id: string) =>
    request(`/users/admin/users/${id}/force-logout/`, { method: 'POST' }),

  activity: () => request<AdminActivity>('/users/admin/activity/'),
}

// ─── Admin — roles ────────────────────────────────────────────────────────────

export const adminRolesApi = {
  list: () => request<Role[]>('/users/admin/roles/'),

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
