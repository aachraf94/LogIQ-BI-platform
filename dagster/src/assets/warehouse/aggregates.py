"""
Aggregate refresh assets — one asset per materialized view.
Each asset depends on the fact tables that feed it.
"""

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource

# Views that require no structural migration — plain REFRESH is sufficient.
_ALL_VIEWS = [
    ("agg_depenses_mensuelles",       ["fact_depenses"]),
    ("agg_cout_total_mensuel",        ["fact_depenses", "fact_bulletins_salaire", "fact_paiements_livreurs"]),
    ("agg_masse_salariale_mensuelle", ["fact_bulletins_salaire"]),
    ("agg_transport_mensuel",         ["fact_transport"]),
    ("agg_profitabilite_colis",       ["fact_livraisons"]),
]

# ---------------------------------------------------------------------------
# Corrected DDLs for views that required structural fixes
# ---------------------------------------------------------------------------

# agg_demande_transport: removed is_ramadan from SELECT+GROUP BY.
# It created sub-monthly rows (Ramadan straddles month boundaries) that violated
# idx_agg_dt_unique which does not include is_ramadan.
_AGG_DEMANDE_TRANSPORT_DDL = """
CREATE MATERIALIZED VIEW warehouse.agg_demande_transport AS
SELECT
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,
    wd.wilaya_id                        AS wilaya_depart_id,
    wd.wilaya_name                      AS wilaya_depart_name,
    wd.region                           AS region_depart,
    wa.wilaya_id                        AS wilaya_arrivee_id,
    wa.wilaya_name                      AS wilaya_arrivee_name,
    wa.region                           AS region_arrivee,
    (wd.region = wa.region)             AS meme_region,
    ft.service_type,
    ft.client_type,
    vt.vehicle_type,
    vt.payload_class,
    COUNT(*)                                                         AS nbr_requests,
    COUNT(*) FILTER (WHERE ft.status = 'terminée')                   AS nbr_terminees,
    COUNT(*) FILTER (WHERE ft.status = 'annulée')                    AS nbr_annulees,
    COUNT(*) FILTER (WHERE ft.client_type = 'conventionné')          AS nbr_conventionnes,
    COUNT(*) FILTER (WHERE ft.client_type = 'divers')                AS nbr_divers,
    SUM(ft.total_weight_kg)             AS total_poids_kg,
    AVG(ft.total_weight_kg)             AS avg_poids_kg,
    SUM(ft.nbr_pieces)                  AS total_pieces,
    AVG(ft.nbr_pieces)                  AS avg_pieces,
    AVG(ft.distance_unit_km)            AS avg_distance_unite_km,
    AVG(ft.distance_real_km)            AS avg_distance_reelle_km,
    MIN(ft.distance_real_km)            AS min_distance_reelle_km,
    MAX(ft.distance_real_km)            AS max_distance_reelle_km,
    SUM(ft.total_cost)                  AS total_cout_dzd,
    AVG(ft.total_cost)                  AS avg_cout_dzd,
    SUM(ft.amount_invoiced)             AS total_facture_dzd,
    AVG(ft.amount_invoiced)             AS avg_facture_dzd,
    SUM(ft.amount_invoiced - ft.total_cost) AS total_marge_brute_dzd,
    ROUND(
        100.0 * SUM(ft.amount_invoiced - ft.total_cost)
        / NULLIF(SUM(ft.amount_invoiced), 0), 2
    )                                   AS taux_marge_corridor_pct,
    ROUND(AVG(ft.total_cost / NULLIF(ft.distance_real_km, 0)), 2)    AS avg_cout_par_km_dzd,
    NOW()                               AS refreshed_at
FROM warehouse.fact_transport ft
JOIN warehouse.dim_date         d   ON ft.date_creation_key  = d.date_key
JOIN warehouse.dim_wilaya       wd  ON ft.wilaya_depart_key  = wd.wilaya_key
JOIN warehouse.dim_wilaya       wa  ON ft.wilaya_arrivee_key = wa.wilaya_key
JOIN warehouse.dim_vehicle_type vt  ON ft.vehicle_type_key   = vt.vehicle_type_key
GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    wd.wilaya_id, wd.wilaya_name, wd.region,
    wa.wilaya_id, wa.wilaya_name, wa.region,
    ft.service_type, ft.client_type,
    vt.vehicle_type, vt.payload_class
WITH DATA
"""

