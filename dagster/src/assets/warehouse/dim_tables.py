"""
Dimension table loader assets.

Will perform SCD Type 2 upserts into warehouse dimension tables:
- dim_date: pre-populated calendar table, refreshed annually
- dim_client: client master data from CRM, tracks name/address changes
- dim_site: Algerian city/depot master data with GPS coordinates
- dim_vehicle: vehicle registry with capacity, type, assigned driver

TODO: Implement using SQLAlchemy upsert with conflict resolution
"""
