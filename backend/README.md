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
| `apps.analytics` | Warehouse read-only query views (in progress) |
| `apps.integrations` | ETL webhook, health check, data freshness |

## Settings

| Module | When used |
|---|---|
| `config.settings.dev` | Local: loads `backend/.env` via python-dotenv |
| `config.settings.prod` | Docker: env injected by compose |

Set via `DJANGO_SETTINGS_MODULE` in `.env`.

## Full documentation

See [docs/backend-doc.md](../../docs/backend-doc.md).
