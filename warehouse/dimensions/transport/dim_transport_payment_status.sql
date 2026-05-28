-- =============================================================================
-- DIMENSION: dim_transport_payment_status
-- Grain     : One row per transport payment status (3 rows)
-- Source    : stg_transport_requests (SELECT DISTINCT payment_status) + is_terminal flag
-- ETL       : INSERT ... ON CONFLICT (payment_status) DO UPDATE SET is_terminal
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_payment_status (
    payment_status_id SMALLINT     PRIMARY KEY,
    payment_status    VARCHAR(30)  UNIQUE NOT NULL,
    is_terminal       BOOLEAN      NOT NULL
);

INSERT INTO warehouse.dim_transport_payment_status (payment_status_id, payment_status, is_terminal) VALUES
    (1, 'en_attente', FALSE),
    (2, 'payé',       TRUE),
    (3, 'annulé',     TRUE)
ON CONFLICT (payment_status_id) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS warehouse.dim_transport_payment_status_seq START 4;
