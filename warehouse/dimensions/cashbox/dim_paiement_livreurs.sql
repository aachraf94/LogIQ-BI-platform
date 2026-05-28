-- =============================================================================
-- DIMENSION: dim_paiement_livreurs
-- Grain     : One row per bi-monthly freelance driver payment (~34 K rows)
-- Source    : stg_cashbox_paiements_livreurs
-- ETL       : Requires dim_livreur_freelance and dim_depense (step 41) loaded first.
--             depense_id resolved by joining to dim_depense on depense_id from staging.
-- Note      : Financial amounts (total_net, tarifs) are costs — they live in
--             fact_charges via the dual-tracked depense_id row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_paiement_livreurs (
    paiement_id       VARCHAR(50)  PRIMARY KEY,  -- PAY-LIV-YYYY-MM-NNNNNN — natural key
    livreur_id        VARCHAR(20)  NOT NULL REFERENCES warehouse.dim_livreur_freelance(livreur_id),
    depense_id        VARCHAR(50)  NOT NULL REFERENCES warehouse.dim_depense(depense_id),  -- dual-tracked nature_id=5
    period_from_id    DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),        -- 1st or 16th of month
    period_to_id      DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),        -- 15th or last day of month
    date_paiement_id  DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),        -- actual payment date
    nbr_colis_livres  INTEGER      NOT NULL,
    nbr_colis_echoues INTEGER      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dim_paiement_livreur ON warehouse.dim_paiement_livreurs (livreur_id);
CREATE INDEX IF NOT EXISTS idx_dim_paiement_depense ON warehouse.dim_paiement_livreurs (depense_id);
CREATE INDEX IF NOT EXISTS idx_dim_paiement_period  ON warehouse.dim_paiement_livreurs (period_from_id, period_to_id);
