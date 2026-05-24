// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access: string
  refresh: string
  is_first_login: boolean
  user: User
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface Role {
  id: number
  name: string
  display_name: string
  description: string
  dashboards: string[]
  color: string
  is_system: boolean
  user_count?: number
  created_at?: string
  updated_at?: string
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  language: string
  pinned_dashboards: string[]
  saved_filters: Record<string, unknown>
  notif_in_app: boolean
  notif_email: boolean
  notif_alert_triggered: boolean
  notif_etl_status: boolean
  notif_announcements: boolean
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export interface LoginSession {
  id: number
  ip_address: string
  browser: string
  os: string
  device_type: string
  logged_in_at: string
  logged_out_at: string | null
  is_active: boolean
  duration_minutes: number | null
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  department: string
  hrforce_id: number | null
  hrforce_code: string
  hrforce_role: string
  occupation: string
  agence_id: number | null
  agence_name: string
  agence_code: string
  company_id: number | null
  company_name: string
  role: Role | null
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  has_completed_onboarding: boolean
  accessible_dashboards: string[]
  preferences: UserPreferences
  unread_notifications: number
  last_login: string | null
  last_login_display: string | null
  date_joined: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'alert' | 'etl' | 'announcement' | 'system'

export interface Notification {
  id: number
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface NotificationCount {
  total: number
  unread: number
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertCondition = 'gt' | 'lt' | 'gte' | 'lte'

export interface AlertRule {
  id: number
  name: string
  description: string
  metric: string
  metric_display: string
  operator: string
  condition: AlertCondition
  threshold: number
  severity: AlertSeverity
  dashboard: string
  notify_roles: number[]
  is_active: boolean
  cooldown_minutes: number
  last_triggered_at: string | null
  trigger_count: number
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface Alert {
  id: number
  rule: AlertRule
  triggered_value: number
  severity: AlertSeverity
  created_at: string
  is_acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  note: string
}

// ─── ETL ──────────────────────────────────────────────────────────────────────

export type ETLStatus = 'running' | 'success' | 'failed' | 'cancelled'

export interface ETLRun {
  id: number
  dagster_run_id: string
  job_name: string
  status: ETLStatus
  triggered_by: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  assets_materialized: Record<string, number>
  total_rows_loaded: number
  error_message: string
}

export interface DataFreshness {
  last_successful_run: ETLRun | null
  last_run: ETLRun | null
  is_stale: boolean
  lag_display: string
  runs_last_7_days: number
  success_rate_pct: number
}

// ─── Announcements ────────────────────────────────────────────────────────────

export interface Announcement {
  id: number
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
  target_roles: number[]
  is_pinned: boolean
  expires_at: string | null
  created_by: string
  created_at: string
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export interface DashboardBookmark {
  id: number
  dashboard: string
  name: string
  filters: Record<string, unknown>
  is_shared: boolean
  emoji: string
  created_at: string
  owner_name: string
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface UserStats {
  total: number
  active: number
  inactive: number
  superadmins: number
  without_role: number
  by_role: Array<{ role__display_name: string; count: number }>
  new_this_month: number
  never_logged_in: number
}

export interface AdminActivity {
  today: Array<{ dashboard: string; visits: number; unique_users: number }>
  this_week: Array<{ dashboard: string; visits: number; unique_users: number }>
}

export interface PlatformStats {
  users_online_now: number
  unacknowledged_alerts: number
  unread_notifications_total: number
  etl_runs_today: number
  last_etl_status: ETLStatus | null
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  services: {
    platform_db: { status: string }
    warehouse_db: { status: string }
    cache: { status: string }
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── User Activity ────────────────────────────────────────────────────────────

export interface UserActivity {
  id: number
  dashboard: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
}
