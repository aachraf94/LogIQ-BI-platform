from dagster import (
    ScheduleDefinition,
    AssetSelection,
    define_asset_job,
)

# --- Jobs ---

staging_job = define_asset_job(
    name="staging_job",
    selection=AssetSelection.groups("staging"),
    description="Extract all source data into staging tables.",
)

dimensions_job = define_asset_job(
    name="dimensions_job",
    selection=AssetSelection.groups("dimensions"),
    description="Load/refresh all dimension tables (SCD2 where applicable).",
)

facts_job = define_asset_job(
    name="facts_job",
    selection=AssetSelection.groups("facts"),
    description="Load all fact tables from staging.",
)

aggregates_job = define_asset_job(
    name="aggregates_job",
    selection=AssetSelection.groups("aggregates"),
    description="REFRESH CONCURRENTLY all materialized view aggregates.",
)

full_etl_job = define_asset_job(
    name="full_etl_job",
    selection=AssetSelection.groups("staging", "dimensions", "facts", "aggregates"),
    description="Full nightly ETL: staging → dimensions → facts → aggregates.",
)

# --- Schedules ---

# Nightly full pipeline at 02:00 AM Algeria time (UTC+1 → cron in UTC = 01:00)
daily_etl_schedule = ScheduleDefinition(
    name="daily_etl_schedule",
    cron_schedule="0 1 * * *",
    job=full_etl_job,
    description="Full ETL pipeline — runs every day at 02:00 AM (Algeria/UTC+1).",
)

# Weekly dimension refresh every Sunday at 01:00 AM Algeria time (UTC = 00:00)
weekly_dim_refresh_schedule = ScheduleDefinition(
    name="weekly_dim_refresh_schedule",
    cron_schedule="0 0 * * 0",
    job=dimensions_job,
    description="Dimension-only refresh — every Sunday at 01:00 AM (Algeria/UTC+1).",
)

all_schedules = [
    daily_etl_schedule,
    weekly_dim_refresh_schedule,
]
