"""
Transport demand transformation assets.

Will clean and enrich raw transport demand records:
- Normalize city names to match dim_site dimension
- Classify demand type (standard, express, bulk)
- Calculate cost fields using pricing rules
- Derive demand_month, demand_week partition keys
- Flag anomalous records (cost > 3σ, missing fields)

Output: staging.stg_transport_demands → ready for fact_transport_demand load
"""
