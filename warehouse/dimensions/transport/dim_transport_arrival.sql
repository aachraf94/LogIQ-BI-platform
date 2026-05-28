-- =============================================================================
-- DIMENSION: dim_transport_arrival
-- Grain     : One row per distinct arrival location (separate role-playing table)
-- Source    : stg_transport_requests (arrival_* fields)
-- Geographic navigation:
--   When commune_id is set  → commune_id → dim_commune → dim_wilaya
--   When commune_id is NULL → wilaya_id directly (always populated from source)
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_arrival (
    arrival_key      SERIAL        PRIMARY KEY,
    location_type_id SMALLINT      NOT NULL REFERENCES warehouse.dim_location_type(location_type_id),
    location_name    VARCHAR(200)  NOT NULL,
    address          VARCHAR(300),
    wilaya_id        SMALLINT      NOT NULL REFERENCES warehouse.dim_wilaya(wilaya_id),  -- always set from arrival_wilaya_id
    commune_id       INTEGER       REFERENCES warehouse.dim_commune(commune_id),          -- NULL when commune not specified
    gps_lat          DECIMAL(9,6),
    gps_lng          DECIMAL(9,6)
);

CREATE INDEX IF NOT EXISTS idx_dim_arrival_wilaya  ON warehouse.dim_transport_arrival (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_dim_arrival_commune ON warehouse.dim_transport_arrival (commune_id);
