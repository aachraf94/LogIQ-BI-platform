# Deployment Guide

## Prerequisites
- Docker 24+
- Docker Compose v2
- A server with at least 4GB RAM

## Steps

1. Clone the repository and copy environment config:
   ```bash
   git clone <repo-url> && cd logiq
   cp .env.example .env
   # Edit .env with production credentials
   ```

2. Build and start all services:
   ```bash
   docker-compose up --build -d
   ```

3. Run Django migrations:
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py migrate --database=warehouse
   ```

4. Create superuser:
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

## Services
| Service | Port |
|---|---|
| Frontend | 3001 |
| Backend API | 8000 |
| Dagster UI | 3000 |
| Platform DB | 5432 |
| Warehouse DB | 5433 |
| Redis | 6379 |
