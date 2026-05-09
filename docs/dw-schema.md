# Data Warehouse Schema

LOGIQ uses a **star schema** in PostgreSQL optimized for analytical queries.

## Dimensions
- `dim_date` — calendar dimension
- `dim_client` — client master (SCD Type 2)
- `dim_site` — Algerian city/depot master
- `dim_vehicle` — vehicle/fleet registry

## Facts
- `fact_transport_demand` — one row per demand, grain: demand event
- `fact_parcel_cost` — one row per parcel, grain: parcel lifecycle
- `fact_route` — one row per trip, grain: vehicle route execution

## TODO: Add ERD diagram and column-level documentation
