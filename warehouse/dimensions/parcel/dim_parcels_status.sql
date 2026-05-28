-- =============================================================================
-- DIMENSION: dim_parcels_status
-- Grain     : One row per Yalidine parcel status (21 rows)
-- Source    : stg_yalidine_parcel_history (DISTINCT statut) + is_terminal flag by ETL
-- Seed data : Explicit known values from Yalidine business model provided here;
--             ETL adds new statuses (is_terminal=FALSE) if source introduces them.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_parcels_status (
    status_id   SMALLINT     PRIMARY KEY,
    status_name VARCHAR(50)  UNIQUE NOT NULL,
    is_terminal BOOLEAN      NOT NULL  -- TRUE only for Livré and Retourné au vendeur
);

INSERT INTO warehouse.dim_parcels_status (status_id, status_name, is_terminal) VALUES
    ( 1, 'En préparation',       FALSE),
    ( 2, 'Prêt à expédier',      FALSE),
    ( 3, 'Expédié',              FALSE),
    ( 4, 'Vers Wilaya',          FALSE),
    ( 5, 'Transfert',            FALSE),
    ( 6, 'Reçu à Wilaya',        FALSE),
    ( 7, 'Centre',               FALSE),
    ( 8, 'Prêt pour livreur',    FALSE),
    ( 9, 'En attente du client', FALSE),
    (10, 'Sorti en livraison',   FALSE),
    (11, 'En alerte',            FALSE),
    (12, 'Tentative échouée',    FALSE),
    (13, 'Livré',                TRUE),
    (14, 'Echèc livraison',      FALSE),
    (15, 'Retourné au centre',   FALSE),
    (16, 'Retour vers centre',   FALSE),
    (17, 'Retour groupé',        FALSE),
    (18, 'Retour à retirer',     FALSE),
    (19, 'Retourné au vendeur',  TRUE),
    (20, 'Non reçu',             FALSE),
    (21, 'Sac vidé',             FALSE)
ON CONFLICT (status_id) DO NOTHING;
