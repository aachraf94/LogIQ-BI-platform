"""
Parcel cost (CCC — Coût de la Chaîne de Colis) transformation assets.

Will compute the full cost breakdown per parcel:
- Transport cost = distance × cost_per_km (from pricing rules)
- Handling cost = fixed fee per parcel based on weight class
- Storage cost = days_in_depot × daily_storage_rate
- Total CCC = transport + handling + storage + surcharges

Output: staging.stg_parcel_costs → ready for fact_parcel_cost load
"""
