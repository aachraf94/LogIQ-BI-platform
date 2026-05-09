"""
Dagster schedule definitions.

Will define:
- daily_etl_schedule: runs full extract + transform + load pipeline at 02:00 AM daily
- weekly_dim_refresh_schedule: refreshes dimension tables every Sunday at 01:00 AM
- monthly_warehouse_vacuum: runs VACUUM ANALYZE on warehouse tables on the 1st of each month

TODO: Add partitioned schedules for backfilling historical data.
"""

all_schedules = []
