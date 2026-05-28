-- =============================================================================
-- DIMENSION: dim_transport_service_type
-- Grain     : One row per transport service type (3 rows)
-- Source    : stg_transport_requests (SELECT DISTINCT service_type)
-- ETL       : INSERT ... ON CONFLICT (service_type) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_service_type (
    service_type_id SMALLINT     PRIMARY KEY,
    service_type    VARCHAR(30)  UNIQUE NOT NULL
);

INSERT INTO warehouse.dim_transport_service_type (service_type_id, service_type) VALUES
    (1, 'course_dediee'),
    (2, 'courrier'),
    (3, 'manutention')
ON CONFLICT (service_type_id) DO NOTHING;
