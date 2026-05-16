-- =============================================================================
-- FACT: fact_bulletins_salaire
-- Grain  : One row per (employee, month) — unique per (employee_key, period_month, period_year)
-- Source : stg_paie_bulletins
-- Notes  : Both employee-side deductions AND employer-side charges are stored.
--          Total employer cost per employee = total_brut + total_charges_patronales.
--          Sensitive fields (CIN, NSS, RIB) are NEVER loaded here.
--          Freelance drivers are NOT here — see fact_paiements_livreurs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_bulletins_salaire (
    bulletin_key                    BIGSERIAL       PRIMARY KEY,

    -- Date dimension key
    date_paiement_key               INTEGER         NOT NULL        -- around 25th–30th of period month
                                    REFERENCES warehouse.dim_date (date_key),

    -- Period (degenerate — kept outside date dim for direct GROUP BY)
    period_month                    SMALLINT        NOT NULL,       -- 1–12
    period_year                     SMALLINT        NOT NULL,       -- e.g. 2024

    -- Dimension keys (point-in-time SCD versions)
    employee_key                    BIGINT          NOT NULL        -- SCD row valid at time of bulletin
                                    REFERENCES warehouse.dim_employee (employee_key),
    agence_key                      BIGINT          NOT NULL
                                    REFERENCES warehouse.dim_agence (agence_key),
    company_key                     INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_company (company_key),
    occupation_key                  INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_occupation (occupation_key),

    -- Degenerate dimensions
    bulletin_id                     VARCHAR(50)     NOT NULL UNIQUE, -- PAY-{YYYY}-{MM}-{employee_id}
    contract_type                   VARCHAR(20)     NOT NULL
                                    CHECK (contract_type IN ('CDI', 'CDD', 'Intérimaire')),
    regime                          VARCHAR(20)     NOT NULL
                                    CHECK (regime IN ('Temps plein', 'Temps partiel')),
    mode_paiement                   VARCHAR(20)     NOT NULL
                                    CHECK (mode_paiement IN ('virement', 'espèces', 'chèque')),

    -- Seniority at time of bulletin
    seniority_years                 SMALLINT        NOT NULL,
    seniority_months                SMALLINT        NOT NULL,

    -- Gross salary components (DZD)
    base_salary                     NUMERIC(15,2)   NOT NULL,
    anciennete                      NUMERIC(15,2)   NOT NULL DEFAULT 0, -- = base_salary × seniority_years × 0.01
    prime_rendement                 NUMERIC(15,2),
    prime_panier                    NUMERIC(15,2),
    prime_transport                 NUMERIC(15,2),
    heures_sup_amount               NUMERIC(15,2),
    heures_sup_hours                NUMERIC(6,2),
    autres_primes                   NUMERIC(15,2),
    total_brut                      NUMERIC(15,2)   NOT NULL,       -- sum of all gross components

    -- Employee deductions (DZD)
    cotisation_securite_sociale     NUMERIC(15,2)   NOT NULL,       -- ROUND(total_brut × 0.09, 2)
    irg                             NUMERIC(15,2)   NOT NULL,       -- income tax (progressive)
    autres_retenues                 NUMERIC(15,2),
    total_deductions                NUMERIC(15,2)   NOT NULL,

    -- Net salary (DZD)
    net_a_payer                     NUMERIC(15,2)   NOT NULL,       -- = total_brut - total_deductions

    -- Employer charges — critical for total labor cost analysis (DZD)
    cotisation_patronale_cnas       NUMERIC(15,2)   NOT NULL,       -- ROUND(total_brut × 0.20, 2)
    cotisation_retraite             NUMERIC(15,2)   NOT NULL,       -- ROUND(total_brut × 0.04, 2)
    accident_travail                NUMERIC(15,2)   NOT NULL,       -- ROUND(total_brut × 0.01, 2)
    total_charges_patronales        NUMERIC(15,2)   NOT NULL,       -- sum of three above

    -- Time worked
    jours_travailles                SMALLINT        NOT NULL,
    jours_absence                   SMALLINT        NOT NULL DEFAULT 0,
    jours_conge                     SMALLINT        NOT NULL DEFAULT 0,
    jours_maladie                   SMALLINT        NOT NULL DEFAULT 0,
    heures_normales                 NUMERIC(6,2)    NOT NULL,
    heures_sup                      NUMERIC(6,2),

    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- One bulletin per employee per month (enforced at both staging and fact level)
    UNIQUE (employee_key, period_month, period_year)
);

COMMENT ON TABLE warehouse.fact_bulletins_salaire IS
    'Monthly payroll fact at employee-month grain. ~108K rows for 36-month dataset.';
COMMENT ON COLUMN warehouse.fact_bulletins_salaire.total_charges_patronales IS
    'Employer-side social charges. Total employer cost = total_brut + total_charges_patronales.';
COMMENT ON COLUMN warehouse.fact_bulletins_salaire.net_a_payer IS
    'Invariant: net_a_payer = total_brut - total_deductions. Validated by ETL.';
COMMENT ON COLUMN warehouse.fact_bulletins_salaire.employee_key IS
    'Points to the SCD dim_employee row that was valid at time of this bulletin.';
COMMENT ON COLUMN warehouse.fact_bulletins_salaire.cotisation_patronale_cnas IS
    'Caisse Nationale des Assurances Sociales employer contribution (~20% of gross).';

CREATE INDEX IF NOT EXISTS idx_fbs_date_paiement  ON warehouse.fact_bulletins_salaire (date_paiement_key);
CREATE INDEX IF NOT EXISTS idx_fbs_employee       ON warehouse.fact_bulletins_salaire (employee_key);
CREATE INDEX IF NOT EXISTS idx_fbs_agence         ON warehouse.fact_bulletins_salaire (agence_key);
CREATE INDEX IF NOT EXISTS idx_fbs_company        ON warehouse.fact_bulletins_salaire (company_key);
CREATE INDEX IF NOT EXISTS idx_fbs_occupation     ON warehouse.fact_bulletins_salaire (occupation_key);
CREATE INDEX IF NOT EXISTS idx_fbs_period         ON warehouse.fact_bulletins_salaire (period_year, period_month);
