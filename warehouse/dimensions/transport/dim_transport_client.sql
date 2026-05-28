-- =============================================================================
-- DIMENSION: dim_transport_client
-- Grain     : One row per transport client
-- Source    : stg_transport_requests (DISTINCT client_id fields)
-- ETL       : INSERT ... ON CONFLICT (client_id) DO UPDATE SET client_name, client_type_id, contact fields, client_company_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_client (
    client_id          INTEGER       PRIMARY KEY,
    client_name        VARCHAR(200)  NOT NULL,
    client_type_id     SMALLINT      NOT NULL REFERENCES warehouse.dim_client_type(client_type_id),
    contact_phone      VARCHAR(20),
    contact_email      VARCHAR(150),
    client_company_id  INTEGER       REFERENCES warehouse.dim_transport_client_company(client_company_id)  -- NULL for divers
);

CREATE INDEX IF NOT EXISTS idx_dim_transport_client_type    ON warehouse.dim_transport_client (client_type_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_client_company ON warehouse.dim_transport_client (client_company_id);
