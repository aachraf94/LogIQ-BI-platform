-- =============================================================================
-- DIMENSION: dim_livreur_freelance
-- Grain     : One row per freelance driver (~1 400 rows)
-- Source    : stg_cashbox_paiements_livreurs (distinct livreur rows)
-- ETL       : INSERT ... ON CONFLICT (livreur_id) DO UPDATE SET nom, prenom,
--             vehicule_type_id, agence_key
-- Note      : livreur_id (FR-XXXXXX) is a completely separate namespace from
--             HRFORCE user_id. Never join to dim_employee.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_livreur_freelance (
    livreur_id       VARCHAR(20)  PRIMARY KEY,  -- FR-XXXXXX — natural key
    nom              VARCHAR(100) NOT NULL,
    prenom           VARCHAR(100) NOT NULL,
    vehicule_type_id SMALLINT     NOT NULL REFERENCES warehouse.dim_livreur_vehicule_type(vehicule_type_id),
    agence_key       INTEGER      REFERENCES warehouse.dim_agence(agence_key)  -- permanent assignment, no transfers
);

CREATE INDEX IF NOT EXISTS idx_dim_livreur_agence ON warehouse.dim_livreur_freelance (agence_key);
