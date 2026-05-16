-- =============================================================================
-- FACT: fact_paiements_livreurs
-- Grain  : One row per bi-monthly payment period per freelance driver
-- Source : stg_cashbox_paiements_livreurs
-- Notes  : Two rows per driver per month (1st–15th and 16th–last day).
--          All remuneration math must hold: total_net = total_brut - deductions.
--          This is a separate cost stream from employee payroll (fact_bulletins).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_paiements_livreurs (
    paiement_key                BIGSERIAL       PRIMARY KEY,

    -- Date dimension keys
    date_paiement_key           INTEGER         NOT NULL
                                REFERENCES warehouse.dim_date (date_key),
    date_debut_periode_key      INTEGER         NOT NULL            -- period_from
                                REFERENCES warehouse.dim_date (date_key),
    date_fin_periode_key        INTEGER         NOT NULL            -- period_to
                                REFERENCES warehouse.dim_date (date_key),

    -- Dimension keys
    agence_key                  BIGINT          NOT NULL
                                REFERENCES warehouse.dim_agence (agence_key),
    driver_key                  INTEGER         NOT NULL
                                REFERENCES warehouse.dim_freelance_driver (driver_key),
    employee_validator_key      BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),

    -- Degenerate dimensions
    paiement_id                 VARCHAR(50)     NOT NULL UNIQUE,    -- PAY-LIV-{YYYY}-{MM}-{NNNNNN}
    mode_paiement               VARCHAR(20)     NOT NULL
                                CHECK (mode_paiement IN ('espèces', 'virement')),

    -- Activity measures (counts)
    nbr_colis_livres            INTEGER         NOT NULL,           -- parcels successfully delivered
    nbr_colis_echoues           INTEGER         NOT NULL,           -- failed delivery attempts
    nbr_jours_travailles        INTEGER         NOT NULL,
    nbr_tournees                INTEGER         NOT NULL,

    -- Remuneration measures (DZD)
    tarif_par_colis             NUMERIC(15,2)   NOT NULL,           -- rate per delivered parcel
    tarif_par_colis_echoue      NUMERIC(15,2)   NOT NULL,           -- rate per failed attempt (< tarif_par_colis)
    montant_colis_livres        NUMERIC(15,2)   NOT NULL,           -- = nbr_colis_livres × tarif_par_colis
    montant_colis_echoues       NUMERIC(15,2)   NOT NULL,           -- = nbr_colis_echoues × tarif_par_colis_echoue
    prime_rendement             NUMERIC(15,2),                      -- performance bonus
    deductions                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    total_brut                  NUMERIC(15,2)   NOT NULL,           -- montant_livres + montant_echoues + prime_rendement
    total_net                   NUMERIC(15,2)   NOT NULL,           -- = total_brut - deductions

    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.fact_paiements_livreurs IS
    'Freelance driver payment fact. Two rows per driver per month (bi-monthly periods).';
COMMENT ON COLUMN warehouse.fact_paiements_livreurs.total_net IS
    'Invariant: total_net = total_brut - deductions. Validated by ETL load.';
COMMENT ON COLUMN warehouse.fact_paiements_livreurs.driver_key IS
    'References dim_freelance_driver — NOT dim_employee. Freelancers are a separate registry.';

CREATE INDEX IF NOT EXISTS idx_fpl_date_paiement  ON warehouse.fact_paiements_livreurs (date_paiement_key);
CREATE INDEX IF NOT EXISTS idx_fpl_agence         ON warehouse.fact_paiements_livreurs (agence_key);
CREATE INDEX IF NOT EXISTS idx_fpl_driver         ON warehouse.fact_paiements_livreurs (driver_key);
CREATE INDEX IF NOT EXISTS idx_fpl_periode        ON warehouse.fact_paiements_livreurs (date_debut_periode_key, date_fin_periode_key);
