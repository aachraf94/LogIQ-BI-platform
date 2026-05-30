"""
Paginated row-level queries for the On-demand Transport KPI data table views.

Each function returns {"count": N, "page": p, "page_size": ps, "total_pages": T, "results": [...]}
so the frontend can render a paginated table for any KPI card.

kpi parameter controls:
  - additional WHERE filter (e.g. only completed requests for completion_rate)
  - ORDER BY expression (sort most-relevant column first)

All kpi values are validated against an explicit whitelist before being
interpolated into SQL — no user input ever touches the query string directly.
"""

import math

from django.db import connections

from .transport import _coerce, _rows, _st_filter


# ─── Sort / filter whitelists (SQL injection prevention) ─────────────────────

_OPS_ORDER: dict[str, str] = {
    "ops_total_requests":    "dt.created_date_id DESC, dt.transport_key DESC",
    "ops_completion_rate":   "dt.created_date_id DESC, dt.transport_key DESC",
    "ops_cancellation_rate": "dt.created_date_id DESC, dt.transport_key DESC",
    "ops_avg_distance":      "ftp.distance_real_km DESC NULLS LAST, dt.transport_key DESC",
    "ops_avg_stops":         "ftp.nbr_stops_total DESC NULLS LAST, dt.transport_key DESC",
}

_OPS_FILTER: dict[str, str] = {
    "ops_total_requests":    "",
    "ops_completion_rate":   "AND dts_status.status_name = 'terminée'",
    "ops_cancellation_rate": "AND dts_status.status_name = 'annulée'",
    "ops_avg_distance":      "",
    "ops_avg_stops":         "",
}

_COST_ORDER: dict[str, str] = {
    "cost_total_revenue": "ftb.amount_invoiced DESC NULLS LAST, dt.transport_key DESC",
    "cost_total_cost":    "ftc.total_cost DESC NULLS LAST, dt.transport_key DESC",
    "cost_gross_margin":  "ftb.marge_brute_dzd DESC NULLS LAST, dt.transport_key DESC",
    "cost_margin_pct":    "(ftb.marge_brute_dzd * 100.0 / NULLIF(ftb.amount_invoiced, 0)) DESC NULLS LAST",
    "cost_per_km":        "(ftc.total_cost / NULLIF(ftp.distance_real_km, 0)) DESC NULLS LAST",
}

_PERF_ORDER: dict[str, str] = {
    "perf_on_time_rate":       "ftp.on_time ASC NULLS LAST, dt.created_date_id DESC",
    "perf_avg_duration":       "ftp.total_duration_minutes DESC NULLS LAST",
    "perf_avg_rating":         "ftp.client_rating ASC NULLS LAST",
    "perf_avg_delay":          "ftp.arrival_delay_minutes DESC NULLS LAST",
    "perf_night_shift_rate":   "(CASE WHEN ftp.night_shift_hours > 0 THEN 1 ELSE 0 END) DESC, dt.created_date_id DESC",
}

_PERF_FILTER: dict[str, str] = {
    "perf_on_time_rate":       "AND ftp.on_time IS NOT NULL",
    "perf_avg_duration":       "",
    "perf_avg_rating":         "AND ftp.client_rating IS NOT NULL",
    "perf_avg_delay":          "AND ftp.arrival_delay_minutes IS NOT NULL",
    "perf_night_shift_rate":   "",
}


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

