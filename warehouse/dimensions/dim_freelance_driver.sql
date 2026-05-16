-- =============================================================================
-- DIMENSION: dim_freelance_driver
-- Grain   : One row per freelance driver (~5 per operational agency ≈ ~1 400 rows)
-- SCD     : None — freelance drivers stay with the same agency throughout the
--           dataset per business rules (no agency transfers for freelancers)
-- Notes   : Freelance driver IDs (FR-NNNNNN) are entirely separate from
--           HRFORCE user IDs. They must NEVER be joined to dim_employee.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_freelance_driver (
    driver_key          SERIAL          PRIMARY KEY,

    livreur_id          VARCHAR(20)     NOT NULL UNIQUE,            -- FR-NNNNNN — source natural key
    nom                 VARCHAR(100)    NOT NULL,
    prenom              VARCHAR(100)    NOT NULL,
    full_name           VARCHAR(200)    NOT NULL,                   -- computed: nom || ' ' || prenom
    phone               VARCHAR(20),
    vehicule_type       VARCHAR(20)     NOT NULL
                        CHECK (vehicule_type IN ('moto', 'voiture', 'camionnette')),

    -- Agency they work for (stable throughout dataset)
    agence_key          BIGINT          NOT NULL
                        REFERENCES warehouse.dim_agence (agence_key),
    agence_id           INTEGER         NOT NULL,                   -- denormalized

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_freelance_driver IS
    '~1 400 freelance delivery drivers (5 per operational agency). Separate namespace from employees.';
COMMENT ON COLUMN warehouse.dim_freelance_driver.livreur_id IS
    'Format: FR-NNNNNN. Never joins to dim_employee — completely different person registry.';

CREATE INDEX IF NOT EXISTS idx_dim_driver_agence ON warehouse.dim_freelance_driver (agence_key);
CREATE INDEX IF NOT EXISTS idx_dim_driver_vehicule ON warehouse.dim_freelance_driver (vehicule_type);
