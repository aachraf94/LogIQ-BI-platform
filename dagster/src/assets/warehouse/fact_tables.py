"""
Fact table loader assets — one asset per fact table.
All facts use UPSERT on their natural key to support re-runs safely.
Dimension key lookups are done via SQL JOINs inside INSERT for performance.
"""

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource


# ─────────────────────────────────────────────────────────────────────────────
# PARCEL FACTS
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="facts",
    deps=[
        "dim_parcel",
        "dim_pricing",
        "stg_yalidine_parcel_history",
    ],
    description=(
        "Grain: one row per resolved (terminal) parcel → fact_parcel_revenue. "
        "delivery_fee from latest stg event; tarif_theorique from dim_pricing at destination wilaya."
    ),
)
def fact_parcel_revenue(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_parcel_revenue (parcel_key, delivery_fee, tarif_theorique, ecart_tarif)
                WITH latest_fee AS (
                    SELECT DISTINCT ON (tracking)
                        tracking,
                        delivery_fee,
                        destination_wilaya_id,
                        delivery_type
                    FROM warehouse.stg_yalidine_parcel_history
                    WHERE delivery_fee IS NOT NULL
                    ORDER BY tracking, date_statut DESC
                )
                SELECT
                    p.parcel_key,
                    f.delivery_fee,
                    CASE f.delivery_type
                        WHEN 'HD' THEN pr.tarif_hd
                        WHEN 'SD' THEN pr.tarif_sd
                    END                                              AS tarif_theorique,
                    CASE
                        WHEN f.delivery_fee IS NOT NULL
                         AND CASE f.delivery_type
                               WHEN 'HD' THEN pr.tarif_hd
                               WHEN 'SD' THEN pr.tarif_sd
                             END IS NOT NULL
                        THEN f.delivery_fee
                           - CASE f.delivery_type
                               WHEN 'HD' THEN pr.tarif_hd
                               WHEN 'SD' THEN pr.tarif_sd
                             END
                    END                                              AS ecart_tarif
                FROM warehouse.dim_parcel p
                JOIN warehouse.dim_parcels_status ps
                    ON ps.status_id = p.current_status_id AND ps.is_terminal = TRUE
                JOIN latest_fee f ON f.tracking = p.tracking
                LEFT JOIN warehouse.dim_pricing pr
                    ON pr.wilaya_id = f.destination_wilaya_id
                   AND pr.service_type_id = (
                       SELECT pricing_service_type_id
                       FROM warehouse.dim_pricing_service_type
                       WHERE service_type = 'livraison'
                       LIMIT 1
                   )
                   AND pr.is_active = TRUE
                ON CONFLICT (parcel_key) DO UPDATE SET
                    delivery_fee    = EXCLUDED.delivery_fee,
                    tarif_theorique = EXCLUDED.tarif_theorique,
                    ecart_tarif     = EXCLUDED.ecart_tarif
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} parcel revenue rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["dim_parcel", "stg_yalidine_parcel_history"],
    description=(
        "Grain: one row per parcel (all statuses) → fact_parcel_performance. "
        "Counts events, 'Tentative échouée' attempts, and first-to-last event duration."
    ),
)
def fact_parcel_performance(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_parcel_performance
                (parcel_key, nbr_evenements, duree_totale_minutes, nbr_tentatives_livraison)
                SELECT
                    p.parcel_key,
                    agg.nbr_evenements::SMALLINT,
                    EXTRACT(EPOCH FROM (agg.last_dt - agg.first_dt))::INTEGER / 60,
                    agg.nbr_tentatives::SMALLINT
                FROM warehouse.dim_parcel p
                JOIN (
                    SELECT
                        tracking,
                        COUNT(*)                                              AS nbr_evenements,
                        MIN(date_statut)                                      AS first_dt,
                        MAX(date_statut)                                      AS last_dt,
                        COUNT(*) FILTER (WHERE statut = 'Tentative échouée') AS nbr_tentatives
                    FROM warehouse.stg_yalidine_parcel_history
                    GROUP BY tracking
                ) agg ON agg.tracking = p.tracking
                ON CONFLICT (parcel_key) DO UPDATE SET
                    nbr_evenements           = EXCLUDED.nbr_evenements,
                    duree_totale_minutes     = EXCLUDED.duree_totale_minutes,
                    nbr_tentatives_livraison = EXCLUDED.nbr_tentatives_livraison
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} parcel performance rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SALARY & EXPENSE FACTS
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="facts",
    deps=["dim_bulletin", "stg_paie_bulletins"],
    description=(
        "Grain: one row per payslip → fact_cost_salaire. "
        "Loads gross salary, employee deductions, and employer charges."
    ),
)
def fact_cost_salaire(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_cost_salaire
                (bulletin_id, date_id, total_brut, total_deductions, total_charges_patronales)
                SELECT
                    b.bulletin_id,
                    b.payment_date,
                    b.total_brut,
                    b.total_deductions,
                    b.total_charges_patronales
                FROM warehouse.stg_paie_bulletins b
                JOIN warehouse.dim_bulletin db ON db.bulletin_id = b.bulletin_id
                WHERE b.company_id != 9
                  AND b.payment_date IN (SELECT date_id FROM warehouse.dim_date)
                ON CONFLICT (bulletin_id) DO UPDATE SET
                    total_brut               = EXCLUDED.total_brut,
                    total_deductions         = EXCLUDED.total_deductions,
                    total_charges_patronales = EXCLUDED.total_charges_patronales
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} salary fact rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["dim_depense", "stg_cashbox_depenses"],
    description="Grain: one row per cashbox expense → fact_charges. Loads montant with date.",
)
def fact_charges(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_charges (depense_id, date_id, montant)
                SELECT
                    s.depense_id,
                    s.date_depense,
                    s.montant
                FROM warehouse.stg_cashbox_depenses s
                JOIN warehouse.dim_depense d ON d.depense_id = s.depense_id
                WHERE s.date_depense IN (SELECT date_id FROM warehouse.dim_date)
                ON CONFLICT (depense_id) DO UPDATE SET
                    date_id = EXCLUDED.date_id,
                    montant = EXCLUDED.montant
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} charges rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# TRANSPORT FACTS
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="facts",
    deps=["dim_transport", "stg_transport_requests"],
    description=(
        "Grain: one row per transport request → fact_transport_cost. "
        "All 11 cost breakdown components (cout_*) and total_cost."
    ),
)
def fact_transport_cost(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_transport_cost (
                    transport_key, date_id,
                    cout_base, cout_distance_supp, cout_ramassage, cout_livraison,
                    cout_manutention, cout_emballage, cout_tarif_nuit, cout_prod_frais,
                    cout_assurance, cout_carburant, cout_peage, total_cost
                )
                SELECT
                    t.transport_key,
                    dd.date_id,
                    s.cout_base, s.cout_distance_supp, s.cout_ramassage, s.cout_livraison,
                    s.cout_manutention, s.cout_emballage, s.cout_tarif_nuit, s.cout_prod_frais,
                    s.cout_assurance, s.cout_carburant, s.cout_peage, s.total_cost
                FROM warehouse.stg_transport_requests s
                JOIN warehouse.dim_transport t ON t.request_id = s.request_id
                LEFT JOIN warehouse.dim_date dd ON dd.date_id = DATE(s.created_at_src)
                ON CONFLICT (transport_key) DO UPDATE SET
                    cout_base          = EXCLUDED.cout_base,
                    cout_distance_supp = EXCLUDED.cout_distance_supp,
                    cout_ramassage     = EXCLUDED.cout_ramassage,
                    cout_livraison     = EXCLUDED.cout_livraison,
                    cout_manutention   = EXCLUDED.cout_manutention,
                    cout_emballage     = EXCLUDED.cout_emballage,
                    cout_tarif_nuit    = EXCLUDED.cout_tarif_nuit,
                    cout_prod_frais    = EXCLUDED.cout_prod_frais,
                    cout_assurance     = EXCLUDED.cout_assurance,
                    cout_carburant     = EXCLUDED.cout_carburant,
                    cout_peage         = EXCLUDED.cout_peage,
                    total_cost         = EXCLUDED.total_cost
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} transport cost rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["dim_transport", "stg_transport_requests"],
    description=(
        "Grain: one row per transport request → fact_transport_billing. "
        "marge_brute_dzd/pct computed from amount_invoiced − total_cost."
    ),
)
def fact_transport_billing(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_transport_billing (
                    transport_key, date_invoiced_id, date_paid_id,
                    invoice_ref, amount_invoiced, amount_paid,
                    marge_brute_dzd, marge_brute_pct
                )
                SELECT
                    t.transport_key,
                    dd_inv.date_id,
                    dd_paid.date_id,
                    s.invoice_ref,
                    s.amount_invoiced,
                    s.amount_paid,
                    s.amount_invoiced - s.total_cost                                AS marge_brute_dzd,
                    CASE WHEN s.total_cost > 0
                         THEN ROUND((s.amount_invoiced - s.total_cost) / s.total_cost * 100, 2)
                    END                                                             AS marge_brute_pct
                FROM warehouse.stg_transport_requests s
                JOIN warehouse.dim_transport t ON t.request_id = s.request_id
                LEFT JOIN warehouse.dim_date dd_inv  ON dd_inv.date_id  = DATE(s.invoiced_at)
                LEFT JOIN warehouse.dim_date dd_paid ON dd_paid.date_id = DATE(s.paid_at)
                ON CONFLICT (transport_key) DO UPDATE SET
                    date_invoiced_id = EXCLUDED.date_invoiced_id,
                    date_paid_id     = EXCLUDED.date_paid_id,
                    amount_invoiced  = EXCLUDED.amount_invoiced,
                    amount_paid      = EXCLUDED.amount_paid,
                    marge_brute_dzd  = EXCLUDED.marge_brute_dzd,
                    marge_brute_pct  = EXCLUDED.marge_brute_pct
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} transport billing rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["dim_transport", "stg_transport_requests"],
    description=(
        "Grain: one row per transport request → fact_transport_performance. "
        "Routing metrics, timing breakdowns, delay flags, and client rating."
    ),
)
def fact_transport_performance(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_transport_performance (
                    transport_key,
                    date_completion_id,
                    distance_unit_km, distance_real_km, distance_extra_km,
                    total_vehicle_km, total_duration_minutes, total_waiting_time_minutes,
                    nbr_stops_pickup, nbr_stops_delivery, nbr_stops_total,
                    nbr_floors, night_shift_hours,
                    vehicle_departure_dt, vehicle_return_dt,
                    departure_delay_minutes, arrival_delay_minutes,
                    on_time, client_rating
                )
                SELECT
                    t.transport_key,
                    dd_comp.date_id,
                    s.distance_unit_km, s.distance_real_km, s.distance_extra_km,
                    s.total_vehicle_km, s.total_duration_minutes, s.total_waiting_time_minutes,
                    s.nbr_stops_pickup::SMALLINT,
                    s.nbr_stops_delivery::SMALLINT,
                    s.nbr_stops_total::SMALLINT,
                    s.nbr_floors::SMALLINT,
                    s.night_shift_hours::SMALLINT,
                    s.vehicle_departure_dt, s.vehicle_return_dt,
                    s.departure_delay_minutes, s.arrival_delay_minutes,
                    s.on_time, s.client_rating
                FROM warehouse.stg_transport_requests s
                JOIN warehouse.dim_transport t ON t.request_id = s.request_id
                LEFT JOIN warehouse.dim_date dd_comp ON dd_comp.date_id = DATE(s.completed_at)
                ON CONFLICT (transport_key) DO UPDATE SET
                    date_completion_id         = EXCLUDED.date_completion_id,
                    total_duration_minutes     = EXCLUDED.total_duration_minutes,
                    total_waiting_time_minutes = EXCLUDED.total_waiting_time_minutes,
                    departure_delay_minutes    = EXCLUDED.departure_delay_minutes,
                    arrival_delay_minutes      = EXCLUDED.arrival_delay_minutes,
                    on_time                    = EXCLUDED.on_time,
                    client_rating              = EXCLUDED.client_rating
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} transport performance rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})
