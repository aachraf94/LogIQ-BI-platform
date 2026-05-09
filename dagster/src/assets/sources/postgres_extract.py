"""
PostgreSQL extraction assets.

Will extract data from secondary operational PostgreSQL databases:
- FLEETGO fleet management system → vehicle GPS positions, fuel consumption, maintenance
- ITOP IT operations tool → incident and downtime records affecting deliveries

TODO:
- Implement CDC (Change Data Capture) using logical replication slots
- Define asset partitions aligned with FLEETGO reporting periods
"""
