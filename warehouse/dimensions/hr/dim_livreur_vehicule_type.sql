-- =============================================================================
-- DIMENSION: dim_livreur_vehicule_type
-- Grain     : One row per freelance driver vehicle category (3 rows — static seed)
-- Source    : Static — Yalidine's three vehicle categories for freelancers
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_livreur_vehicule_type (
    vehicule_type_id SMALLINT     PRIMARY KEY,
    vehicule_type    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_livreur_vehicule_type (vehicule_type_id, vehicule_type) VALUES
    (1, 'moto'),
    (2, 'voiture'),
    (3, 'camionnette')
ON CONFLICT (vehicule_type_id) DO NOTHING;
