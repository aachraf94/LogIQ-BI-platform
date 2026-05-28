-- =============================================================================
-- DIMENSION: dim_transport_status
-- Grain     : One row per transport request status (5 rows)
-- Source    : stg_transport_requests (SELECT DISTINCT status) + is_terminal flag by ETL
-- ETL       : INSERT ... ON CONFLICT (status_name) DO UPDATE SET is_terminal
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_status (
    status_id   SMALLINT     PRIMARY KEY,
    status_name VARCHAR(30)  UNIQUE NOT NULL,
    is_terminal BOOLEAN      NOT NULL  -- TRUE for terminée and annulée
);

INSERT INTO warehouse.dim_transport_status (status_id, status_name, is_terminal) VALUES
    (1, 'en_attente', FALSE),
    (2, 'confirmée',  FALSE),
    (3, 'en_cours',   FALSE),
    (4, 'terminée',   TRUE),
    (5, 'annulée',    TRUE)
ON CONFLICT (status_id) DO NOTHING;
