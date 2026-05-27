-- =============================================================================
-- STAGING: stg_cashbox_transferts
-- Source : Cash Box — GET /cashbox/transferts
-- Grain  : One row per internal fund transfer (~2–3 per agency per month)
-- CRITICAL: Fund transfers represent internal cash movements between cash boxes.
--           They are NOT expenses and must NEVER be included in cost calculations
--           or mixed with stg_cashbox_depenses in any aggregate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_transferts (
    stg_id                  BIGSERIAL       PRIMARY KEY,

    transfert_id            VARCHAR(50)     NOT NULL UNIQUE,        -- TRF-{YYYY}-{MM}-{NNNNNN}
    date_transfert          DATE            NOT NULL,

    -- Measure (DZD)
    montant                 NUMERIC(15,2)   NOT NULL,

    motif                   TEXT,

    -- Source cash box
    caisse_source_id        INTEGER         NOT NULL,
    caisse_source_name      VARCHAR(150)    NOT NULL,
    agence_source_id        INTEGER         NOT NULL,               -- FK → hrforce.agencies.id
    agence_source_name      VARCHAR(200)    NOT NULL,

    -- Destination cash box
    caisse_dest_id          INTEGER         NOT NULL,
    caisse_dest_name        VARCHAR(150)    NOT NULL,
    agence_dest_id          INTEGER         NOT NULL,               -- FK → hrforce.agencies.id
    agence_dest_name        VARCHAR(200)    NOT NULL,

    -- Bank details (null for direct cash handover — 40% of transfers)
    banque_id               INTEGER,
    banque_name             VARCHAR(100),                           -- BNA, CPA, BEA, BDL, BADR
    reference_virement      VARCHAR(100),

    -- BRQ
    brq_id                  VARCHAR(50),
    validated_by_user_id    INTEGER,                                -- FK → hrforce.users.id
    currency                VARCHAR(3)      NOT NULL DEFAULT 'DZD',

    -- ETL metadata
    loaded_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                VARCHAR(50),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_transferts IS
    'Staging for internal fund transfers between cash boxes. NOT expenses — never include in cost KPIs.';
COMMENT ON COLUMN warehouse.stg_cashbox_transferts.banque_id IS
    'NULL for approximately 40% of transfers (direct cash handover without bank intermediary).';

CREATE INDEX IF NOT EXISTS idx_stg_trf_date         ON warehouse.stg_cashbox_transferts (date_transfert);
CREATE INDEX IF NOT EXISTS idx_stg_trf_source       ON warehouse.stg_cashbox_transferts (agence_source_id);
CREATE INDEX IF NOT EXISTS idx_stg_trf_dest         ON warehouse.stg_cashbox_transferts (agence_dest_id);