# agg_performance_livraison: two fixes applied.
# 1. dim_agence joined via is_current=TRUE (prevents SCD2 fan-out on descriptive attrs).
# 2. company_id added to unique index grain — multiple companies share the same agency,
#    so grouping by agence_id alone produced duplicate rows for idx_agg_perf_unique.
_AGG_PERFORMANCE_LIVRAISON_DDL = """
CREATE MATERIALIZED VIEW warehouse.agg_performance_livraison AS
WITH fact_agence AS (
    SELECT agence_key, agence_id FROM warehouse.dim_agence
)
SELECT
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,
    a.agence_id,
    a.name                          AS agence_name,
    a.type                          AS agence_type,
    a.hub_id,
    w.wilaya_id,
    w.wilaya_name,
    w.region,
    c.company_id,
    c.license_name                  AS company_name,
    fl.delivery_type,
    COUNT(*)                        AS nbr_colis_total,
    COUNT(*) FILTER (WHERE sc.is_success)                                           AS nbr_livres,
    COUNT(*) FILTER (WHERE sc.status_group = 'failed')                              AS nbr_echecs,
    COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final'))     AS nbr_retours,
    COUNT(*) FILTER (WHERE NOT sc.is_terminal)                                      AS nbr_en_cours,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.is_success)
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_livraison_pct,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.status_group = 'failed')
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_echec_pct,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final'))
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_retour_pct,
    SUM(fl.delivery_fee)                                                            AS total_fees_dzd,
    AVG(fl.delivery_fee)                                                            AS avg_fee_dzd,
    SUM(fl.delivery_fee) FILTER (WHERE sc.is_success)                               AS fees_livres_dzd,
    AVG(fl.duree_livraison_minutes) FILTER (WHERE sc.is_success)                    AS avg_duree_livree_minutes,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY fl.duree_livraison_minutes
    ) FILTER (WHERE sc.is_success)                                                  AS median_duree_livree_minutes,
    COUNT(*) FILTER (WHERE fl.zone = 0)    AS nbr_zone_0,
    COUNT(*) FILTER (WHERE fl.zone = 1)    AS nbr_zone_1,
    COUNT(*) FILTER (WHERE fl.zone = 2)    AS nbr_zone_2,
    COUNT(*) FILTER (WHERE fl.zone = 3)    AS nbr_zone_3,
    COUNT(*) FILTER (WHERE fl.zone >= 4)   AS nbr_zone_4_plus,
    COUNT(*) FILTER (WHERE fl.parcel_type = 'ecommerce')   AS nbr_ecommerce,
    COUNT(*) FILTER (WHERE fl.parcel_type = 'internal')    AS nbr_internal,
    NOW()                           AS refreshed_at
FROM warehouse.fact_livraisons fl
JOIN fact_agence                fa ON fl.agence_origine_key = fa.agence_key
JOIN warehouse.dim_agence        a ON a.agence_id = fa.agence_id AND a.is_current = TRUE
JOIN warehouse.dim_date          d ON fl.date_creation_key  = d.date_key
JOIN warehouse.dim_wilaya        w ON a.wilaya_key          = w.wilaya_key
JOIN warehouse.dim_company       c ON fl.company_key        = c.company_key
JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key   = sc.statut_key
GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    a.agence_id, a.name, a.type, a.hub_id,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    fl.delivery_type
WITH DATA
"""

# agg_livraisons_journalieres: same two fixes as agg_performance_livraison.
# daily grain — is_ramadan is a property of the date so it does NOT cause fan-out here.
_AGG_LIVRAISONS_JOURNALIERES_DDL = """
CREATE MATERIALIZED VIEW warehouse.agg_livraisons_journalieres AS
WITH fact_agence AS (
    SELECT agence_key, agence_id FROM warehouse.dim_agence
)
SELECT
    d.full_date,
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,
    d.day_of_week,
    d.is_weekend,
    d.is_friday,
    d.is_ramadan,
    d.business_day_weight,
    a.agence_id,
    a.name                          AS agence_name,
    a.type                          AS agence_type,
    a.hub_id,
    a.code_yal_two                  AS agence_code_court,
    w.wilaya_id,
    w.wilaya_name,
    w.region,
    c.company_id,
    c.license_name                  AS company_name,
    fl.delivery_type,
    sc.status_group,
    sc.is_terminal,
    sc.is_success,
    COUNT(*)                        AS nbr_colis,
    COUNT(*) FILTER (WHERE sc.is_success)                                           AS nbr_colis_livres,
    COUNT(*) FILTER (WHERE sc.status_group = 'failed')                              AS nbr_colis_echoues,
    COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final'))     AS nbr_colis_retours,
    SUM(fl.delivery_fee)            AS total_delivery_fee_dzd,
    AVG(fl.delivery_fee)            AS avg_delivery_fee_dzd,
    COUNT(*) FILTER (WHERE fl.delivery_fee IS NOT NULL)                             AS nbr_colis_avec_fee,
    AVG(fl.zone)                    AS avg_zone,
    COUNT(*) FILTER (WHERE fl.zone = 0) AS nbr_zone_0,
    COUNT(*) FILTER (WHERE fl.zone = 1) AS nbr_zone_1,
    COUNT(*) FILTER (WHERE fl.zone = 2) AS nbr_zone_2,
    COUNT(*) FILTER (WHERE fl.zone = 3) AS nbr_zone_3,
    COUNT(*) FILTER (WHERE fl.zone >= 4) AS nbr_zone_4_plus,
    AVG(fl.duree_livraison_minutes) AS avg_duree_minutes,
    NOW()                           AS refreshed_at
FROM warehouse.fact_livraisons fl
JOIN fact_agence                fa ON fl.agence_origine_key  = fa.agence_key
JOIN warehouse.dim_agence        a ON a.agence_id = fa.agence_id AND a.is_current = TRUE
JOIN warehouse.dim_date          d ON fl.date_creation_key   = d.date_key
JOIN warehouse.dim_wilaya        w ON a.wilaya_key           = w.wilaya_key
JOIN warehouse.dim_company       c ON fl.company_key         = c.company_key
JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key    = sc.statut_key
GROUP BY
    d.full_date, d.year, d.month_num, d.month_name_fr, d.year_month,
    d.quarter, d.day_of_week, d.is_weekend, d.is_friday, d.is_ramadan, d.business_day_weight,
    a.agence_id, a.name, a.type, a.hub_id, a.code_yal_two,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    fl.delivery_type, sc.status_group, sc.is_terminal, sc.is_success
WITH DATA
"""


