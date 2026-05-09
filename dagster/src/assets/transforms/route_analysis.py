"""
Route analysis transformation assets.

Will compute route-level aggregates and efficiency metrics:
- Actual distance vs OSRM optimized distance
- Actual duration vs theoretical minimum duration
- Cost per km for each origin-destination pair
- Volume trends per route (7-day, 30-day rolling average)
- Efficiency score = (optimized_cost / actual_cost) × 100

Output: staging.stg_routes → ready for fact_route load
"""
