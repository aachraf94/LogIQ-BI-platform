-- =============================================================================
-- STAGING: stg_yalidine_pricing
-- Source : Yalidine App — GET /yalidine/pricing
-- Grain  : One row per (service_type, wilaya_id) pricing entry (~290 rows)
-- Notes  : The "poids" block is a static dict returned by the API but NOT
--          stored as per-wilaya rows — it is appended at API response time
--          and excluded from this staging table (no analytical value in DW).
--          tarif and tarif_stopdesk are strings in the API response.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_yalidine_pricing (
    stg_id              BIGSERIAL       PRIMARY KEY,

    source_id           INTEGER         NOT NULL,                   -- yalidine.pricing.id
    service_type        VARCHAR(30)     NOT NULL,                   -- livraison, pickup, echange, recouvrement, retours
    wilaya_id           SMALLINT        NOT NULL,                   -- destination wilaya 1–58
    tarif               VARCHAR(10)     NOT NULL,                   -- home delivery fee as string (DZD)
    tarif_stopdesk      VARCHAR(10)     NOT NULL,                   -- stop desk fee as string (DZD); always < tarif
    valid_from          DATE            NOT NULL,                   -- 2023-01-01 for all loaded rows
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ETL metadata
    loaded_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id            VARCHAR(50),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (service_type, wilaya_id, valid_from)
);

COMMENT ON TABLE warehouse.stg_yalidine_pricing IS
    'Staging for Yalidine delivery pricing by service type and wilaya. ~290 rows.';
COMMENT ON COLUMN warehouse.stg_yalidine_pricing.tarif IS
    'Returned as a string by the Yalidine API — cast to NUMERIC at dimension load time.';
COMMENT ON COLUMN warehouse.stg_yalidine_pricing.tarif_stopdesk IS
    'Always strictly less than tarif for the same wilaya and service_type.';

CREATE INDEX IF NOT EXISTS idx_stg_pricing_wilaya  ON warehouse.stg_yalidine_pricing (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_stg_pricing_service ON warehouse.stg_yalidine_pricing (service_type);