# ---------------------------------------------------------------------------
# Factory for plain-refresh assets
# ---------------------------------------------------------------------------

def _make_refresh_asset(view_name: str, fact_deps: list):
    @asset(
        name=f"refresh_{view_name}",
        group_name="aggregates",
        deps=fact_deps,
        description=f"REFRESH MATERIALIZED VIEW warehouse.{view_name}",
    )
    def _asset(
        context: AssetExecutionContext,
        warehouse_db: WarehousePostgresResource,
    ) -> MaterializeResult:
        with warehouse_db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"REFRESH MATERIALIZED VIEW warehouse.{view_name}")
        context.log.info(f"Refreshed {view_name}")
        return MaterializeResult(metadata={"view": MetadataValue.text(view_name)})

    return _asset


# ---------------------------------------------------------------------------
# Helper for views that need DROP+recreate when their unique index is stale
# ---------------------------------------------------------------------------

def _make_index_fix_asset(
    view_name: str,
    fact_deps: list,
    ddl: str,
    indexes: list,
    stale_index_name: str,
    stale_missing_col: str,
):
    """
    Creates an asset that detects whether `stale_missing_col` is absent from
    `stale_index_name`'s definition, and if so drops the view and recreates it
    with the corrected DDL (WITH DATA) and new indexes.
    On subsequent runs the index is correct so it falls through to a plain REFRESH.
    """
    description = (
        f"Refresh warehouse.{view_name}. "
        f"Recreates the view if {stale_index_name} is missing {stale_missing_col} (stale schema)."
    )

    @asset(name=f"refresh_{view_name}", group_name="aggregates", deps=fact_deps, description=description)
    def _asset(
        context: AssetExecutionContext,
        warehouse_db: WarehousePostgresResource,
    ) -> MaterializeResult:
        with warehouse_db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT indexdef FROM pg_indexes "
                    "WHERE schemaname = 'warehouse' AND indexname = %s",
                    (stale_index_name,),
                )
                row = cur.fetchone()
                if row is None or stale_missing_col not in row[0]:
                    context.log.info(
                        f"Stale index {stale_index_name} (missing {stale_missing_col}) "
                        f"— dropping and recreating {view_name}."
                    )
                    cur.execute(f"DROP MATERIALIZED VIEW IF EXISTS warehouse.{view_name} CASCADE")
                    cur.execute(ddl)
                    for idx_sql in indexes:
                        cur.execute(idx_sql)
                    context.log.info(f"View {view_name} recreated with corrected definition (WITH DATA).")
                else:
                    cur.execute(f"REFRESH MATERIALIZED VIEW warehouse.{view_name}")
                    context.log.info(f"Refreshed {view_name}.")

        return MaterializeResult(metadata={"view": MetadataValue.text(view_name)})

    return _asset


# ---------------------------------------------------------------------------
# Special-case assets
# ---------------------------------------------------------------------------

