# LOGIQ Platform — Backend

Django 4.2 + Django REST Framework backend for the LOGIQ BI Platform.
Serves the Next.js frontend, orchestrates Celery alert workers, and exposes a fully documented OpenAPI 3.0 REST API.

---

## Quick Start

```powershell
cd logiq\backend

# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables (copy and fill in)
cp .env.example .env   # or set vars manually

# 4. Apply database migrations
python manage.py migrate --settings=config.settings.dev

# 5. Create superadmin
python manage.py createsuperuser --settings=config.settings.dev

# 6. Run development server
python manage.py runserver --settings=config.settings.dev
# → http://localhost:8000

# 7. Import users from HRForce (first-time setup)
python manage.py sync_hrforce_users --settings=config.settings.dev

# 8. Run Celery worker (separate terminal)
celery -A config worker -l info

# 9. Run Celery Beat scheduler (separate terminal)
celery -A config beat -l info
```

> **Prerequisites**: PostgreSQL platform DB on port 5432, warehouse DB on port 5433, Redis on port 6379.

---

## Directory Structure

```
backend/
├── manage.py
├── requirements.txt
├── Dockerfile
├── config/
│   ├── settings/
│   │   ├── base.py       # Shared settings (JWT, DRF, Spectacular, Celery)
│   │   ├── dev.py        # DEBUG=True, permissive CORS
│   │   └── prod.py       # DEBUG=False, strict CORS
│   ├── urls.py           # Root router + Swagger/ReDoc endpoints
│   ├── db_router.py      # Dual-DB router (platform vs warehouse)
│   └── wsgi.py
└── apps/
    ├── users/            # Auth, roles, preferences, bookmarks, activity
    ├── notifications/    # In-app notifications, alert rules, alerts, SSE
    ├── integrations/     # ETL run tracker, health check, platform stats
    └── analytics/        # Warehouse queries (not yet implemented)
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `insecure-dev-key` | Django secret key |
| `PLATFORM_DB_NAME` | `logiq_platform` | Operational DB name |
| `PLATFORM_DB_USER` | `postgres` | Operational DB user |
| `PLATFORM_DB_PASSWORD` | `changeme` | Operational DB password |
| `PLATFORM_DB_HOST` | `localhost` | Operational DB host |
| `PLATFORM_DB_PORT` | `5432` | Operational DB port |
| `WAREHOUSE_DB_NAME` | `logiq_warehouse` | Analytical DB name |
| `WAREHOUSE_DB_USER` | `postgres` | Analytical DB user |
| `WAREHOUSE_DB_PASSWORD` | `changeme` | Analytical DB password |
| `WAREHOUSE_DB_HOST` | `localhost` | Analytical DB host |
| `WAREHOUSE_DB_PORT` | `5433` | Analytical DB port |
| `REDIS_URL` | `redis://localhost:6379/0` | Celery broker + result backend |
| `DAGSTER_WEBHOOK_TOKEN` | *(empty)* | Shared secret for ETL webhook |

---

## API Documentation

Once the server is running:

| URL | Description |
|---|---|
| `GET /api/docs/` | **Swagger UI** — interactive API explorer with persistent auth |
| `GET /api/redoc/` | **ReDoc** — clean reference documentation |
| `GET /api/schema/` | Raw OpenAPI 3.0 JSON schema |

**Authenticating in Swagger UI**: call `POST /api/users/auth/login/`, copy the `access` token, click **Authorize**, enter `Bearer <token>`.

---

## Apps

---

### `apps/users` — Authentication & User Management

#### Models

| Model | Description |
|---|---|
| `Role` | Operational role controlling dashboard access. 5 system roles seeded on first migration. |
| `User` | Extends `AbstractUser`. Imported from HRForce with `is_active=False`. UUID primary key. |
| `UserPreferences` | Per-user UI preferences (theme, language) and notification channel opt-ins. Created on first access. |
| `LoginSession` | Audit trail of every login — IP, browser, OS, device type, JWT JTI. |
| `Announcement` | Admin-broadcast messages with role targeting, expiry, and pin support. |
| `DashboardBookmark` | Named, shareable snapshot of a dashboard's filter state. |
| `UserActivity` | Lightweight visit/action log powering the admin activity feed. |

