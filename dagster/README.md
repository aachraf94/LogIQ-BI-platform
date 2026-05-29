# LOGIQ Dagster ETL Pipeline

Dagster 1.9+ orchestrates the full ETL: extract from five source APIs → staging tables → dimensions → facts → materialized view aggregates.

**Local port:** 3000 (`http://localhost:3000`)

## Setup

```powershell
cd dagster

python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt

cp .env.example .env
# Critical edits:
#   API_BASE_URL=http://localhost:8001   (mock-datasources local port)
#   WAREHOUSE_DB_PORT=5433              (local PostgreSQL port)

dagster dev   # opens http://localhost:3000
```

## Prerequisites

Before materializing assets:
1. **mock-datasources** must be running on port 8001
2. **warehouse schema** must be initialized (`warehouse/init.sql`)

## Jobs

| Job | Description |
|---|---|
| `full_etl_job` | Complete pipeline: staging → dimensions → facts → aggregates |
| `staging_job` | Extract from source APIs only |
| `dimensions_job` | Refresh dimension tables (SCD2 where applicable) |
| `facts_job` | Load fact tables |
| `aggregates_job` | Refresh all 8 materialized views |

## Schedules

| Schedule | Time (Algeria UTC+1) | Job |
|---|---|---|
| `daily_etl_schedule` | 02:00 every day | `full_etl_job` |
| `weekly_dim_refresh_schedule` | 01:00 every Sunday | `dimensions_job` |

## Asset Groups

| Group | Count | Description |
|---|---|---|
| `staging` | 18 assets | Raw API data → staging tables |
| `dimensions` | 28 assets | Staging → dimension tables (SCD2 for agence + employee) |
| `facts` | 7 assets | Staging + dims → fact tables |
| `aggregates` | 8 assets | REFRESH MATERIALIZED VIEW CONCURRENTLY |

## Full documentation

See [docs/etl-dagster-doc.md](../../docs/etl-dagster-doc.md).
