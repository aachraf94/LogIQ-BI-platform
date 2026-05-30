"""
Overview page queries — current-month KPIs (vs previous calendar month)
and 6-month activity trend. No filter parameters.
"""

import calendar
from datetime import date as _date
from decimal import Decimal

from django.db import connections


# ─── Utilities ────────────────────────────────────────────────────────────────

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


def _run_one(sql, args):
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        row = cur.fetchone()
        if not row:
            return {}
        cols = [col[0] for col in cur.description]
        return _coerce(dict(zip(cols, row)))


def _run(sql, args):
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        cols = [col[0] for col in cur.description]
        return _coerce([dict(zip(cols, row)) for row in cur.fetchall()])


def _month_bounds():
    """(curr_start, curr_end, prev_start, prev_end) for current vs previous calendar month."""
    today = _date.today()
    curr_start = today.replace(day=1)
    curr_end   = today

    pm = today.month - 1 if today.month > 1 else 12
    py = today.year     if today.month > 1 else today.year - 1
    prev_start = _date(py, pm, 1)
    prev_end   = _date(py, pm, calendar.monthrange(py, pm)[1])

    return (
        curr_start.isoformat(), curr_end.isoformat(),
        prev_start.isoformat(), prev_end.isoformat(),
    )


# ─── 1. Overview KPIs ─────────────────────────────────────────────────────────

def get_kpis():
    """
    5 KPI cards for the overview page.
    Always compares current calendar month vs previous calendar month.

    Returns:
      transport_requests, pop_transport_requests
      transport_on_time_pct, pop_transport_on_time
      parcel_handled, pop_parcel_handled
      parcel_delivery_rate_pct, pop_parcel_delivery_rate
      total_revenue, pop_total_revenue
      transport_revenue, parcel_revenue   (used by revenue-split donut)
    """
    cs, ce, ps, pe = _month_bounds()

    def _fetch_transport(s, e):
        return _run_one("""
            SELECT
                COUNT(*)                                                           AS transport_requests,
                COALESCE(
                    ROUND(
                        COUNT(*) FILTER (WHERE ftp.on_time = TRUE) * 100.0
                        / NULLIF(COUNT(*) FILTER (WHERE ftp.on_time IS NOT NULL), 0),
                        1
                    ),
                    0
                )                                                                  AS transport_on_time_pct,
                COALESCE(SUM(ftb.amount_invoiced), 0)                              AS transport_revenue
            FROM warehouse.dim_transport dt
            LEFT JOIN warehouse.fact_transport_performance ftp
                   ON ftp.transport_key = dt.transport_key
            LEFT JOIN warehouse.fact_transport_billing ftb
                   ON ftb.transport_key = dt.transport_key
            WHERE dt.created_date_id BETWEEN %s AND %s
        """, [s, e])

    def _fetch_parcel(s, e):
        return _run_one("""
            SELECT
                COUNT(*)                                                 AS parcel_handled,
                COUNT(*) FILTER (WHERE dp.current_status_id = 13)       AS nbr_livres,
                COALESCE(SUM(fpr.delivery_fee), 0)                       AS parcel_revenue
            FROM warehouse.dim_parcel dp
            LEFT JOIN warehouse.fact_parcel_revenue fpr
                   ON fpr.parcel_key = dp.parcel_key
            WHERE dp.date_creation_id BETWEEN %s AND %s
        """, [s, e])

    ct = _fetch_transport(cs, ce)
    pt = _fetch_transport(ps, pe)
    cp = _fetch_parcel(cs, ce)
    pp = _fetch_parcel(ps, pe)

    c_req    = ct.get("transport_requests") or 0
    c_ot     = ct.get("transport_on_time_pct") or 0
    c_t_rev  = ct.get("transport_revenue") or 0
    p_req    = pt.get("transport_requests") or 0
    p_ot     = pt.get("transport_on_time_pct") or 0
    p_t_rev  = pt.get("transport_revenue") or 0

    c_handled = cp.get("parcel_handled") or 0
    c_livres  = cp.get("nbr_livres") or 0
    c_p_rev   = cp.get("parcel_revenue") or 0
    p_handled = pp.get("parcel_handled") or 0
    p_livres  = pp.get("nbr_livres") or 0
    p_p_rev   = pp.get("parcel_revenue") or 0

    c_dlv_rate = round(c_livres / c_handled * 100, 1) if c_handled else 0.0
    p_dlv_rate = round(p_livres / p_handled * 100, 1) if p_handled else 0.0
    c_total    = round(float(c_t_rev) + float(c_p_rev), 2)
    p_total    = round(float(p_t_rev) + float(p_p_rev), 2)

    return {
        "transport_requests":        int(c_req),
        "pop_transport_requests":    _pop(c_req, p_req),
        "transport_on_time_pct":     round(float(c_ot), 1),
        "pop_transport_on_time":     _pop(c_ot, p_ot),
        "parcel_handled":            int(c_handled),
        "pop_parcel_handled":        _pop(c_handled, p_handled),
        "parcel_delivery_rate_pct":  c_dlv_rate,
        "pop_parcel_delivery_rate":  _pop(c_dlv_rate, p_dlv_rate),
        "total_revenue":             c_total,
        "pop_total_revenue":         _pop(c_total, p_total),
        "transport_revenue":         round(float(c_t_rev), 2),
        "parcel_revenue":            round(float(c_p_rev), 2),
    }


# ─── 2. Activity Trend ────────────────────────────────────────────────────────

def get_activity_trend():
    """
    Monthly transport requests + parcels handled for the last 6 months
    (5 full calendar months + the current month to date).
    Returns: [{period, transport_requests, parcel_handled}] ordered chronologically.
    """
    today = _date.today()
    y, m = today.year, today.month
    for _ in range(5):
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    trend_start = _date(y, m, 1).isoformat()
    trend_end   = today.isoformat()

    transport = _run("""
        SELECT
            TO_CHAR(dt.created_date_id, 'YYYY-MM') AS period,
            COUNT(*)                               AS transport_requests
        FROM warehouse.dim_transport dt
        WHERE dt.created_date_id BETWEEN %s AND %s
        GROUP BY TO_CHAR(dt.created_date_id, 'YYYY-MM')
        ORDER BY TO_CHAR(dt.created_date_id, 'YYYY-MM')
    """, [trend_start, trend_end])

    parcel = _run("""
        SELECT
            TO_CHAR(dp.date_creation_id, 'YYYY-MM') AS period,
            COUNT(*)                                 AS parcel_handled
        FROM warehouse.dim_parcel dp
        WHERE dp.date_creation_id BETWEEN %s AND %s
        GROUP BY TO_CHAR(dp.date_creation_id, 'YYYY-MM')
        ORDER BY TO_CHAR(dp.date_creation_id, 'YYYY-MM')
    """, [trend_start, trend_end])

    t_dict = {r["period"]: r["transport_requests"] for r in transport}
    p_dict = {r["period"]: r["parcel_handled"]      for r in parcel}
    periods = sorted(set(t_dict) | set(p_dict))

    return [
        {
            "period":             period,
            "transport_requests": t_dict.get(period, 0),
            "parcel_handled":     p_dict.get(period, 0),
        }
        for period in periods
    ]