#### Default Roles (seeded, `is_system=True`)

| Role key | Display name | Accessible dashboards |
|---|---|---|
| `direction_generale` | Direction Générale | overview · transport · parcels · routes |
| `responsable_transport` | Responsable Transport | overview · transport |
| `responsable_colis` | Responsable Colis & PCC | overview · parcels |
| `responsable_tournees` | Responsable Tournées | overview · routes |
| `analyste` | Analyste BI | overview · transport · parcels · routes |

System roles cannot be deleted via the API or admin panel.

#### Authentication Endpoints (`/api/users/auth/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `auth/login/` | Public | Authenticate with HRForce credentials. Returns `access` token (60 min), `refresh` token (7 days), full user profile, and `is_first_login` flag. |
| `POST` | `auth/logout/` | Bearer | Blacklist the refresh token and close the active session. |
| `POST` | `auth/refresh/` | Public | Rotate tokens — returns a new access + refresh pair. |

**Login response body:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "is_first_login": true,
  "user": { ... }
}
```

#### Current User Endpoints (`/api/users/me/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `me/` | Full profile: role, accessible dashboards, preferences, unread notification count, last-login display. |
| `POST` | `me/onboarding/complete/` | Mark first-login onboarding walkthrough as done. |
| `GET` | `me/preferences/` | Retrieve UI and notification preferences. |
| `PATCH` | `me/preferences/` | Partial update preferences (theme, language, pinned dashboards, notification opt-ins, saved filters). |
| `GET` | `me/sessions/` | Last 10 login sessions with browser, OS, IP, duration. |
| `GET` | `me/bookmarks/` | Own bookmarks + shared bookmarks from role peers. |
| `POST` | `me/bookmarks/` | Create a new dashboard bookmark. |
| `GET` | `me/bookmarks/<id>/` | Retrieve one bookmark. |
| `PATCH` | `me/bookmarks/<id>/` | Update bookmark (owner only). |
| `DELETE` | `me/bookmarks/<id>/` | Delete bookmark (owner only). |
| `GET` | `me/activity/` | Last 50 personal activity events. |

#### Announcement Endpoints (`/api/users/announcements/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `announcements/` | Bearer | Active announcements visible to the current user's role. Expired announcements automatically excluded. |
| `POST` | `announcements/manage/` | Superadmin | Create a new announcement. |
| `GET/PATCH/DELETE` | `announcements/manage/<id>/` | Superadmin | Manage an existing announcement. |

#### Superadmin — User Management (`/api/users/admin/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `admin/users/` | Paginated user list. Search: `?search=name`. Filter: `?is_active=true&role=<id>`. |
| `GET` | `admin/users/stats/` | Aggregated stats: total, active, inactive, superadmins, without-role, breakdown by role, new this month, never logged in. |
| `GET` | `admin/users/<uuid>/` | Full profile of any user. |
| `PATCH` | `admin/users/<uuid>/` | Edit: role, is_active, is_staff, phone, department, agence, company. Passwords are HRForce-managed. |
| `POST` | `admin/users/activate/` | Bulk activate or deactivate: `{"user_ids": [...], "is_active": true}`. |
| `POST` | `admin/users/assign-role/` | Bulk assign role: `{"user_ids": [...], "role_id": 3}`. Pass `null` to unassign. |
| `GET` | `admin/users/<uuid>/sessions/` | Last 20 login sessions for any user. |
| `POST` | `admin/users/<uuid>/force-logout/` | Terminate all sessions + blacklist all JWT tokens immediately. |

#### Superadmin — Role Management (`/api/users/admin/roles/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `admin/roles/` | List all roles with user counts per role. |
| `POST` | `admin/roles/create/` | Create a custom role. |
| `GET` | `admin/roles/<id>/` | Role detail. |
| `PATCH` | `admin/roles/<id>/` | Edit name, dashboards, color, description. System roles: name is protected. |
| `DELETE` | `admin/roles/<id>/` | Delete role. Blocked for system roles. Unassigns all users first. |

