"""
Raw SQL queries for On-demand Transport analytics.

All queries run against the warehouse schema.
Three fact tables join 1:1 on transport_key:
  - fact_transport_cost        (cost components)
  - fact_transport_billing     (revenue, margin)
  - fact_transport_performance (distances, durations, rating, on_time)

Filter convention:
  start_date / end_date  — YYYY-MM-DD strings, filter on dim_transport.created_date_id
  service_type           — optional: 'course_dediee' | 'courrier' | 'manutention'

GROUP BY rule (following parcel_delivery pattern):
  Always group by the actual expression, never by a SELECT alias.
  PostgreSQL technically allows aliases in GROUP BY, but using expressions
  is explicit, portable, and consistent with the rest of the codebase.

COALESCE rule:
  Any ROUND(expr / NULLIF(denom, 0), n) can return NULL when denom=0.
  Always wrap with COALESCE(..., 0) so the JSON never contains null for
  a numeric field (prevents NaN in JavaScript chart sorts/renders).
"""

from datetime import date as _date, timedelta
from decimal import Decimal

from django.db import connections


# ─── Utilities ────────────────────────────────────────────────────────────────

def _rows(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _coerce(obj):
    if isinstance(obj, dict):
        return {k: _coerce(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_coerce(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _pop(curr, prev):
    if not prev:
        return 0.0
    return round((float(curr) - float(prev)) / float(prev) * 100, 1)


def _prev_period(start_str, end_str):
    start = _date.fromisoformat(start_str)
    end   = _date.fromisoformat(end_str)
    delta = end - start
    prev_end   = start - timedelta(days=1)
    prev_start = prev_end - delta
    return prev_start.isoformat(), prev_end.isoformat()


def _st_filter(service_type):
    """Return (sql_snippet, args) for optional service_type filter.
    Requires dim_transport_service_type aliased as dts (already in _BASE)."""
    if service_type and service_type in ("course_dediee", "courrier", "manutention"):
        return "AND dts.service_type = %s", [service_type]
    return "", []


def _run(sql, args):
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        return _coerce(_rows(cur))


def _run_one(sql, args):
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        row = cur.fetchone()
        if not row:
            return {}
        cols = [col[0] for col in cur.description]
        return _coerce(dict(zip(cols, row)))


# ─── Shared FROM/JOIN base ────────────────────────────────────────────────────
# Aliases: dt = dim_transport, dts_status = dim_transport_status,
#          dts = dim_transport_service_type

_BASE = """
    FROM warehouse.dim_transport dt
    LEFT JOIN warehouse.dim_transport_status       dts_status ON dts_status.status_id   = dt.status_id
    LEFT JOIN warehouse.dim_transport_service_type dts        ON dts.service_type_id    = dt.service_type_id
"""

# Reusable expression for period grouping
_PERIOD_EXPR = "TO_CHAR(dt.created_date_id, 'YYYY-MM')"


# ─── 1. Operations KPIs ───────────────────────────────────────────────────────

def get_ops_kpis(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)

    def _fetch(s, e):
        sql = f"""
            SELECT
                COUNT(*)                                                       AS nbr_requests,
                COUNT(*) FILTER (WHERE dts_status.status_name = 'terminée')   AS nbr_terminees,
                COUNT(*) FILTER (WHERE dts_status.status_name = 'annulée')    AS nbr_annulees,
                AVG(ftp.distance_real_km)                                      AS avg_distance_km,
                AVG(ftp.nbr_stops_total)                                       AS avg_stops
            {_BASE}
            LEFT JOIN warehouse.fact_transport_performance ftp
                   ON ftp.transport_key = dt.transport_key
            WHERE dt.created_date_id BETWEEN %s AND %s
              {st_sql}
        """
        return _run_one(sql, [s, e] + st_args)

    curr = _fetch(start_date, end_date)
    prev_s, prev_e = _prev_period(start_date, end_date)
    prev = _fetch(prev_s, prev_e)

    nbr      = curr.get("nbr_requests") or 0
    nbr_term = curr.get("nbr_terminees") or 0
    nbr_ann  = curr.get("nbr_annulees") or 0

    p_nbr      = prev.get("nbr_requests") or 0
    p_nbr_term = prev.get("nbr_terminees") or 0
    p_nbr_ann  = prev.get("nbr_annulees") or 0

    comp_rate   = round((nbr_term / nbr   * 100) if nbr   else 0.0, 1)
    canc_rate   = round((nbr_ann  / nbr   * 100) if nbr   else 0.0, 1)
    p_comp_rate = round((p_nbr_term / p_nbr * 100) if p_nbr else 0.0, 1)
    p_canc_rate = round((p_nbr_ann  / p_nbr * 100) if p_nbr else 0.0, 1)

    return {
        "nbr_requests":          nbr,
        "completion_rate_pct":   comp_rate,
        "cancellation_rate_pct": canc_rate,
        "avg_distance_km":       round(float(curr.get("avg_distance_km") or 0), 1),
        "avg_stops":             round(float(curr.get("avg_stops") or 0), 1),
        "pop_requests":          _pop(nbr, p_nbr),
        "pop_completion_rate":   _pop(comp_rate, p_comp_rate),
        "pop_cancellation_rate": _pop(canc_rate, p_canc_rate),
        "pop_distance":          _pop(curr.get("avg_distance_km") or 0, prev.get("avg_distance_km") or 0),
        "pop_stops":             _pop(curr.get("avg_stops") or 0, prev.get("avg_stops") or 0),
    }


# ─── 2. Monthly Volume Trend ──────────────────────────────────────────────────

def get_monthly_trend(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            {_PERIOD_EXPR}                                                          AS period,
            COUNT(*)                                                                AS nbr_requests,
            COUNT(*) FILTER (WHERE dts_status.status_name = 'terminée')            AS nbr_terminees,
            COUNT(*) FILTER (WHERE dts_status.status_name = 'en_cours')            AS nbr_en_cours,
            COUNT(*) FILTER (WHERE dts_status.status_name = 'annulée')             AS nbr_annulees
        {_BASE}
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY {_PERIOD_EXPR}
        ORDER BY {_PERIOD_EXPR}
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 3. Service Breakdown ─────────────────────────────────────────────────────

def get_service_breakdown(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            dts.service_type                                                      AS service_type,
            COUNT(*)                                                              AS nbr_requests,
            ROUND(
                COUNT(*) FILTER (WHERE dts_status.status_name = 'terminée')
                * 100.0 / NULLIF(COUNT(*), 0), 1
            )                                                                     AS completion_rate_pct
        {_BASE}
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY dts.service_type_id, dts.service_type
        ORDER BY nbr_requests DESC
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 4. OD Matrix ─────────────────────────────────────────────────────────────

def get_od_matrix(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            dw_dep.wilaya_name  AS origin,
            dw_arr.wilaya_name  AS destination,
            COUNT(*)            AS nbr_requests
        {_BASE}
        JOIN warehouse.dim_transport_departure dep    ON dep.departure_key = dt.departure_key
        JOIN warehouse.dim_transport_arrival   arr    ON arr.arrival_key   = dt.arrival_key
        JOIN warehouse.dim_wilaya              dw_dep ON dw_dep.wilaya_id  = dep.wilaya_id
        JOIN warehouse.dim_wilaya              dw_arr ON dw_arr.wilaya_id  = arr.wilaya_id
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY dw_dep.wilaya_id, dw_dep.wilaya_name, dw_arr.wilaya_id, dw_arr.wilaya_name
        HAVING COUNT(*) > 0
        ORDER BY nbr_requests DESC
        LIMIT 500
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 5. Distance Category ─────────────────────────────────────────────────────

def get_distance_category(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            ddc.distance_category   AS distance_category,
            ddc.km_range            AS km_range,
            COUNT(*)                AS nbr_requests
        {_BASE}
        JOIN warehouse.dim_transport_routing dtr ON dtr.routing_profile_key  = dt.routing_profile_key
        JOIN warehouse.dim_distance_category ddc ON ddc.distance_category_id = dtr.distance_category_id
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY ddc.distance_category_id, ddc.distance_category, ddc.km_range
        ORDER BY ddc.distance_category_id
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 6. Cost KPIs ─────────────────────────────────────────────────────────────

def get_cost_kpis(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)

    def _fetch(s, e):
        sql = f"""
            SELECT
                COALESCE(SUM(ftb.amount_invoiced), 0)                             AS total_revenue,
                COALESCE(SUM(ftc.total_cost), 0)                                  AS total_cost,
                COALESCE(SUM(ftb.marge_brute_dzd), 0)                             AS marge_brute_dzd,
                COALESCE(
                    SUM(ftb.marge_brute_dzd) * 100.0
                    / NULLIF(SUM(ftb.amount_invoiced), 0),
                    0
                )                                                                   AS marge_brute_pct,
                COALESCE(
                    SUM(ftc.total_cost) / NULLIF(SUM(ftp.distance_real_km), 0),
                    0
                )                                                                   AS cout_par_km
            {_BASE}
            LEFT JOIN warehouse.fact_transport_billing     ftb ON ftb.transport_key = dt.transport_key
            LEFT JOIN warehouse.fact_transport_cost        ftc ON ftc.transport_key = dt.transport_key
            LEFT JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
            WHERE dt.created_date_id BETWEEN %s AND %s
              {st_sql}
        """
        return _run_one(sql, [s, e] + st_args)

    curr = _fetch(start_date, end_date)
    prev_s, prev_e = _prev_period(start_date, end_date)
    prev = _fetch(prev_s, prev_e)

    return {
        "total_revenue":   round(float(curr.get("total_revenue") or 0), 2),
        "total_cost":      round(float(curr.get("total_cost") or 0), 2),
        "marge_brute_dzd": round(float(curr.get("marge_brute_dzd") or 0), 2),
        "marge_brute_pct": round(float(curr.get("marge_brute_pct") or 0), 1),
        "cout_par_km":     round(float(curr.get("cout_par_km") or 0), 1),
        "pop_revenue":     _pop(curr.get("total_revenue") or 0, prev.get("total_revenue") or 0),
        "pop_cost":        _pop(curr.get("total_cost") or 0, prev.get("total_cost") or 0),
        "pop_margin_dzd":  _pop(curr.get("marge_brute_dzd") or 0, prev.get("marge_brute_dzd") or 0),
        "pop_margin_pct":  _pop(curr.get("marge_brute_pct") or 0, prev.get("marge_brute_pct") or 0),
        "pop_cout_par_km": _pop(curr.get("cout_par_km") or 0, prev.get("cout_par_km") or 0),
    }


# ─── 7. Revenue vs Cost Monthly Trend ────────────────────────────────────────

def get_rev_cost_trend(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            {_PERIOD_EXPR}                                                    AS period,
            COALESCE(SUM(ftb.amount_invoiced), 0)                             AS total_revenue,
            COALESCE(SUM(ftc.total_cost), 0)                                  AS total_cost,
            COALESCE(SUM(ftb.marge_brute_dzd), 0)                             AS marge_brute_dzd,
            COALESCE(
                ROUND(
                    SUM(ftb.marge_brute_dzd) * 100.0
                    / NULLIF(SUM(ftb.amount_invoiced), 0),
                    1
                ),
                0
            )                                                                   AS marge_brute_pct
        {_BASE}
        LEFT JOIN warehouse.fact_transport_billing ftb ON ftb.transport_key = dt.transport_key
        LEFT JOIN warehouse.fact_transport_cost    ftc ON ftc.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY {_PERIOD_EXPR}
        ORDER BY {_PERIOD_EXPR}
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 8. Cost Categories ───────────────────────────────────────────────────────

_COST_LABELS = {
    "cout_base":          "Tarif de base",
    "cout_carburant":     "Carburant",
    "cout_assurance":     "Assurance",
    "cout_distance_supp": "Distance supp.",
    "cout_manutention":   "Manutention",
    "cout_peage":         "Péage",
    "cout_emballage":     "Emballage",
    "cout_tarif_nuit":    "Tarif nuit",
}

def get_cost_categories(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            COALESCE(SUM(ftc.cout_base),          0) AS cout_base,
            COALESCE(SUM(ftc.cout_carburant),      0) AS cout_carburant,
            COALESCE(SUM(ftc.cout_assurance),      0) AS cout_assurance,
            COALESCE(SUM(ftc.cout_distance_supp),  0) AS cout_distance_supp,
            COALESCE(SUM(ftc.cout_manutention),    0) AS cout_manutention,
            COALESCE(SUM(ftc.cout_peage),          0) AS cout_peage,
            COALESCE(SUM(ftc.cout_emballage),      0) AS cout_emballage,
            COALESCE(SUM(ftc.cout_tarif_nuit),     0) AS cout_tarif_nuit
        {_BASE}
        JOIN warehouse.fact_transport_cost ftc ON ftc.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
    """
    row = _run_one(sql, [start_date, end_date] + st_args)
    return [
        {"category": key, "label": _COST_LABELS[key], "total_dzd": round(float(row.get(key) or 0), 2)}
        for key in _COST_LABELS
    ]


# ─── 9. Cost Per KM by Vehicle Type ──────────────────────────────────────────

def get_cost_per_km(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            dvt.vehicle_type                                                  AS vehicle_type,
            COUNT(dt.transport_key)                                           AS nbr_requests,
            COALESCE(SUM(ftc.total_cost), 0)                                  AS total_cost,
            COALESCE(SUM(ftp.distance_real_km), 0)                            AS total_km,
            COALESCE(
                ROUND(
                    SUM(ftc.total_cost) / NULLIF(SUM(ftp.distance_real_km), 0),
                    1
                ),
                0
            )                                                                   AS cout_par_km
        {_BASE}
        JOIN warehouse.dim_transport_vehicle      dv  ON dv.vehicle_id      = dt.vehicle_id
        JOIN warehouse.dim_transport_vehicle_type dvt ON dvt.vehicle_type_id = dv.vehicle_type_id
        LEFT JOIN warehouse.fact_transport_cost        ftc ON ftc.transport_key = dt.transport_key
        LEFT JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY dvt.vehicle_type_id, dvt.vehicle_type
        ORDER BY cout_par_km ASC
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 10. Top Corridors ────────────────────────────────────────────────────────

def get_top_corridors(start_date, end_date, service_type=None, limit=8):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            dw_dep.wilaya_name || ' → ' || dw_arr.wilaya_name   AS corridor,
            COUNT(dt.transport_key)                              AS nbr_requests,
            COALESCE(SUM(ftb.amount_invoiced), 0)               AS total_revenue,
            COALESCE(
                ROUND(
                    SUM(ftb.marge_brute_dzd) * 100.0
                    / NULLIF(SUM(ftb.amount_invoiced), 0),
                    1
                ),
                0
            )                                                    AS taux_marge_pct
        {_BASE}
        JOIN warehouse.dim_transport_departure dep    ON dep.departure_key = dt.departure_key
        JOIN warehouse.dim_transport_arrival   arr    ON arr.arrival_key   = dt.arrival_key
        JOIN warehouse.dim_wilaya              dw_dep ON dw_dep.wilaya_id  = dep.wilaya_id
        JOIN warehouse.dim_wilaya              dw_arr ON dw_arr.wilaya_id  = arr.wilaya_id
        LEFT JOIN warehouse.fact_transport_billing ftb ON ftb.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
          AND dw_dep.wilaya_id != dw_arr.wilaya_id
        GROUP BY dw_dep.wilaya_id, dw_dep.wilaya_name, dw_arr.wilaya_id, dw_arr.wilaya_name
        ORDER BY taux_marge_pct DESC
        LIMIT %s
    """
    return _run(sql, [start_date, end_date] + st_args + [int(limit)])


# ─── 11. Performance KPIs ─────────────────────────────────────────────────────

def get_perf_kpis(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)

    def _fetch(s, e):
        sql = f"""
            SELECT
                COALESCE(
                    ROUND(
                        COUNT(*) FILTER (WHERE ftp.on_time = TRUE) * 100.0
                        / NULLIF(COUNT(*) FILTER (WHERE ftp.on_time IS NOT NULL), 0),
                        1
                    ),
                    0
                )                                                   AS on_time_rate_pct,
                COALESCE(
                    ROUND(AVG(ftp.total_duration_minutes) / 60.0, 1),
                    0
                )                                                   AS avg_duration_h,
                COALESCE(ROUND(AVG(ftp.client_rating), 1), 0)      AS avg_client_rating,
                COALESCE(ROUND(AVG(ftp.arrival_delay_minutes), 0), 0) AS avg_arrival_delay_min,
                COALESCE(
                    ROUND(
                        COUNT(*) FILTER (
                            WHERE ftp.night_shift_hours IS NOT NULL
                              AND ftp.night_shift_hours > 0
                        ) * 100.0 / NULLIF(COUNT(*), 0),
                        1
                    ),
                    0
                )                                                   AS night_shift_rate_pct
            {_BASE}
            LEFT JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
            WHERE dt.created_date_id BETWEEN %s AND %s
              {st_sql}
        """
        return _run_one(sql, [s, e] + st_args)

    curr = _fetch(start_date, end_date)
    prev_s, prev_e = _prev_period(start_date, end_date)
    prev = _fetch(prev_s, prev_e)

    return {
        "on_time_rate_pct":      round(float(curr.get("on_time_rate_pct") or 0), 1),
        "avg_duration_h":        round(float(curr.get("avg_duration_h") or 0), 1),
        "avg_client_rating":     round(float(curr.get("avg_client_rating") or 0), 1),
        "avg_arrival_delay_min": round(float(curr.get("avg_arrival_delay_min") or 0), 0),
        "night_shift_rate_pct":  round(float(curr.get("night_shift_rate_pct") or 0), 1),
        "pop_on_time":     _pop(curr.get("on_time_rate_pct") or 0,     prev.get("on_time_rate_pct") or 0),
        "pop_duration":    _pop(curr.get("avg_duration_h") or 0,       prev.get("avg_duration_h") or 0),
        "pop_rating":      _pop(curr.get("avg_client_rating") or 0,    prev.get("avg_client_rating") or 0),
        "pop_delay":       _pop(curr.get("avg_arrival_delay_min") or 0, prev.get("avg_arrival_delay_min") or 0),
        "pop_night_shift": _pop(curr.get("night_shift_rate_pct") or 0, prev.get("night_shift_rate_pct") or 0),
    }


# ─── 12. On-Time Monthly Trend ────────────────────────────────────────────────

def get_on_time_trend(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            {_PERIOD_EXPR}                                                       AS period,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE ftp.on_time = TRUE) * 100.0
                    / NULLIF(COUNT(*) FILTER (WHERE ftp.on_time IS NOT NULL), 0),
                    1
                ),
                0
            )                                                                    AS on_time_rate_pct,
            COALESCE(
                ROUND(AVG(ftp.total_duration_minutes) / 60.0, 1),
                0
            )                                                                    AS avg_duration_h
        {_BASE}
        LEFT JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY {_PERIOD_EXPR}
        ORDER BY {_PERIOD_EXPR}
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 13. Delay Buckets ────────────────────────────────────────────────────────

_DELAY_CASE = """
    CASE
        WHEN ftp.arrival_delay_minutes <  0  THEN 'Avance'
        WHEN ftp.arrival_delay_minutes <= 15 THEN '0–15 min'
        WHEN ftp.arrival_delay_minutes <= 30 THEN '15–30 min'
        WHEN ftp.arrival_delay_minutes <= 60 THEN '30–60 min'
        ELSE '> 60 min'
    END
"""
_DELAY_ORDER_CASE = """
    CASE
        WHEN ftp.arrival_delay_minutes <  0  THEN 1
        WHEN ftp.arrival_delay_minutes <= 15 THEN 2
        WHEN ftp.arrival_delay_minutes <= 30 THEN 3
        WHEN ftp.arrival_delay_minutes <= 60 THEN 4
        ELSE 5
    END
"""

def get_delay_buckets(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            {_DELAY_CASE}       AS bucket,
            {_DELAY_ORDER_CASE} AS bucket_order,
            COUNT(*)            AS nbr_requests
        {_BASE}
        JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
          AND ftp.arrival_delay_minutes IS NOT NULL
          AND dts_status.status_name = 'terminée'
        GROUP BY {_DELAY_CASE}, {_DELAY_ORDER_CASE}
        ORDER BY {_DELAY_ORDER_CASE}
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 14. Rating Buckets ───────────────────────────────────────────────────────

def get_rating_buckets(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            ftp.client_rating   AS rating,
            COUNT(*)            AS nbr_requests
        {_BASE}
        JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
          AND ftp.client_rating IS NOT NULL
        GROUP BY ftp.client_rating
        ORDER BY ftp.client_rating
    """
    return _run(sql, [start_date, end_date] + st_args)


# ─── 15. Vehicle Performance ──────────────────────────────────────────────────

def get_vehicle_perf(start_date, end_date, service_type=None):
    st_sql, st_args = _st_filter(service_type)
    sql = f"""
        SELECT
            dvt.vehicle_type                                                  AS vehicle_type,
            COUNT(dt.transport_key)                                           AS nbr_requests,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE ftp.on_time = TRUE) * 100.0
                    / NULLIF(COUNT(*) FILTER (WHERE ftp.on_time IS NOT NULL), 0),
                    1
                ),
                0
            )                                                                   AS on_time_rate_pct,
            COALESCE(
                ROUND(AVG(ftp.total_duration_minutes) / 60.0, 1),
                0
            )                                                                   AS avg_duration_h
        {_BASE}
        JOIN warehouse.dim_transport_vehicle      dv  ON dv.vehicle_id      = dt.vehicle_id
        JOIN warehouse.dim_transport_vehicle_type dvt ON dvt.vehicle_type_id = dv.vehicle_type_id
        LEFT JOIN warehouse.fact_transport_performance ftp ON ftp.transport_key = dt.transport_key
        WHERE dt.created_date_id BETWEEN %s AND %s
          {st_sql}
        GROUP BY dvt.vehicle_type_id, dvt.vehicle_type
        ORDER BY on_time_rate_pct DESC
    """
    return _run(sql, [start_date, end_date] + st_args)
