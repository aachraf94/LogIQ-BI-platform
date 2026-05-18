# LOGIQ BI Platform

Full-stack Business Intelligence platform for Yalidine Express. Aggregates operational data from five internal source systems into an analytical data warehouse, then exposes interactive dashboards to operations staff.

## Services

| Service | Technology | Port (local) | Port (Docker host) |
|---|---|---|---|
| platform-db | PostgreSQL 17 | 5433 | 5432 |
| warehouse-db | PostgreSQL 17 | 5433 | 5433 |
| redis | Redis 7 | 6379 | 6379 |
| backend | Django 4.2 + DRF | 8000 | 8000 |
| celery | Celery | — | — |
| dagster | Dagster 1.9+ | 3000 | 3000 |
| frontend | Next.js 14 | 3001 | 3001 |

> Locally, both databases (`logiq_platform` and `logiq_warehouse`) run on one PostgreSQL 17 instance on port 5433.

`mock-datasources` (FastAPI, port **8001**) is deployed separately — it must be running before Dagster ETL executes.

## Quick Start — Docker

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env: set strong passwords and a real SECRET_KEY

# 2. Initialize warehouse schema (first time only)
docker compose up -d platform-db warehouse-db
docker compose exec warehouse-db psql \
  -U logiq_warehouse_user -d logiq_warehouse \
  -f /dev/stdin < warehouse/init.sql

# 3. Start all services
docker compose up --build -d

# 4. Migrate + create superadmin
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py create_superadmin
```

| URL | Service |
|---|---|
| `http://localhost:3001` | Dashboard |
| `http://localhost:8000/api/docs/` | API Swagger |
| `http://localhost:3000` | Dagster ETL UI |

## Quick Start — Local Development

See [docs/run-apps-doc.md](../docs/run-apps-doc.md) for the full step-by-step guide.

## Repository Layout

```
logiq/
├── docker-compose.yml   — all services
├── Makefile             — dev shortcuts (Linux/Mac/Git Bash)
├── .env.example         — environment template (annotated)
├── backend/             — Django 4.2 REST API
├── dagster/             — Dagster 1.9 ETL pipeline
├── frontend/            — Next.js 14 dashboard
└── warehouse/           — PostgreSQL 17 warehouse schema (SQL)
```

## Documentation

| Document | Description |
|---|---|
| [docs/architecture.md](../docs/architecture.md) | System overview, service map, data flow |
| [docs/run-apps-doc.md](../docs/run-apps-doc.md) | Local development setup |
| [docs/deployment.md](../docs/deployment.md) | Docker / VPS deployment |
| [docs/backend-doc.md](../docs/backend-doc.md) | Django API reference |
| [docs/frontend-doc.md](../docs/frontend-doc.md) | Next.js dashboard |
| [docs/etl-dagster-doc.md](../docs/etl-dagster-doc.md) | Dagster ETL pipeline |
| [docs/dw-doc.md](../docs/dw-doc.md) | Data warehouse schema |
| [docs/mock-data-doc.md](../docs/mock-data-doc.md) | Mock datasources |