#### Superadmin — Activity Feed

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `admin/activity/` | Per-dashboard visits and unique users for today and this week. |

#### Activity Tracking

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `activity/track/` | Record a dashboard visit or action: `{"dashboard": "transport", "action": "view"}`. |

---

### `apps/notifications` — Notifications, Alerts & SSE

#### Models

| Model | Description |
|---|---|
| `Notification` | In-app notification for a specific user. Types: `alert`, `etl`, `announcement`, `system`. |
| `AlertRule` | Threshold-based rule evaluated every 15 minutes by Celery. Supports cooldown to prevent spam. |
| `Alert` | Triggered instance of an AlertRule. Must be acknowledged by a dashboard-authorized user. |

#### Notification Endpoints (`/api/notifications/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List notifications. Filter: `?unread=true`. |
| `GET` | `count/` | `{"total": N, "unread": N}` — for notification badge. |
| `POST` | `<id>/read/` | Mark a single notification as read. |
| `POST` | `read-all/` | Mark all notifications as read at once. |
| `GET` | `stream/?token=<jwt>` | **SSE stream** — real-time push via `EventSource`. |

#### SSE Stream

```javascript
const es = new EventSource(`/api/notifications/stream/?token=${accessToken}`);

es.addEventListener("notification", e => {
  const notif = JSON.parse(e.data);  // full Notification object
  showToast(notif.title);
});

es.addEventListener("count", e => {
  const { unread } = JSON.parse(e.data);
  updateBadge(unread);
});
```

Events:
- `notification` — new Notification object (same schema as `GET /api/notifications/`)
- `count` — `{"unread": N}` — fires on connect and after each new notification
- `: heartbeat` — comment every 20 s to keep proxies alive

Auth: pass JWT access token as `?token=` query param (EventSource cannot set headers).

#### Alert Rule Endpoints (`/api/notifications/rules/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `rules/` | Bearer | List rules visible to current user's dashboards. |
| `POST` | `rules/` | Superadmin | Create a new alert rule. |
| `GET/PATCH/DELETE` | `rules/<id>/` | Mixed | Read: all; Write: superadmin only. |

**Alert rule metrics:**
| Key | Description |
|---|---|
| `ecart_tarif_pct` | Average tariff deviation (%) |
| `taux_livraison_pct` | Delivery success rate (%) |
| `transport_cost_dzd` | Monthly transport cost (DZD) |
| `nbr_sous_tarif` | Number of under-tariff parcels |
| `marge_brute_transport_pct` | Transport gross margin (%) |
| `nbr_livraisons_jour` | Daily delivery volume |

#### Alert Endpoints (`/api/notifications/alerts/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `alerts/` | Triggered alerts for current user's dashboards. Filter: `?unacknowledged=true`. |
| `POST` | `alerts/<id>/acknowledge/` | Acknowledge with optional note. Only users with dashboard access can acknowledge. |

#### Celery Tasks

| Task | Schedule | Description |
|---|---|---|
| `evaluate_alert_rules` | Every 15 min | Queries warehouse metrics, evaluates all active rules, creates `Alert` + `Notification` rows on trigger. Respects per-rule cooldown. |
| `notify_etl_complete` | On-demand | Called by ETL webhook. Creates notifications for users with `notif_etl_status=True`. |

---

### `apps/integrations` — ETL Tracker & Health

#### Models

| Model | Description |
|---|---|
| `ETLRun` | Records every Dagster pipeline execution — status, duration, rows loaded per asset, error message. |

#### Health Endpoints (`/api/integrations/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `health/` | Public | Platform health: checks platform DB, warehouse DB, Redis. Returns `healthy` / `degraded` / `down`. Used by load balancers and uptime monitors. |
| `GET` | `health/stats/` | Superadmin | Detailed stats: users online now, unacknowledged alerts, unread notifications total, ETL runs today, last ETL status. |

