-- =============================================================================
-- DIMENSION: dim_depense
-- Grain     : One row per cashbox expense record (~500 K rows)
-- Source    : stg_cashbox_depenses
-- ETL 2-pass:
--   Step 41 — INSERT all depenses; paiement_livreur_id and remboursement_id set NULL.
--   Step 42 — dim_paiement_livreurs loaded, resolves depense_id.
--   Step 43 — dim_remboursement loaded, resolves depense_id.
--   After 43 — UPDATE dim_depense SET paiement_livreur_id / remboursement_id (second pass).
-- Navigation:
--   When rubrique_id is set  → dim_depense → dim_rubriques → dim_nature → dim_nature_category
--   When rubrique_id is NULL → dim_depense.nature_id → dim_nature → dim_nature_category
--   Invariant: exactly one of rubrique_id / nature_id is non-NULL per row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_depense (
    depense_id          VARCHAR(50)  PRIMARY KEY,  -- DEP-YYYY-MM-NNNNNN — natural key
    date_depense_id     DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),
    depense_status_id   SMALLINT     NOT NULL REFERENCES warehouse.dim_depense_status(depense_status_id),
    rubrique_id         INTEGER      REFERENCES warehouse.dim_rubriques(rubrique_id),   -- NULL for ~15% of expenses
    nature_id           INTEGER      REFERENCES warehouse.dim_nature(nature_id),        -- NOT NULL when rubrique_id IS NULL
    agence_key          INTEGER      REFERENCES warehouse.dim_agence(agence_key),       -- SCD2 version at expense date
    paiement_livreur_id VARCHAR(50),  -- FK → dim_paiement_livreurs.paiement_id — added by ALTER TABLE after those tables exist (circular ref)
    remboursement_id    VARCHAR(50)   -- FK → dim_remboursement.remboursement_id — added by ALTER TABLE after those tables exist (circular ref)
);

CREATE INDEX IF NOT EXISTS idx_dim_depense_date       ON warehouse.dim_depense (date_depense_id);
CREATE INDEX IF NOT EXISTS idx_dim_depense_status     ON warehouse.dim_depense (depense_status_id);
CREATE INDEX IF NOT EXISTS idx_dim_depense_agence     ON warehouse.dim_depense (agence_key);
CREATE INDEX IF NOT EXISTS idx_dim_depense_rubrique   ON warehouse.dim_depense (rubrique_id);
CREATE INDEX IF NOT EXISTS idx_dim_depense_nature     ON warehouse.dim_depense (nature_id);
