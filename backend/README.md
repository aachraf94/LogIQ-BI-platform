# LOGIQ Backend

Django 4.2 + Django REST Framework. REST API, JWT authentication, alert evaluation via Celery, and read-only access to the analytical data warehouse.

**Local port:** 8000
**API docs:** `http://localhost:8000/api/docs/` (Swagger)

## Setup

```powershell
cd backend

python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt

cp .env.example .env
# Edit .env: set PLATFORM_DB_PORT=5433, WAREHOUSE_DB_PORT=5433,
#            API_BASE_URL=http://localhost:8001, and a SECRET_KEY

python manage.py migrate
python manage.py create_superadmin

python manage.py runserver   # http://localhost:8000
```

## Celery Worker

```powershell
# Second terminal, same venv
celery -A config worker -l info
```

## Key Commands

```powershell
python manage.py migrate                  # apply DB migrations
python manage.py create_superadmin        # seed superadmin from .env
python manage.py sync_hrforce_users       # import users from HRForce API
```

## Django Apps

| App | Description |
|---|---|
| `apps.users` | Auth (JWT), roles, user management, sessions, preferences, bookmarks |
| `apps.notifications` | In-app notifications, alert rule CRUD, Celery alert evaluation |
| `apps.analytics` | Warehouse read-only query views — transport analytics live, 9 endpoints under `/api/analytics/transport/` |
| `apps.integrations` | ETL webhook, health check, data freshness |

## Settings

| Module | When used |
|---|---|
| `config.settings.dev` | Local: loads `backend/.env` via python-dotenv |
| `config.settings.prod` | Docker: env injected by compose |

Set via `DJANGO_SETTINGS_MODULE` in `.env`.

## Analytics endpoints (transport)

All require `Authorization: Bearer <token>`. Source: `warehouse.agg_transport_mensuel` + `warehouse.agg_demande_transport` (materialized views) + `warehouse.fact_transport` for delay distribution.

| Method | Path | Params | Description |
|---|---|---|---|
| GET | `/api/analytics/transport/summary/` | `year`, `month`, `service_type`, `company_id` | KPI cards + MoM deltas |
| GET | `/api/analytics/transport/trends/` | `service_type`, `from_year_month`, `to_year_month` | Monthly time-series (volume, revenue, margin, on-time) |
| GET | `/api/analytics/transport/cost-breakdown/` | `year`, `month`, `service_type` | Cost component shares (6 buckets) |
| GET | `/api/analytics/transport/by-service/` | `year`, `month` | Volume/margin/performance per service type |
| GET | `/api/analytics/transport/by-vehicle/` | `year`, `month` | Cost/km and on-time per vehicle type |
| GET | `/api/analytics/transport/corridors/` | `year`, `month`, `limit`, `sort_by` | Top OD corridors ranked by chosen metric |
| GET | `/api/analytics/transport/od-matrix/` | `year`, `month` | 3×3 region-level origin × destination matrix |
| GET | `/api/analytics/transport/by-agency/` | `year`, `month`, `region`, `service_type` | Agency performance ranking |
| GET | `/api/analytics/transport/delay-distribution/` | `year`, `month`, `service_type` | Arrival-delay histogram (5 buckets) |

All views return **503** on warehouse DB failure (frontend falls back to mock data automatically).

Query functions live in `apps/analytics/queries/transport.py`. Views in `apps/analytics/views.py`.

## Full documentation

See [docs/backend-doc.md](../../docs/backend-doc.md).