**Health response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-17T10:00:00Z",
  "services": {
    "platform_db": {"status": "healthy"},
    "warehouse_db": {"status": "healthy"},
    "cache":        {"status": "healthy"}
  }
}
```

Returns HTTP 503 when any service is down.

#### ETL Endpoints (`/api/integrations/etl/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `etl/webhook/` | `X-Dagster-Webhook-Token` header | Called by Dagster on run start and completion. Creates or updates the `ETLRun` record. |
| `GET` | `etl/runs/` | Bearer | Last 100 runs. Filter: `?job_name=full_etl_job&status=success`. |
| `GET` | `etl/freshness/` | Bearer | Compact freshness summary for the dashboard header. |

**Freshness response:**
```json
{
  "last_successful_run": { ... },
  "last_run": { ... },
  "is_stale": false,
  "lag_display": "Il y a 2h",
  "runs_last_7_days": 7,
  "success_rate_pct": 100.0
}
```

**Dagster webhook payload** (POST to `etl/webhook/`):
```json
{
  "dagster_run_id": "abc123",
  "job_name": "full_etl_job",
  "status": "success",
  "triggered_by": "schedule",
  "started_at": "2026-05-17T01:00:00Z",
  "finished_at": "2026-05-17T01:14:32Z",
  "duration_seconds": 872,
  "assets_materialized": {
    "stg_yalidine_parcel_history": 45000,
    "fact_livraisons": 12500,
    "refresh_agg_profitabilite_colis": 1
  },
  "total_rows_loaded": 57501
}
```

---

## HRForce User Sync

Users are imported from HRForce using a management command — **not** through the ETL pipeline.
This keeps bcrypt password hashes out of the warehouse staging tables entirely.

### Why a management command?

The ETL pipeline writes to the **warehouse DB** (analytical). Django users live in the **platform DB** (operational). The management command bridges the two by calling the HRForce API directly and writing to Django's `User` table — no intermediate staging table, no password at rest in the warehouse.

### Password handling

HRForce hashes passwords with **bcrypt** (`$2b$12$...`).
Django's default hasher is PBKDF2 — it cannot verify raw bcrypt hashes.

**Solution:**
1. `PASSWORD_HASHERS` in `base.py` sets `BCryptPasswordHasher` as the primary hasher.
2. The sync command prefixes the raw hash with `bcrypt$` before saving:

```
HRForce raw hash  →  $2b$12$abcdef...
Django stores     →  bcrypt$$2b$12$abcdef...
```

Django's `BCryptPasswordHasher.verify()` strips the `bcrypt$` prefix and passes the rest directly to the `bcrypt` library — no re-hashing, no data loss.

### Running the sync

```powershell
# Full sync (creates new users, updates profiles + passwords)
python manage.py sync_hrforce_users --settings=config.settings.dev

# Preview changes without writing anything
python manage.py sync_hrforce_users --dry-run --settings=config.settings.dev

# Sync only one company
python manage.py sync_hrforce_users --company-id 3 --settings=config.settings.dev
```

### What the command does per user

| Condition | Action |
|---|---|
| `company_id == 9` (TEST company) | Skip |
| User not in Django yet | Create with `is_active=False`, bcrypt password |
| User exists, profile fields changed | Update name / email / phone / agence / company |
| User exists, bcrypt hash changed | Re-sync password hash |
| User exists, nothing changed | Skip (no DB write) |
| `is_active` or `role` on existing user | **Never overwritten** — admin controls these |

### Environment variables required

```
HRFORCE_API_TOKEN=<token>
API_BASE_URL=http://localhost:8000
```

### After the sync

Imported users have `is_active=False`. The superadmin must activate them in:
- **Django Admin** → Users → select → "Activer les utilisateurs sélectionnés"
- **API** → `POST /api/users/admin/users/activate/` `{"user_ids": [...], "is_active": true}`

The superadmin also assigns a role before the user can access any dashboard.

---

## Permissions

