"""
Paginated row-level queries for the Parcel Delivery KPI data table views.

Each function returns {"count": N, "page": p, "page_size": ps, "total_pages": T, "results": [...]}
so the frontend can render a paginated table for any KPI card.

Table grain:
  - ops / perf : one row per dim_parcel, filtered on date_creation_id
  - cost       : one row per dim_parcel with a terminal date, filtered on date_terminal_id

All kpi / delivery_type values are validated against whitelists before interpolation.
"""

import math

from django.db import connections

from .parcel_delivery import _coerce, _rows, _dt_filter


# ─── Sort / filter whitelists ─────────────────────────────────────────────────

_OPS_ORDER: dict[str, str] = {
    "ops_total_parcels":   "dp.date_creation_id DESC, dp.parcel_key DESC",
    "ops_delivered":       "dp.date_creation_id DESC, dp.parcel_key DESC",
    "ops_returns":         "dp.date_creation_id DESC, dp.parcel_key DESC",
    "ops_in_transit":      "dp.date_creation_id DESC, dp.parcel_key DESC",
    "ops_avg_duration":    "fpp.duree_totale_minutes DESC NULLS LAST, dp.parcel_key DESC",
}

_OPS_FILTER: dict[str, str] = {
    "ops_total_parcels":   "",
    "ops_delivered":       "AND ps.status_id = 13",
    "ops_returns":         "AND ps.status_id = 19",
    "ops_in_transit":      "AND ps.is_terminal = FALSE",
    "ops_avg_duration":    "",
}

_COST_ORDER: dict[str, str] = {
    "cost_fees_collected": "fpr.delivery_fee DESC NULLS LAST, dp.parcel_key DESC",
    "cost_total_cost":     "fpr.delivery_fee DESC NULLS LAST, dp.parcel_key DESC",
    "cost_gross_margin":   "fpr.ecart_tarif DESC NULLS LAST, dp.parcel_key DESC",
    "cost_avg_fee":        "fpr.delivery_fee DESC NULLS LAST, dp.parcel_key DESC",
    "cost_per_delivery":   "fpr.delivery_fee DESC NULLS LAST, dp.parcel_key DESC",
}

_PERF_ORDER: dict[str, str] = {
    "perf_delivery_rate":       "dp.date_creation_id DESC, dp.parcel_key DESC",
    "perf_avg_attempts":        "fpp.nbr_tentatives_livraison DESC NULLS LAST, dp.parcel_key DESC",
    "perf_first_attempt_rate":  "dp.date_creation_id DESC, dp.parcel_key DESC",
    "perf_avg_duration":        "fpp.duree_totale_minutes DESC NULLS LAST, dp.parcel_key DESC",
    "perf_claims_count":        "dp.date_creation_id DESC, dp.parcel_key DESC",
}

_PERF_FILTER: dict[str, str] = {
    "perf_delivery_rate":       "",
    "perf_avg_attempts":        "AND ps.status_id = 13",
    "perf_first_attempt_rate":  "AND ps.status_id = 13 AND COALESCE(fpp.nbr_tentatives_livraison, 0) = 0",
    "perf_avg_duration":        "AND ps.status_id = 13 AND fpp.duree_totale_minutes IS NOT NULL",
    "perf_claims_count":        "",
}


# ─── Date range probe ─────────────────────────────────────────────────────────

def get_parcel_date_range():
    """Return the min/max date_creation_id and total row count in dim_parcel."""
    with connections["warehouse"].cursor() as cur:
        cur.execute("""
            SELECT
                MIN(date_creation_id)::text AS min_date,
                MAX(date_creation_id)::text AS max_date,
                COUNT(*)                    AS total_count
            FROM warehouse.dim_parcel
        """)
        row = cur.fetchone()
    if not row or row[0] is None:
        return {"min_date": None, "max_date": None, "total_count": 0}
    return {"min_date": row[0], "max_date": row[1], "total_count": int(row[2])}


# ─── Pagination helpers ───────────────────────────────────────────────────────

def _paginate(count: int, page: int, page_size: int):
    total_pages = max(1, math.ceil(count / page_size))
    page = max(1, min(page, total_pages))
    offset = (page - 1) * page_size
    return page, total_pages, offset


def _run_table(count_sql, data_sql, count_args, data_args, page, page_size):
    with connections["warehouse"].cursor() as cur:
        cur.execute(count_sql, count_args)
        count = cur.fetchone()[0]

    page, total_pages, offset = _paginate(count, page, page_size)

    with connections["warehouse"].cursor() as cur:
        cur.execute(data_sql, data_args + [page_size, offset])
        results = _coerce(_rows(cur))

    return {
        "count":       count,
        "page":        page,
        "page_size":   page_size,
        "total_pages": total_pages,
        "results":     results,
    }


# ─── 1. Operations table ──────────────────────────────────────────────────────

