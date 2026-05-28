-- =============================================================================
-- DEFERRED FK CONSTRAINTS: dim_depense back-references
-- Run AFTER dim_paiement_livreurs and dim_remboursement are created.
-- Circular reference: dim_depense ↔ dim_paiement_livreurs ↔ dim_depense
--                     dim_depense ↔ dim_remboursement       ↔ dim_depense
-- These constraints are added here (not in dim_depense.sql) to avoid CREATE TABLE
-- ordering conflicts.
-- =============================================================================

ALTER TABLE warehouse.dim_depense
    ADD CONSTRAINT IF NOT EXISTS fk_depense_paiement_livreur
        FOREIGN KEY (paiement_livreur_id)
        REFERENCES warehouse.dim_paiement_livreurs(paiement_id)
        DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE warehouse.dim_depense
    ADD CONSTRAINT IF NOT EXISTS fk_depense_remboursement
        FOREIGN KEY (remboursement_id)
        REFERENCES warehouse.dim_remboursement(remboursement_id)
        DEFERRABLE INITIALLY DEFERRED;
