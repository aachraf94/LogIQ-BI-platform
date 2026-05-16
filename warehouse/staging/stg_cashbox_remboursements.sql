-- =============================================================================
-- STAGING: stg_cashbox_remboursements
-- Source : Cash Box — GET /cashbox/remboursements
-- Grain  : One row per parcel reimbursement (~3–5 per agency per month)
-- Notes  : colis_tracking references a real parcel in parcel_history whose
--          current_status indicates failure or loss. montant_rembourse must
--          be between 50% and 100% of declared_value.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_remboursements (
    stg_id                          BIGSERIAL       PRIMARY KEY,

    remboursement_id                VARCHAR(50)     NOT NULL UNIQUE,  -- RMB-{YYYY}-{MM}-{NNNNNN}
    date_remboursement              DATE            NOT NULL,
    created_at_src                  TIMESTAMP       NOT NULL,

    -- Responsible agency
    agence_responsable_id           INTEGER         NOT NULL,
    agence_responsable_name         VARCHAR(200)    NOT NULL,
    agence_wilaya_id                SMALLINT        NOT NULL,

    -- Parcel reference
    colis_tracking                  VARCHAR(20)     NOT NULL,         -- FK → yalidine.parcel_history.tracking
    colis_current_status            VARCHAR(50)     NOT NULL,         -- Perdu, Endommagé
    sinistre_type                   VARCHAR(20)     NOT NULL,         -- perdu, endommagé, vol
    declared_value                  NUMERIC(15,2),                    -- DZD
    parcel_type                     VARCHAR(30),

    -- Client info (denormalized)
    seller_id                       INTEGER,
    store_name                      VARCHAR(200),
    delivery_type                   VARCHAR(2),                       -- HD, SD

    -- Measures (DZD)
    montant_rembourse               NUMERIC(15,2)   NOT NULL,

    -- Metadata
    motif                           TEXT,
    justificatif                    VARCHAR(100),

    -- Flattened BRQ
    brq_id                          VARCHAR(50),
    validated_by_user_id            INTEGER,
    validated_by_name               VARCHAR(150),

    -- Caisse
    caisse_id                       INTEGER         NOT NULL,
    caisse_name                     VARCHAR(150)    NOT NULL,

    mode_paiement                   VARCHAR(20)     NOT NULL,         -- espèces, virement, chèque

    -- ETL metadata
    loaded_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                        VARCHAR(50),
    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_remboursements IS
    'Staging for parcel reimbursements. Each row references a failed/lost parcel.';
COMMENT ON COLUMN warehouse.stg_cashbox_remboursements.colis_tracking IS
    'Cross-source reference to stg_yalidine_parcel_history.tracking. Validated by ETL.';
COMMENT ON COLUMN warehouse.stg_cashbox_remboursements.montant_rembourse IS
    'Must be between 50% and 100% of declared_value per business rules.';

CREATE INDEX IF NOT EXISTS idx_stg_rmb_agence   ON warehouse.stg_cashbox_remboursements (agence_responsable_id);
CREATE INDEX IF NOT EXISTS idx_stg_rmb_date     ON warehouse.stg_cashbox_remboursements (date_remboursement);
CREATE INDEX IF NOT EXISTS idx_stg_rmb_tracking ON warehouse.stg_cashbox_remboursements (colis_tracking);
CREATE INDEX IF NOT EXISTS idx_stg_rmb_sinistre ON warehouse.stg_cashbox_remboursements (sinistre_type);
