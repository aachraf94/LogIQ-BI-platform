# LOGIQ — Business Intelligence Platform for Logistics

LOGIQ is a Business Intelligence platform built for **Yalidine El Djazair Service**, a logistics and delivery company in Algeria. It centralizes operational data from multiple sources into interactive dashboards, proactive cost alerts, and decision-support analytics.

## Tech Stack

| Layer | Technology |
|---|---|
| ETL / Orchestration | Dagster |
| Backend API | Django + Django REST Framework |
| Task Queue | Celery + Redis |
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI Library | Tremor + Tailwind CSS |
| Charts | ECharts + D3.js |
| Maps | React Leaflet |
| State | Zustand |
| Data Warehouse | PostgreSQL (star schema) |
| Platform DB | PostgreSQL |
| Containerization | Docker + Docker Compose |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15 (for local dev without Docker)
- Redis (for local dev without Docker)

## Local Setup

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd logiq
cp .env.example .env
# Edit .env with your local database credentials
```

### 2. Setup Dagster

```bash
make setup-dagster
make dagster
# Dagster UI available at http://localhost:3000
```

### 3. Setup Django backend

```bash
make setup-backend
cd backend
. venv/bin/activate
python manage.py migrate
python manage.py runserver
# API available at http://localhost:8000/api
```

### 4. Setup frontend

```bash
make setup-frontend
make frontend
# App available at http://localhost:3001
```

Or run everything at once:

```bash
make setup
```

## Project Structure

```
logiq/
├── dagster/        # ETL pipelines & orchestration
├── backend/        # Django REST API
├── frontend/       # Next.js dashboard
├── warehouse/      # Data warehouse SQL schemas
└── docs/           # Architecture & API documentation
```

## Deployment

Build and start all services with Docker Compose:

```bash
cp .env.example .env
# Fill in production values
make deploy
```

Services will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8000/api
- Dagster UI: http://localhost:3000

To stop:
```bash
make deploy-down
```
