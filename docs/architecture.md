# LOGIQ Architecture

## Overview

LOGIQ follows a modern data platform architecture with three layers:

1. **Ingestion & Orchestration** (Dagster): Extracts data from MySQL, PostgreSQL, and REST APIs. Transforms and loads into the data warehouse on a daily schedule.
2. **API Layer** (Django): Serves aggregated analytics data from the warehouse to the frontend. Handles authentication, alerts, and integration webhooks.
3. **Presentation Layer** (Next.js): Interactive dashboard with ECharts, D3.js visualizations, and React Leaflet maps.

## Data Flow

```
[Yalidine App MySQL] ──┐
[FLEETGO PostgreSQL] ──┼──► [Dagster ETL] ──► [Warehouse PostgreSQL] ──► [Django API] ──► [Next.js]
[Yalidine REST API] ──┘
```

## TODO: Add detailed architecture diagram
