-- =============================================================================
-- DIMENSION: dim_transport_sub_service_type
-- Grain     : One row per transport sub-service type (3 rows)
-- Source    : stg_transport_requests (SELECT DISTINCT sub_service_type WHERE NOT NULL)
-- Note      : All sub-service types belong to service_type_id = 1 (course_dediee).
--             NULL sub_service_type in source = courrier or manutention requests.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_sub_service_type (
    sub_service_id   SMALLINT     PRIMARY KEY,
    sub_service_type VARCHAR(20)  UNIQUE NOT NULL,
    service_type_id  SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_service_type(service_type_id)  -- always = 1
);

INSERT INTO warehouse.dim_transport_sub_service_type (sub_service_id, sub_service_type, service_type_id) VALUES
    (1, 'livraison', 1),
    (2, 'pickup',    1),
    (3, 'echange',   1)
ON CONFLICT (sub_service_id) DO NOTHING;
