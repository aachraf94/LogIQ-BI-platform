"""
MySQL extraction assets.

Will extract raw operational data from the Yalidine MySQL source database:
- transport_demands table → raw demand records with client, origin, destination, dates
- vehicle_assignments table → driver and vehicle assignment per demand
- pricing_rules table → tariff rules used to calculate parcel costs

TODO:
- Implement incremental extraction using last-modified timestamps
- Handle connection retries and timeout errors
- Partition by month for historical backfill
"""
