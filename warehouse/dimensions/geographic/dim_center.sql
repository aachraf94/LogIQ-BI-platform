-- =============================================================================
-- DIMENSION: dim_center
-- Grain     : One row per Yalidine operational center (253 rows)
-- Source    : stg_yalidine_centers joined to dim_agence via code_yal
-- ETL       : ETL resolves agence_key by casting code_yal to INTEGER and
--             joining to the current SCD2 version of dim_agence.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_center (
    center_id          INTEGER       PRIMARY KEY,  -- Yalidine hub_id — natural key
    code               VARCHAR(10)   NOT NULL,     -- e.g. HUS1
    name               VARCHAR(200)  NOT NULL,
    service_stopdesk   BOOLEAN       NOT NULL,
    service_depot_colis BOOLEAN      NOT NULL,
    gps_lat            DECIMAL(9,6),               -- split from source "lat,lng" string
    gps_lng            DECIMAL(9,6),
    address            VARCHAR(300),
    agence_key         INTEGER       REFERENCES warehouse.dim_agence(agence_key)  -- current SCD2 version
);

-- No company_id — navigate via dim_center → dim_agence → dim_company.
CREATE INDEX IF NOT EXISTS idx_dim_center_agence ON warehouse.dim_center (agence_key);
