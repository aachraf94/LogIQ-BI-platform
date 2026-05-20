"""
Aggregate refresh assets — one asset per materialized view.
Each asset depends on the fact tables that feed it.
"""

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource

_ALL_VIEWS = [
    ("agg_livraisons_journalieres",  ["fact_livraisons"]),
    ("agg_depenses_mensuelles",       ["fact_depenses"]),
    ("agg_cout_total_mensuel",        ["fact_depenses", "fact_bulletins_salaire", "fact_paiements_livreurs"]),
    ("agg_performance_livraison",     ["fact_livraisons"]),
    ("agg_masse_salariale_mensuelle", ["fact_bulletins_salaire"]),
    ("agg_transport_mensuel",         ["fact_transport"]),
    ("agg_profitabilite_colis",       ["fact_livraisons"]),
]

# Corrected DDL for agg_demande_transport: is_ramadan removed from SELECT and GROUP BY.
# It split monthly rows into sub-monthly rows (Ramadan straddles month boundaries),
# causing UniqueViolation on idx_agg_dt_unique which does not include is_ramadan.
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


# Build one asset per view
_generated_assets = [_make_refresh_asset(name, deps) for name, deps in _ALL_VIEWS]
agg_assets = _generated_assets + [refresh_agg_demande_transport]

# Named references for explicit imports
(
    refresh_agg_livraisons_journalieres,
    refresh_agg_depenses_mensuelles,
    refresh_agg_cout_total_mensuel,
    refresh_agg_performance_livraison,
    refresh_agg_masse_salariale_mensuelle,
    refresh_agg_transport_mensuel,
    refresh_agg_profitabilite_colis,
) = _generated_assets
