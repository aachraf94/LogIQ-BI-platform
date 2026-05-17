"""
Aggregate refresh assets — one asset per materialized view.
Each asset depends on the fact tables that feed it.
Uses REFRESH MATERIALIZED VIEW CONCURRENTLY (requires at least one row and a unique index).
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
    ("agg_demande_transport",         ["fact_transport"]),
    ("agg_profitabilite_colis",       ["fact_livraisons"]),
]


def _make_refresh_asset(view_name: str, fact_deps: list):
    @asset(
        name=f"refresh_{view_name}",
        group_name="aggregates",
        deps=fact_deps,
        description=f"REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.{view_name}",
    )
    def _asset(
        context: AssetExecutionContext,
        warehouse_db: WarehousePostgresResource,
    ) -> MaterializeResult:
        with warehouse_db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.{view_name}"
                )
        context.log.info(f"Refreshed {view_name}")
        return MaterializeResult(metadata={"view": MetadataValue.text(view_name)})

    return _asset


# Build one asset per view
agg_assets = [_make_refresh_asset(name, deps) for name, deps in _ALL_VIEWS]

# Named references for explicit imports
(
    refresh_agg_livraisons_journalieres,
    refresh_agg_depenses_mensuelles,
    refresh_agg_cout_total_mensuel,
    refresh_agg_performance_livraison,
    refresh_agg_masse_salariale_mensuelle,
    refresh_agg_transport_mensuel,
    refresh_agg_demande_transport,
    refresh_agg_profitabilite_colis,
) = agg_assets
