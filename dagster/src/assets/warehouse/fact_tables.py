"""
Fact table loader assets.

Will insert processed records from staging into the warehouse fact tables:
- fact_transport_demand: one row per transport demand event
- fact_parcel_cost: one row per parcel with full cost breakdown
- fact_route: one row per route execution with performance metrics

Strategy: incremental append for fact tables, partitioned by month.
Deduplication key: source_system + source_id to prevent double-loading.
"""
