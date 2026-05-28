-- =============================================================================
-- DIMENSION: dim_transport_stops
-- Grain     : One row per stop within a transport request
-- Source    : stg_transport_stops
-- Dependency: dim_transport (transport_key FK) — dim_transport must be loaded first.
-- Geographic navigation:
--   When commune_id is set  → commune_id → dim_commune → dim_wilaya
--   When commune_id is NULL → wilaya_id directly (always populated from source)
-- Note      : request_id kept as degenerate dimension for traceability only.
--             Use transport_key for all joins to transport facts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_stops (
    stop_key         SERIAL        PRIMARY KEY,
    stop_id          VARCHAR(70)   UNIQUE NOT NULL,   -- ST-{request_id}-{NNN}
    transport_key    INTEGER       NOT NULL REFERENCES warehouse.dim_transport(transport_key),
    request_id       VARCHAR(50)   NOT NULL,           -- degenerate — kept for traceability only
    stop_order       SMALLINT      NOT NULL,           -- sequential from 1
    stop_type_id     SMALLINT      NOT NULL REFERENCES warehouse.dim_stop_type(stop_type_id),
    location_type_id SMALLINT      NOT NULL REFERENCES warehouse.dim_location_type(location_type_id),
    location_name    VARCHAR(200)  NOT NULL,
    address          VARCHAR(300),
    wilaya_id        SMALLINT      NOT NULL REFERENCES warehouse.dim_wilaya(wilaya_id),  -- always set from wilaya_id in source
    commune_id       INTEGER       REFERENCES warehouse.dim_commune(commune_id),          -- NULL when commune not in source
    gps_lat          DECIMAL(9,6),
    gps_lng          DECIMAL(9,6)
);

CREATE INDEX IF NOT EXISTS idx_dim_stops_transport  ON warehouse.dim_transport_stops (transport_key);
CREATE INDEX IF NOT EXISTS idx_dim_stops_wilaya     ON warehouse.dim_transport_stops (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_dim_stops_stop_type  ON warehouse.dim_transport_stops (stop_type_id);