def get_parcel_ops_table(
    start_date, end_date,
    delivery_type=None, kpi="ops_total_parcels",
    page=1, page_size=20,
):
    order_by   = _OPS_ORDER.get(kpi, _OPS_ORDER["ops_total_parcels"])
    kpi_filter = _OPS_FILTER.get(kpi, "")
    dt_sql, dt_args = _dt_filter(delivery_type)

    base_where = f"""
        WHERE dp.date_creation_id BETWEEN %s AND %s
          {dt_sql}
          {kpi_filter}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status    ps    ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type     ddt   ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.fact_parcel_performance fpp ON fpp.parcel_key        = dp.parcel_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dp.tracking                                                    AS tracking,
            dp.date_creation_id::text                                      AS date_creation,
            ddt.type_code                                                  AS type_livraison,
            ps.status_name                                                 AS statut,
            dc_dep.code                                                    AS code_depart,
            dc_dest.code                                                   AS code_destination,
            ROUND(
                COALESCE(fpp.duree_totale_minutes, 0)::numeric / 60.0,
                1
            )                                                              AS duree_h,
            COALESCE(fpp.nbr_tentatives_livraison, 0)                     AS nbr_tentatives
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status    ps     ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type     ddt    ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.dim_center            dc_dep  ON dc_dep.center_id     = dp.center_depart_key
        LEFT JOIN warehouse.dim_center            dc_dest ON dc_dest.center_id    = dp.center_destination_key
        LEFT JOIN warehouse.fact_parcel_performance fpp  ON fpp.parcel_key        = dp.parcel_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + dt_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)


# ─── 2. Cost & Profitability table ────────────────────────────────────────────

def get_parcel_cost_table(
    start_date, end_date,
    delivery_type=None, kpi="cost_fees_collected",
    page=1, page_size=20,
):
    order_by = _COST_ORDER.get(kpi, _COST_ORDER["cost_fees_collected"])
    dt_sql, dt_args = _dt_filter(delivery_type)

    # Cost KPIs are based on resolved parcels — filter on date_terminal_id
    base_where = f"""
        WHERE dp.date_terminal_id BETWEEN %s AND %s
          {dt_sql}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status  ps    ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type   ddt   ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.dim_zone            dz    ON dz.zone_id            = dp.zone_id
        LEFT JOIN warehouse.fact_parcel_revenue fpr   ON fpr.parcel_key        = dp.parcel_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dp.tracking                                                    AS tracking,
            dp.date_terminal_id::text                                      AS date_terminal,
            ddt.type_code                                                  AS type_livraison,
            ps.status_name                                                 AS statut,
            dz.zone_num                                                    AS zone_num,
            ROUND(COALESCE(fpr.delivery_fee,     0)::numeric, 2)          AS frais_livraison,
            ROUND(COALESCE(fpr.tarif_theorique,  0)::numeric, 2)          AS tarif_reference,
            ROUND(COALESCE(fpr.ecart_tarif,      0)::numeric, 2)          AS ecart_tarif
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status  ps    ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type   ddt   ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.dim_zone            dz    ON dz.zone_id            = dp.zone_id
        LEFT JOIN warehouse.fact_parcel_revenue fpr   ON fpr.parcel_key        = dp.parcel_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + dt_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)


# ─── 3. Performance table ─────────────────────────────────────────────────────

def get_parcel_perf_table(
    start_date, end_date,
    delivery_type=None, kpi="perf_delivery_rate",
    page=1, page_size=20,
):
    order_by   = _PERF_ORDER.get(kpi, _PERF_ORDER["perf_delivery_rate"])
    kpi_filter = _PERF_FILTER.get(kpi, "")
    dt_sql, dt_args = _dt_filter(delivery_type)

    base_where = f"""
        WHERE dp.date_creation_id BETWEEN %s AND %s
          {dt_sql}
          {kpi_filter}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status    ps    ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type     ddt   ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.fact_parcel_performance fpp ON fpp.parcel_key        = dp.parcel_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dp.tracking                                                    AS tracking,
            dp.date_creation_id::text                                      AS date_creation,
            ddt.type_code                                                  AS type_livraison,
            ps.status_name                                                 AS statut,
            dc_dep.code                                                    AS code_depart,
            COALESCE(fpp.nbr_tentatives_livraison, 0)                     AS nbr_tentatives,
            ROUND(
                COALESCE(fpp.duree_totale_minutes, 0)::numeric / 60.0,
                1
            )                                                              AS duree_h,
            CASE
                WHEN fpp.nbr_tentatives_livraison IS NOT NULL
                 AND fpp.nbr_tentatives_livraison = 0 THEN TRUE
                ELSE FALSE
            END                                                            AS premier_essai
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_parcels_status    ps     ON ps.status_id         = dp.current_status_id
        LEFT JOIN warehouse.dim_delivery_type     ddt    ON ddt.delivery_type_id  = dp.delivery_type_id
        LEFT JOIN warehouse.dim_center            dc_dep ON dc_dep.center_id      = dp.center_depart_key
        LEFT JOIN warehouse.fact_parcel_performance fpp  ON fpp.parcel_key        = dp.parcel_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + dt_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)