| Class | Who passes |
|---|---|
| `IsAuthenticated` | Any active user with a valid JWT |
| `IsSuperAdmin` | `is_superuser=True` only |
| `HasDashboardAccess` | Users whose role includes the view's `dashboard_key` |
| `CanAccessOverview` | Role includes `"overview"` |
| `CanAccessTransport` | Role includes `"transport"` |
| `CanAccessParcels` | Role includes `"parcels"` |
| `CanAccessRoutes` | Role includes `"routes"` |

---

## Authentication Flow

```
POST /api/users/auth/login/
  └── validates credentials against Django's auth backend
  └── creates LoginSession (IP, browser, OS, device)
  └── returns { access, refresh, is_first_login, user }

All subsequent requests:
  Authorization: Bearer <access_token>

Token expiry (60 min):
  POST /api/users/auth/refresh/   { "refresh": "..." }
  └── returns new access + refresh (old refresh blacklisted)

Logout:
  POST /api/users/auth/logout/    { "refresh": "..." }
  └── blacklists refresh token
  └── marks LoginSession as inactive
```

---

## Database Architecture

Two PostgreSQL databases managed by `config/db_router.py`:

| Alias | Port | Used by | Contents |
|---|---|---|---|
| `default` | 5432 | users, notifications, integrations | Operational data (users, sessions, alerts, ETL runs) |
| `warehouse` | 5433 | analytics | Constellation schema (fact/dim tables, materialized views) |

The router sends `analytics` app queries to the warehouse DB automatically. All other apps use the platform DB.

---

## Migrations

```powershell
# Apply all migrations
python manage.py migrate --settings=config.settings.dev

# After modifying models
python manage.py makemigrations --settings=config.settings.dev
python manage.py migrate --settings=config.settings.dev
```

Migration order (dependencies):
1. `users 0001_initial` — creates Role, User, UserPreferences, LoginSession, Announcement
2. `users 0002_seed_roles` — inserts the 5 default system roles
3. `users 0003_bookmarks_activity` — creates DashboardBookmark, UserActivity
4. `notifications 0001_initial` — creates Notification, AlertRule, Alert
5. `integrations 0001_initial` — creates ETLRun

---

## Django Admin

Access at `/admin/` (superadmin credentials required).

| Section | Features |
|---|---|
| **Roles** | Color-coded dashboard badges, active user count, system-role protection |
| **Users** | Status badge, role badge, sessions inline, bulk activate/deactivate actions, HRForce ID display |
| **Login Sessions** | Full audit log, read-only, date hierarchy |
| **Announcements** | Level badges, role targeting display, auto-set `created_by` |
| **Notifications** | Type badges, bulk mark-as-read action |
| **Alert Rules** | Condition display (`> 15.5`), severity badge, trigger count |
| **Alerts** | Severity badge, bulk acknowledge action |
| **ETL Runs** | Status badge, duration, asset count, read-only |

---

## Celery

Two processes required for scheduled tasks:

```powershell
# Worker (processes tasks)
celery -A config worker -l info

# Beat (scheduler — triggers evaluate_alert_rules every 15 min)
celery -A config beat -l info
```

Configured tasks:

| Task | Schedule | Trigger |
|---|---|---|
| `evaluate_alert_rules` | Every 15 min (Beat) | Evaluates all active AlertRules against warehouse KPIs |
| `notify_etl_complete` | On-demand | Called by ETL webhook after pipeline completion |

---

## Dependencies

| Package | Purpose |
|---|---|
| `django>=4.2` | Web framework |
| `djangorestframework` | REST API |
| `djangorestframework-simplejwt` | JWT auth with token blacklisting |
| `drf-spectacular` | OpenAPI 3.0 schema + Swagger UI + ReDoc |
| `psycopg2-binary` | PostgreSQL driver |
| `django-cors-headers` | CORS for Next.js frontend |
| `django-filter` | QuerySet filtering via query params |
| `celery` | Async task queue |
| `redis` | Celery broker + result backend |
| `python-dotenv` | `.env` file loading |
| `user-agents` | Parse browser/OS/device from User-Agent header |
| `bcrypt` | Verify HRForce bcrypt password hashes in Django |
| `requests` | HTTP client used by `sync_hrforce_users` management command |
