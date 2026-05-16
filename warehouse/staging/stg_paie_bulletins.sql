-- =============================================================================
-- STAGING: stg_paie_bulletins
-- Source : PC Paie — GET /paie/bulletins
-- Grain  : One row per (employee, month) — ~3 000 employees × 36 months ≈ ~108K rows
-- Notes  : Sensitive fields (CIN, NSS, RIB) are EXCLUDED from this staging table.
--          Nested organization and contract objects are flattened.
--          Salary math invariant: net_a_payer = total_brut - total_deductions.
--          Freelance drivers are NOT here — see stg_cashbox_paiements_livreurs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_paie_bulletins (
    stg_id                          BIGSERIAL       PRIMARY KEY,

    bulletin_id                     VARCHAR(50)     NOT NULL UNIQUE, -- PAY-{YYYY}-{MM}-{employee_id}
    period_month                    SMALLINT        NOT NULL,        -- 1–12
    period_year                     SMALLINT        NOT NULL,
    period_label                    VARCHAR(30)     NOT NULL,        -- e.g. "Mars 2024"
    payment_date                    DATE            NOT NULL,        -- 25th–30th of period month
    processed_at                    TIMESTAMP       NOT NULL,

    -- Employee (no CIN, NSS — sensitive fields excluded)
    employee_id                     INTEGER         NOT NULL,        -- FK → hrforce.users.id = whois
    employee_code                   VARCHAR(50)     NOT NULL,
    employee_full_name              VARCHAR(200)    NOT NULL,

    -- Organization
    company_id                      INTEGER         NOT NULL,
    company_name                    VARCHAR(100)    NOT NULL,
    agency_id                       INTEGER         NOT NULL,        -- FK → hrforce.agencies.id
    agency_name                     VARCHAR(200)    NOT NULL,
    agency_hrforce_code             VARCHAR(30)     NOT NULL,
    cost_center                     VARCHAR(20),                     -- usually codeYalTwo
    occupation                      VARCHAR(150)    NOT NULL,        -- job title at time of bulletin
    service                         VARCHAR(150),
    department                      VARCHAR(150),

    -- Contract
    contract_type                   VARCHAR(20)     NOT NULL,        -- CDI, CDD, Intérimaire
    hire_date                       DATE            NOT NULL,
    seniority_years                 SMALLINT        NOT NULL,
    seniority_months                SMALLINT        NOT NULL,
    work_hours_per_week             NUMERIC(4,1)    NOT NULL,
    regime                          VARCHAR(20)     NOT NULL,        -- Temps plein, Temps partiel

    -- Gross salary components (DZD)
    base_salary                     NUMERIC(15,2)   NOT NULL,
    anciennete                      NUMERIC(15,2)   NOT NULL DEFAULT 0,
    prime_rendement                 NUMERIC(15,2),
    prime_panier                    NUMERIC(15,2),
    prime_transport                 NUMERIC(15,2),
    heures_sup_amount               NUMERIC(15,2),
    heures_sup_hours                NUMERIC(6,2),
    autres_primes                   NUMERIC(15,2),
    total_brut                      NUMERIC(15,2)   NOT NULL,

    -- Employee deductions (DZD)
    cotisation_securite_sociale     NUMERIC(15,2)   NOT NULL,       -- ~9% of total_brut
    irg                             NUMERIC(15,2)   NOT NULL,       -- income tax
    autres_retenues                 NUMERIC(15,2),
    total_deductions                NUMERIC(15,2)   NOT NULL,

    -- Employer charges — critical for full labor cost (DZD)
    cotisation_patronale_cnas       NUMERIC(15,2)   NOT NULL,       -- ~20% of total_brut
    cotisation_retraite             NUMERIC(15,2)   NOT NULL,       -- ~4% of total_brut
    accident_travail                NUMERIC(15,2)   NOT NULL,       -- ~1% of total_brut
    total_charges_patronales        NUMERIC(15,2)   NOT NULL,

    -- Net (no RIB — sensitive field excluded)
    net_a_payer                     NUMERIC(15,2)   NOT NULL,       -- = total_brut - total_deductions
    mode_paiement                   VARCHAR(20)     NOT NULL,       -- virement, espèces, chèque

    -- Time worked
    jours_travailles                SMALLINT        NOT NULL,
    jours_absence                   SMALLINT        NOT NULL DEFAULT 0,
    jours_conge                     SMALLINT        NOT NULL DEFAULT 0,
    jours_maladie                   SMALLINT        NOT NULL DEFAULT 0,
    heures_normales                 NUMERIC(6,2)    NOT NULL,
    heures_sup                      NUMERIC(6,2),

    -- ETL metadata
    loaded_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                        VARCHAR(50),
    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (employee_id, period_month, period_year)                 -- one bulletin per employee per month
);

COMMENT ON TABLE warehouse.stg_paie_bulletins IS
    'Staging for monthly salary bulletins. ~108K rows at full scale. CIN/NSS/RIB excluded.';
COMMENT ON COLUMN warehouse.stg_paie_bulletins.net_a_payer IS
    'Invariant: net_a_payer = total_brut - total_deductions. Validated by ETL.';
COMMENT ON COLUMN warehouse.stg_paie_bulletins.total_charges_patronales IS
    'Employer-side cost: cotisation_patronale_cnas + cotisation_retraite + accident_travail.';
COMMENT ON COLUMN warehouse.stg_paie_bulletins.cotisation_patronale_cnas IS
    'Approximately 20% of total_brut — largest employer charge component.';

CREATE INDEX IF NOT EXISTS idx_stg_bul_employee   ON warehouse.stg_paie_bulletins (employee_id);
CREATE INDEX IF NOT EXISTS idx_stg_bul_agency     ON warehouse.stg_paie_bulletins (agency_id);
CREATE INDEX IF NOT EXISTS idx_stg_bul_period     ON warehouse.stg_paie_bulletins (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_stg_bul_company    ON warehouse.stg_paie_bulletins (company_id);
