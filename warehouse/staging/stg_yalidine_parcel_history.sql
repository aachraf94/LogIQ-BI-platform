-- =============================================================================
-- STAGING: stg_yalidine_parcel_history
-- Source : Yalidine App — GET /yalidine/histories
-- Grain  : One row per parcel history event (~27 million rows)
-- Notes  : Largest table in the system. Mirrors yalidine.parcel_history exactly.
--          loaded_at tracks ETL batch ingestion time.
--          is_processed flags rows not yet promoted to fact_livraisons.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_yalidine_parcel_history (
    stg_id                      BIGSERIAL       PRIMARY KEY,

    -- Source natural key
    source_id                   BIGINT          NOT NULL,           -- yalidine.parcel_history.id
    date_statut                 TIMESTAMP       NOT NULL,           -- event timestamp (UTC)
    tracking                    VARCHAR(20)     NOT NULL,           -- yal-XXXXXX or sac-XXXXXX
    statut                      VARCHAR(50)     NOT NULL,           -- status at this event
    current_status              VARCHAR(50)     NOT NULL,           -- final resolved status of the parcel

    -- Location
    hub_id                      INTEGER,                            -- FK → yalidine.centers; null in early statuses
    hub_name                    VARCHAR(200),

    -- Seller / origin
    seller_id                   INTEGER,
    seller_company_id           INTEGER,
    seller_company_name         VARCHAR(150),
    store_name                  VARCHAR(200),
    depart_wilaya_id            SMALLINT,

    -- Acting employee
    whois                       INTEGER         NOT NULL,           -- FK → hrforce.users.id
    whois_company_id            INTEGER,
    whois_company_name          VARCHAR(150),
    forced                      SMALLINT,
    forced_by                   INTEGER,                            -- FK → hrforce.users.id

    -- Recipient (denormalized, not used for DW joins)
    firstname                   VARCHAR(200),
    familyname                  VARCHAR(200),

    -- Destination (null before routing)
    destination_commune_id      INTEGER,
    destination_wilaya_id       SMALLINT,
    destination_hub_id          INTEGER,

    -- Delivery details
    delivery_type               VARCHAR(2)      NOT NULL,           -- HD or SD
    zone                        SMALLINT,                           -- pricing zone 0–4+
    delivery_fee                NUMERIC(15,2),                      -- DZD; null before Centre status

    -- Parcel classification
    parcel_type                 VARCHAR(30),                        -- ecommerce, internal
    parcel_sub_type             VARCHAR(30),

    -- Event metadata
    reason                      VARCHAR(300),
    note                        TEXT,

    -- Legacy fields (always null in mock — kept for schema fidelity)
    last_hub_wilaya_todelete    INTEGER,
    last_hub_commune_todelete   INTEGER,

    -- ETL metadata
    loaded_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                    VARCHAR(50),                        -- ETL batch identifier
    is_processed                BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_yalidine_parcel_history IS
    'Staging for Yalidine parcel history events. One row per event. ~27M rows at full scale.';
COMMENT ON COLUMN warehouse.stg_yalidine_parcel_history.source_id IS
    'Original event ID from yalidine.parcel_history.id — not reused as DW key.';
COMMENT ON COLUMN warehouse.stg_yalidine_parcel_history.current_status IS
    'Final resolved status of the parcel — same for ALL events of the same tracking number.';
COMMENT ON COLUMN warehouse.stg_yalidine_parcel_history.zone IS
    'Pricing zone: 0 = same wilaya, 1–4 = increasing inter-wilaya distance.';
COMMENT ON COLUMN warehouse.stg_yalidine_parcel_history.is_processed IS
    'Set to TRUE after this row has been promoted to fact_livraisons.';

-- Indexes for ETL joins and filtering
CREATE INDEX IF NOT EXISTS idx_stg_ph_tracking       ON warehouse.stg_yalidine_parcel_history (tracking);
CREATE INDEX IF NOT EXISTS idx_stg_ph_date_statut    ON warehouse.stg_yalidine_parcel_history (date_statut);
CREATE INDEX IF NOT EXISTS idx_stg_ph_hub_id         ON warehouse.stg_yalidine_parcel_history (hub_id);
CREATE INDEX IF NOT EXISTS idx_stg_ph_whois          ON warehouse.stg_yalidine_parcel_history (whois);
CREATE INDEX IF NOT EXISTS idx_stg_ph_statut         ON warehouse.stg_yalidine_parcel_history (statut);
CREATE INDEX IF NOT EXISTS idx_stg_ph_is_processed   ON warehouse.stg_yalidine_parcel_history (is_processed) WHERE is_processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_stg_ph_source_id      ON warehouse.stg_yalidine_parcel_history (source_id);
