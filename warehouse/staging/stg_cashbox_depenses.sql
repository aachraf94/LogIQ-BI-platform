-- =============================================================================
-- STAGING: stg_cashbox_depenses
-- Source : Cash Box — GET /cashbox/depenses
-- Grain  : One row per expense record (~50 × 284 agencies × 36 months ≈ ~500K rows)
-- Notes  : Nested entreprise, agence, caisse, nature, rubrique, brq objects
--          are flattened. Fund transfers are a separate endpoint and must NOT
--          be confused with expenses.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_depenses (
    stg_id                  BIGSERIAL       PRIMARY KEY,

    depense_id              VARCHAR(50)     NOT NULL UNIQUE,        -- DEP-{YYYY}-{MM}-{NNNNNN}
    created_at_src          TIMESTAMP       NOT NULL,               -- source created_at
    date_depense            DATE            NOT NULL,
    status                  VARCHAR(20)     NOT NULL,               -- en_attente, validée, rejetée
    validated_at            TIMESTAMP,                              -- null when not validée

    -- Flattened entreprise
    entreprise_id           INTEGER         NOT NULL,
    entreprise_name         VARCHAR(100)    NOT NULL,

    -- Flattened agence
    agence_id               INTEGER         NOT NULL,
    agence_name             VARCHAR(200)    NOT NULL,
    agence_code             VARCHAR(30)     NOT NULL,

    -- Flattened caisse
    caisse_id               INTEGER         NOT NULL,
    caisse_name             VARCHAR(150)    NOT NULL,
    caisse_type             VARCHAR(50)     NOT NULL,               -- Petite caisse, Caisse principale
    caisse_wilaya_id        SMALLINT        NOT NULL,
    caisse_commune_id       INTEGER,

    -- Flattened nature
    nature_id               INTEGER         NOT NULL,
    nature_name             VARCHAR(100)    NOT NULL,
    category_group          VARCHAR(50)     NOT NULL,               -- Exploitation, Maintenance parc, etc.

    -- Flattened rubrique (nullable — some expenses have no rubrique)
    rubrique_id             INTEGER,
    rubrique_name           VARCHAR(150),

    -- Flattened BRQ (bon de requête)
    brq_id                  VARCHAR(50),
    requested_by_user_id    INTEGER,                                -- FK → hrforce.users.id
    requested_by_name       VARCHAR(150),
    validated_by_user_id    INTEGER,                                -- FK → hrforce.users.id
    validated_by_name       VARCHAR(150),

    -- Measures
    montant                 NUMERIC(15,2)   NOT NULL,               -- DZD
    quantite                NUMERIC(10,3),
    unite                   VARCHAR(30),                            -- litres, unités, km, etc.

    -- Metadata
    description             TEXT,
    justificatif            VARCHAR(100),
    mode_paiement           VARCHAR(20)     NOT NULL,               -- espèces, virement, chèque
    currency                VARCHAR(3)      NOT NULL DEFAULT 'DZD',

    -- ETL metadata
    loaded_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                VARCHAR(50),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_depenses IS
    'Staging for Cash Box expense records. ~500K rows at full scale.';
COMMENT ON COLUMN warehouse.stg_cashbox_depenses.status IS
    'Workflow: en_attente → validée (terminal) or en_attente → rejetée (terminal).';
COMMENT ON COLUMN warehouse.stg_cashbox_depenses.caisse_type IS
    'Each agency has exactly one Petite caisse and optionally one Caisse principale.';

CREATE INDEX IF NOT EXISTS idx_stg_dep_date_depense  ON warehouse.stg_cashbox_depenses (date_depense);
CREATE INDEX IF NOT EXISTS idx_stg_dep_agence        ON warehouse.stg_cashbox_depenses (agence_id);
CREATE INDEX IF NOT EXISTS idx_stg_dep_status        ON warehouse.stg_cashbox_depenses (status);
CREATE INDEX IF NOT EXISTS idx_stg_dep_nature        ON warehouse.stg_cashbox_depenses (nature_id);
CREATE INDEX IF NOT EXISTS idx_stg_dep_entreprise    ON warehouse.stg_cashbox_depenses (entreprise_id);
