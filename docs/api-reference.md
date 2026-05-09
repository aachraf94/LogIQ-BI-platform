# LOGIQ API Reference

Base URL: `http://localhost:8000/api`

## Authentication
- `POST /users/login/` — returns JWT tokens
- `POST /users/logout/` — invalidates refresh token
- `GET /users/me/` — current user profile

## Analytics
- `GET /analytics/kpis/` — KPI summary for current period
- `GET /analytics/transport/trends/` — monthly transport trends
- `GET /analytics/costs/breakdown/` — parcel cost breakdown over time
- `GET /analytics/routes/` — route performance data

## Notifications
- `GET /notifications/alerts/` — list active alerts
- `PATCH /notifications/alerts/<id>/` — resolve an alert
- `GET/PUT /notifications/preferences/` — notification channel settings

## TODO: Document request/response schemas for each endpoint
