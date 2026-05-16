-- =============================================================================
-- STAGING: stg_cashbox_paiements_livreurs
-- Source : Cash Box — GET /cashbox/paiements-livreurs
-- Grain  : One row per bi-monthly payment per freelance driver
-- Notes  : Freelance driver IDs (FR-XXXXXX) are a completely separate namespace
--          from HRFORCE user IDs. Two payments per driver per month (1st–15th
--          and 16th–end). All remuneration math must balance exactly:
--          total_net = total_brut - deductions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_paiements_livreurs (
    stg_id                      BIGSERIAL       PRIMARY KEY,

    paiement_id                 VARCHAR(50)     NOT NULL UNIQUE,    -- PAY-LIV-{YYYY}-{MM}-{NNNNNN}
    date_paiement               DATE            NOT NULL,
    period_from                 DATE            NOT NULL,
    period_to                   DATE            NOT NULL,
    created_at_src              TIMESTAMP       NOT NULL,

    -- Flattened agence
    agence_id                   INTEGER         NOT NULL,
    agence_name                 VARCHAR(200)    NOT NULL,
    agence_wilaya_id            SMALLINT        NOT NULL,

    -- Flattened caisse
    caisse_id                   INTEGER         NOT NULL,
    caisse_name                 VARCHAR(150)    NOT NULL,

    -- Flattened livreur
    livreur_id                  VARCHAR(20)     NOT NULL,           -- FR-NNNNNN — not an HRFORCE ID
    livreur_nom                 VARCHAR(100)    NOT NULL,
    livreur_prenom              VARCHAR(100)    NOT NULL,
    livreur_phone               VARCHAR(20),
    livreur_vehicule_type       VARCHAR(20)     NOT NULL,           -- moto, voiture, camionnette

    -- Activity measures
    nbr_colis_livres            INTEGER         NOT NULL,
    nbr_colis_echoues           INTEGER         NOT NULL,
    nbr_jours_travailles        INTEGER         NOT NULL,
    nbr_tournees                INTEGER         NOT NULL,
    zones_couvertes             JSONB,                              -- array of commune code strings

    -- Remuneration measures (DZD)
    tarif_par_colis             NUMERIC(15,2)   NOT NULL,
    tarif_par_colis_echoue      NUMERIC(15,2)   NOT NULL,
    montant_colis_livres        NUMERIC(15,2)   NOT NULL,           -- = nbr_colis_livres × tarif_par_colis
    montant_colis_echoues       NUMERIC(15,2)   NOT NULL,           -- = nbr_colis_echoues × tarif_par_colis_echoue
    prime_rendement             NUMERIC(15,2),
    deductions                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    total_brut                  NUMERIC(15,2)   NOT NULL,
    total_net                   NUMERIC(15,2)   NOT NULL,           -- = total_brut - deductions

    -- Flattened BRQ
    brq_id                      VARCHAR(50),
    validated_by_user_id        INTEGER,                            -- FK → hrforce.users.id
    validated_by_name           VARCHAR(150),

    mode_paiement               VARCHAR(20)     NOT NULL,           -- espèces, virement

    -- ETL metadata
    loaded_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                    VARCHAR(50),
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_paiements_livreurs IS
    'Staging for bi-monthly freelance driver payments. Two rows per driver per month.';
COMMENT ON COLUMN warehouse.stg_cashbox_paiements_livreurs.livreur_id IS
    'Format FR-NNNNNN. Completely separate from HRFORCE user IDs — never join to stg_hrforce_users.';
COMMENT ON COLUMN warehouse.stg_cashbox_paiements_livreurs.total_net IS
    'Must equal total_brut - deductions exactly (validated in ETL).';

CREATE INDEX IF NOT EXISTS idx_stg_paiements_agence   ON warehouse.stg_cashbox_paiements_livreurs (agence_id);
CREATE INDEX IF NOT EXISTS idx_stg_paiements_livreur  ON warehouse.stg_cashbox_paiements_livreurs (livreur_id);
CREATE INDEX IF NOT EXISTS idx_stg_paiements_date     ON warehouse.stg_cashbox_paiements_livreurs (date_paiement);
CREATE INDEX IF NOT EXISTS idx_stg_paiements_period   ON warehouse.stg_cashbox_paiements_livreurs (period_from, period_to);
