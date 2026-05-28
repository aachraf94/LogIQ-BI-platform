-- =============================================================================
-- FACT: fact_transport_performance
-- Grain     : One row per transport request (1:1 with dim_transport)
-- PK        : transport_key
-- Source    : stg_transport_requests (routing, timing, rating fields)
-- Note      : date_completion_id NULL for non-terminée requests.
--             on_time NULL for non-terminée requests.
--             vehicle_departure_dt / vehicle_return_dt stored here (not in dim)
--             because they are operational timestamps, not dimensional attributes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_transport_performance (
    transport_key              INTEGER       PRIMARY KEY REFERENCES warehouse.dim_transport(transport_key),
    date_completion_id         DATE          REFERENCES warehouse.dim_date(date_id),   -- NULL if not terminée
    distance_unit_km           DECIMAL(8,2)  NOT NULL,   -- base km in flat rate
    distance_real_km           DECIMAL(8,2)  NOT NULL,   -- actual trip distance
    distance_extra_km          DECIMAL(8,2)  NOT NULL,   -- = distance_real_km − distance_unit_km
    total_vehicle_km           DECIMAL(8,2),             -- full km including depot legs
    total_duration_minutes     INTEGER,
    total_waiting_time_minutes INTEGER,
    nbr_stops_pickup           SMALLINT      NOT NULL,
    nbr_stops_delivery         SMALLINT      NOT NULL,
    nbr_stops_total            SMALLINT      NOT NULL,
    nbr_floors                 SMALLINT      NOT NULL DEFAULT 0,
    night_shift_hours          SMALLINT,                 -- NULL if not night shift
    vehicle_departure_dt       TIMESTAMP,
    vehicle_return_dt          TIMESTAMP,
    departure_delay_minutes    INTEGER,
    arrival_delay_minutes      INTEGER,
    on_time                    BOOLEAN,                  -- NULL for non-terminée
    client_rating              SMALLINT                  -- 1–5, nullable
);

CREATE INDEX IF NOT EXISTS idx_fact_tp_date_completion ON warehouse.fact_transport_performance (date_completion_id);
CREATE INDEX IF NOT EXISTS idx_fact_tp_on_time         ON warehouse.fact_transport_performance (on_time) WHERE on_time IS NOT NULL;
