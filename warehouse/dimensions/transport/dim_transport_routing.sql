-- =============================================================================
-- DIMENSION: dim_transport_routing — Junk Dimension
-- Grain     : One row per distinct routing profile combination (~variable)
-- Source    : stg_transport_requests — distinct (is_night_shift, return_trip,
--             distance_category_id, complexity_category_id) combinations
-- ETL       : distance_category_id computed from distance_real_km ranges;
--             complexity_category_id = multi-stop if nbr_stops_total > 1.
--             INSERT ... ON CONFLICT DO NOTHING.
-- Note      : Numeric measures (distance_real_km, durations) stay in fact_transport_performance.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_routing (
    routing_profile_key    SMALLSERIAL PRIMARY KEY,
    is_night_shift         BOOLEAN     NOT NULL,
    return_trip            BOOLEAN     NOT NULL,
    distance_category_id   SMALLINT    NOT NULL REFERENCES warehouse.dim_distance_category(distance_category_id),
    complexity_category_id SMALLINT    NOT NULL REFERENCES warehouse.dim_complexity_category(complexity_category_id),

    CONSTRAINT uq_routing_profile UNIQUE (is_night_shift, return_trip, distance_category_id, complexity_category_id)
);