def get_ops_table(start_date, end_date, service_type=None, kpi="ops_total_requests", page=1, page_size=20):
    order_by  = _OPS_ORDER.get(kpi, _OPS_ORDER["ops_total_requests"])
    kpi_filter = _OPS_FILTER.get(kpi, "")
    st_sql, st_args = _st_filter(service_type)

    base_where = f"""
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
          {kpi_filter}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id   = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id    = dt.service_type_id
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key      = dt.transport_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dt.transport_key,
            dt.created_date_id::text                       AS date_creation,
            dts.service_type                               AS type_service,
            dts_status.status_name                         AS statut,
            dw_dep.wilaya_name                             AS wilaya_depart,
            dw_arr.wilaya_name                             AS wilaya_arrivee,
            ROUND(ftp.distance_real_km::numeric, 1)        AS distance_km,
            ftp.nbr_stops_total                            AS nbr_stops
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id   = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id    = dt.service_type_id
        LEFT JOIN warehouse.dim_transport_departure dep      ON dep.departure_key       = dt.departure_key
        LEFT JOIN warehouse.dim_wilaya             dw_dep    ON dw_dep.wilaya_id        = dep.wilaya_id
        LEFT JOIN warehouse.dim_transport_arrival  arr       ON arr.arrival_key         = dt.arrival_key
        LEFT JOIN warehouse.dim_wilaya             dw_arr    ON dw_arr.wilaya_id        = arr.wilaya_id
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key       = dt.transport_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + st_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)


# ─── 2. Cost & Profitability table ────────────────────────────────────────────

def get_cost_table(start_date, end_date, service_type=None, kpi="cost_total_revenue", page=1, page_size=20):
    order_by = _COST_ORDER.get(kpi, _COST_ORDER["cost_total_revenue"])
    st_sql, st_args = _st_filter(service_type)

    base_where = f"""
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id   = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id    = dt.service_type_id
        LEFT JOIN warehouse.fact_transport_billing     ftb   ON ftb.transport_key       = dt.transport_key
        LEFT JOIN warehouse.fact_transport_cost        ftc   ON ftc.transport_key       = dt.transport_key
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key       = dt.transport_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dt.transport_key,
            dt.created_date_id::text                                          AS date_creation,
            dts.service_type                                                   AS type_service,
            dts_status.status_name                                             AS statut,
            ROUND(COALESCE(ftb.amount_invoiced, 0)::numeric, 2)               AS montant_facture,
            ROUND(COALESCE(ftc.total_cost, 0)::numeric, 2)                    AS cout_total,
            ROUND(COALESCE(ftb.marge_brute_dzd, 0)::numeric, 2)               AS marge_brute,
            ROUND(
                (COALESCE(ftb.marge_brute_dzd, 0)
                 * 100.0 / NULLIF(ftb.amount_invoiced, 0))::numeric,
                1
            )                                                                   AS marge_pct,
            ROUND(
                (COALESCE(ftc.total_cost, 0)
                 / NULLIF(ftp.distance_real_km, 0))::numeric,
                2
            )                                                                   AS cout_par_km
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id   = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id    = dt.service_type_id
        LEFT JOIN warehouse.fact_transport_billing     ftb   ON ftb.transport_key       = dt.transport_key
        LEFT JOIN warehouse.fact_transport_cost        ftc   ON ftc.transport_key       = dt.transport_key
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key       = dt.transport_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + st_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)


# ─── 3. Performance table ─────────────────────────────────────────────────────

def get_perf_table(start_date, end_date, service_type=None, kpi="perf_on_time_rate", page=1, page_size=20):
    order_by   = _PERF_ORDER.get(kpi, _PERF_ORDER["perf_on_time_rate"])
    kpi_filter = _PERF_FILTER.get(kpi, "")
    st_sql, st_args = _st_filter(service_type)

    base_where = f"""
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
          {kpi_filter}
    """

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id    = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id     = dt.service_type_id
        LEFT JOIN warehouse.dim_transport_vehicle      dv    ON dv.vehicle_id            = dt.vehicle_id
        LEFT JOIN warehouse.dim_transport_vehicle_type dvt   ON dvt.vehicle_type_id      = dv.vehicle_type_id
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key        = dt.transport_key
        {base_where}
    """

    data_sql = f"""
        SELECT
            dt.transport_key,
            dt.created_date_id::text                                        AS date_creation,
            dts.service_type                                                 AS type_service,
            dvt.vehicle_type                                                 AS type_vehicule,
            ftp.on_time                                                      AS a_l_heure,
            ROUND(
                COALESCE(ftp.total_duration_minutes, 0)::numeric / 60.0,
                2
            )                                                                AS duree_h,
            ftp.client_rating                                                AS note_client,
            ftp.arrival_delay_minutes                                        AS retard_min,
            CASE
                WHEN ftp.night_shift_hours IS NOT NULL
                 AND ftp.night_shift_hours > 0 THEN TRUE
                ELSE FALSE
            END                                                              AS is_nuit
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id    = dt.status_id
        JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id     = dt.service_type_id
        LEFT JOIN warehouse.dim_transport_vehicle      dv    ON dv.vehicle_id            = dt.vehicle_id
        LEFT JOIN warehouse.dim_transport_vehicle_type dvt   ON dvt.vehicle_type_id      = dv.vehicle_type_id
        LEFT JOIN warehouse.fact_transport_performance ftp   ON ftp.transport_key        = dt.transport_key
        {base_where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    base_args = [start_date, end_date] + st_args
    return _run_table(count_sql, data_sql, base_args, base_args, page, page_size)