@asset(
    name="refresh_agg_demande_transport",
    group_name="aggregates",
    deps=["fact_transport"],
    description=(
        "Refresh warehouse.agg_demande_transport. "
        "If the live definition still contains is_ramadan, drops and recreates the view first."
    ),
)
def refresh_agg_demande_transport(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT definition FROM pg_matviews "
                "WHERE schemaname = 'warehouse' AND matviewname = 'agg_demande_transport'"
            )
            row = cur.fetchone()

            if row and "is_ramadan" in row[0]:
                context.log.info(
                    "Stale view definition detected (contains is_ramadan) — dropping and recreating."
                )
                cur.execute("DROP MATERIALIZED VIEW IF EXISTS warehouse.agg_demande_transport CASCADE")
                cur.execute(_AGG_DEMANDE_TRANSPORT_DDL)
                cur.execute(
                    "CREATE UNIQUE INDEX idx_agg_dt_unique "
                    "ON warehouse.agg_demande_transport "
                    "(year, month_num, wilaya_depart_id, wilaya_arrivee_id, service_type, client_type, vehicle_type)"
                )
                cur.execute("CREATE INDEX idx_agg_dt_year_month    ON warehouse.agg_demande_transport (year, month_num)")
                cur.execute("CREATE INDEX idx_agg_dt_depart        ON warehouse.agg_demande_transport (wilaya_depart_id)")
                cur.execute("CREATE INDEX idx_agg_dt_arrivee       ON warehouse.agg_demande_transport (wilaya_arrivee_id)")
                cur.execute("CREATE INDEX idx_agg_dt_service       ON warehouse.agg_demande_transport (service_type)")
                cur.execute("CREATE INDEX idx_agg_dt_client_type   ON warehouse.agg_demande_transport (client_type)")
                cur.execute("CREATE INDEX idx_agg_dt_region_depart ON warehouse.agg_demande_transport (region_depart)")
                context.log.info("View recreated with corrected definition (WITH DATA).")
            else:
                cur.execute("REFRESH MATERIALIZED VIEW warehouse.agg_demande_transport")
                context.log.info("Refreshed agg_demande_transport.")

    return MaterializeResult(metadata={"view": MetadataValue.text("agg_demande_transport")})


refresh_agg_performance_livraison = _make_index_fix_asset(
    view_name="agg_performance_livraison",
    fact_deps=["fact_livraisons"],
    ddl=_AGG_PERFORMANCE_LIVRAISON_DDL,
    indexes=[
        "CREATE UNIQUE INDEX idx_agg_perf_unique ON warehouse.agg_performance_livraison "
        "(year, month_num, agence_id, company_id, COALESCE(delivery_type, ''))",
        "CREATE INDEX idx_agg_perf_year_month ON warehouse.agg_performance_livraison (year, month_num)",
        "CREATE INDEX idx_agg_perf_agence     ON warehouse.agg_performance_livraison (agence_id)",
        "CREATE INDEX idx_agg_perf_wilaya     ON warehouse.agg_performance_livraison (wilaya_id)",
        "CREATE INDEX idx_agg_perf_company    ON warehouse.agg_performance_livraison (company_id)",
        "CREATE INDEX idx_agg_perf_region     ON warehouse.agg_performance_livraison (region)",
    ],
    stale_index_name="idx_agg_perf_unique",
    stale_missing_col="company_id",
)

refresh_agg_livraisons_journalieres = _make_index_fix_asset(
    view_name="agg_livraisons_journalieres",
    fact_deps=["fact_livraisons"],
    ddl=_AGG_LIVRAISONS_JOURNALIERES_DDL,
    indexes=[
        "CREATE UNIQUE INDEX idx_agg_lj_unique ON warehouse.agg_livraisons_journalieres "
        "(full_date, agence_id, company_id, COALESCE(delivery_type, ''), status_group)",
        "CREATE INDEX idx_agg_lj_date       ON warehouse.agg_livraisons_journalieres (full_date)",
        "CREATE INDEX idx_agg_lj_year_month ON warehouse.agg_livraisons_journalieres (year, month_num)",
        "CREATE INDEX idx_agg_lj_agence     ON warehouse.agg_livraisons_journalieres (agence_id)",
        "CREATE INDEX idx_agg_lj_wilaya     ON warehouse.agg_livraisons_journalieres (wilaya_id)",
        "CREATE INDEX idx_agg_lj_company    ON warehouse.agg_livraisons_journalieres (company_id)",
        "CREATE INDEX idx_agg_lj_status     ON warehouse.agg_livraisons_journalieres (status_group)",
    ],
    stale_index_name="idx_agg_lj_unique",
    stale_missing_col="company_id",
)


# ---------------------------------------------------------------------------
# Asset list and named exports
# ---------------------------------------------------------------------------

_generated_assets = [_make_refresh_asset(name, deps) for name, deps in _ALL_VIEWS]

agg_assets = _generated_assets + [
    refresh_agg_demande_transport,
    refresh_agg_performance_livraison,
    refresh_agg_livraisons_journalieres,
]

# Named references for explicit imports (generated views only)
(
    refresh_agg_depenses_mensuelles,
    refresh_agg_cout_total_mensuel,
    refresh_agg_masse_salariale_mensuelle,
    refresh_agg_transport_mensuel,
    refresh_agg_profitabilite_colis,
) = _generated_assets
