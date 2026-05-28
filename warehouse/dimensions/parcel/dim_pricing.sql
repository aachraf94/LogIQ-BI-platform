-- =============================================================================
-- DIMENSION: dim_pricing
-- Grain     : One row per (service_type × wilaya × valid_from) combination (~290 rows)
-- Source    : stg_yalidine_pricing — reloaded each ETL run
-- ETL       : Full reload (DELETE + INSERT) or INSERT ... ON CONFLICT DO UPDATE
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_pricing (
    pricing_key             SERIAL        PRIMARY KEY,  -- no single stable natural key
    service_type_id         SMALLINT      NOT NULL REFERENCES warehouse.dim_pricing_service_type(pricing_service_type_id),
    wilaya_id               SMALLINT      NOT NULL REFERENCES warehouse.dim_wilaya(wilaya_id),
    tarif_hd                DECIMAL(10,2) NOT NULL,
    tarif_sd                DECIMAL(10,2) NOT NULL,     -- always < tarif_hd
    valid_from_id           DATE          NOT NULL REFERENCES warehouse.dim_date(date_id),
    is_active               BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_pricing UNIQUE (service_type_id, wilaya_id, valid_from_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_pricing_wilaya       ON warehouse.dim_pricing (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_dim_pricing_service_type ON warehouse.dim_pricing (service_type_id);
CREATE INDEX IF NOT EXISTS idx_dim_pricing_active       ON warehouse.dim_pricing (is_active) WHERE is_active = TRUE;
