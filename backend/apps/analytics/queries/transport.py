"""
Raw SQL queries for transport analytics.

All queries run against warehouse.agg_transport_mensuel and
warehouse.agg_demande_transport (pre-aggregated materialized views),
plus warehouse.fact_transport for delay distribution (custom bucketing).
"""

from decimal import Decimal

from django.db import connections


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _rows(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _coerce(obj):
    """Recursively convert Decimal → float for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _coerce(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_coerce(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _where_mensuel(year=None, month=None, service_type=None, company_id=None):
    """Build a WHERE snippet and args list for agg_transport_mensuel filters."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if service_type and service_type != "all":
        conds.append("service_type = %s")
        args.append(service_type)
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    snippet = ("AND " + " AND ".join(conds)) if conds else ""
    return snippet, args


def _prev_period(year, month):
    if not year:
        return None, None
    if not month:
        # Yearly view: compare to the same full year one year prior (YoY)
        return int(year) - 1, None
    y, m = int(year), int(month)
    return (y - 1, 12) if m == 1 else (y, m - 1)


def _mom(curr, prev):
    """Month-over-month % change. Returns 0 when prev is zero."""
    if not prev:
        return 0.0
    return round((float(curr) - float(prev)) / float(prev) * 100, 1)


# ─── Summary ──────────────────────────────────────────────────────────────────

def get_summary(year=None, month=None, service_type=None, company_id=None):
    """
    Aggregate KPIs for the selected period.
    Returns current-period metrics, derived rates, and MoM deltas.
    """
    w, a = _where_mensuel(year, month, service_type, company_id)
    sql = f"""
        SELECT
            COALESCE(SUM(nbr_requests), 0)                                              AS total_requests,
            COALESCE(SUM(nbr_terminees), 0)                                             AS total_terminees,
            COALESCE(SUM(nbr_annulees), 0)                                              AS total_annulees,
            COALESCE(SUM(nbr_en_cours), 0)                                              AS total_en_cours,
            COALESCE(SUM(total_facture_dzd), 0)                                         AS total_revenue,
            COALESCE(SUM(total_marge_brute_dzd), 0)                                     AS total_marge,
            COALESCE(SUM(total_km), 0)                                                  AS total_km,
            COALESCE(SUM(total_cout_dzd), 0)                                            AS total_cost,
            COALESCE(SUM(total_poids_kg), 0)                                            AS total_poids_kg,
            COALESCE(SUM(nbr_payes), 0)                                                 AS total_payes,
            COALESCE(SUM(total_pieces), 0)                                              AS total_pieces,
            COALESCE(
                SUM(total_cout_dzd) / NULLIF(SUM(nbr_terminees), 0),
                0
            )                                                                           AS avg_cout_par_demande,
            COALESCE(
                SUM(total_cout_dzd) / NULLIF(SUM(total_pieces), 0),
                0
            )                                                                           AS avg_cout_par_piece,
            COALESCE(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                0
            )                                                                           AS avg_ponctualite_pct,
            COALESCE(
                SUM(avg_note_client * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                0
            )                                                                           AS avg_note_client,
            COALESCE(
                SUM(avg_retard_arrivee_min * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                0
            )                                                                           AS avg_retard_arrivee_min
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)

    c = _coerce(rows[0]) if rows else {}

    tr    = c.get("total_requests") or 0
    tt    = c.get("total_terminees") or 0
    ta    = c.get("total_annulees") or 0
    rev   = c.get("total_revenue") or 0
    marge = c.get("total_marge") or 0
    km    = c.get("total_km") or 0
    cost  = c.get("total_cost") or 0
    payes = c.get("total_payes") or 0
    ponct = c.get("avg_ponctualite_pct") or 0

    derived = {
        "completion_rate":   round(tt / tr * 100, 1) if tr else 0.0,
        "gross_margin_pct":  round(marge / rev * 100, 1) if rev else 0.0,
        "cancellation_rate": round(ta / tr * 100, 1) if tr else 0.0,
        "cost_per_km":       round(cost / km, 1) if km else 0.0,
        "collection_rate":   round(payes / tt * 100, 1) if tt else 0.0,
    }

    # MoM comparison
    py, pm = _prev_period(year, month)
    pw, pa = _where_mensuel(py, pm, service_type, company_id)
    prev_sql = f"""
        SELECT
            COALESCE(SUM(nbr_requests), 0)                                              AS total_requests,
            COALESCE(SUM(nbr_terminees), 0)                                             AS total_terminees,
            COALESCE(SUM(nbr_annulees), 0)                                              AS total_annulees,
            COALESCE(SUM(total_facture_dzd), 0)                                         AS total_revenue,
            COALESCE(SUM(total_marge_brute_dzd), 0)                                     AS total_marge,
            COALESCE(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                0
            )                                                                           AS avg_ponctualite_pct
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {pw}
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(prev_sql, pa)
        prev_rows = _rows(cur)

    p = _coerce(prev_rows[0]) if prev_rows else {}
    prev_tr   = p.get("total_requests") or 0
    prev_tt   = p.get("total_terminees") or 0
    prev_ta   = p.get("total_annulees") or 0
    prev_rev   = p.get("total_revenue") or 0
    prev_marge = p.get("total_marge") or 0
    prev_margin_pct       = round(prev_marge / prev_rev * 100, 1) if prev_rev else 0.0
    prev_completion_rate  = round(prev_tt / prev_tr * 100, 1) if prev_tr else 0.0
    prev_cancellation_rate = round(prev_ta / prev_tr * 100, 1) if prev_tr else 0.0

    derived["mom_requests"]          = _mom(tr, prev_tr)
    derived["mom_revenue"]           = _mom(rev, prev_rev)
    derived["mom_margin"]            = _mom(derived["gross_margin_pct"], prev_margin_pct)
    derived["mom_on_time"]           = _mom(ponct, p.get("avg_ponctualite_pct") or 0)
    derived["mom_completion_rate"]   = _mom(derived["completion_rate"], prev_completion_rate)
    # Negated: a decrease in cancellation rate is a positive signal → show green
    derived["mom_cancellation_rate"] = -_mom(derived["cancellation_rate"], prev_cancellation_rate)

    # Avg stops per completed request — not in aggregate, query fact_transport directly
    stop_conds = ["ft.status = 'terminée'"]
    stop_args  = []
    if year:
        stop_conds.append("d.year = %s");       stop_args.append(int(year))
    if month:
        stop_conds.append("d.month_num = %s");  stop_args.append(int(month))
    if service_type and service_type != "all":
        stop_conds.append("ft.service_type = %s"); stop_args.append(service_type)
    with connections["warehouse"].cursor() as cur:
        cur.execute(
            "SELECT ROUND(COALESCE(AVG(ft.nbr_stops_total), 0)::numeric, 1) AS avg_arrets_par_demande"
            " FROM warehouse.fact_transport ft"
            " JOIN warehouse.dim_date d ON ft.date_creation_key = d.date_key"
            " WHERE " + " AND ".join(stop_conds),
            stop_args,
        )
        stop_rows = _rows(cur)
    c["avg_arrets_par_demande"] = float(
        _coerce(stop_rows[0]).get("avg_arrets_par_demande", 0) or 0
    )

    return {"current": c, "derived": derived}


# ─── Trends ───────────────────────────────────────────────────────────────────

def get_trends(service_type=None, company_id=None, from_year_month=None, to_year_month=None):
    """Monthly time-series: volume, revenue, cost, margin, on-time rate."""
    conds, args = [], []
    if service_type and service_type != "all":
        conds.append("service_type = %s")
        args.append(service_type)
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    if from_year_month:
        conds.append("year_month >= %s")
        args.append(from_year_month)
    if to_year_month:
        conds.append("year_month <= %s")
        args.append(to_year_month)
    w = ("AND " + " AND ".join(conds)) if conds else ""

    sql = f"""
        SELECT
            year_month,
            year,
            month_num,
            month_name_fr,
            SUM(nbr_requests)                                                           AS nbr_requests,
            SUM(nbr_terminees)                                                          AS nbr_terminees,
            SUM(nbr_annulees)                                                           AS nbr_annulees,
            SUM(total_facture_dzd)                                                      AS total_revenue,
            SUM(total_cout_dzd)                                                         AS total_cost,
            SUM(total_marge_brute_dzd)                                                  AS total_marge,
            SUM(total_km)                                                               AS total_km,
            ROUND(
                SUM(total_marge_brute_dzd) / NULLIF(SUM(total_facture_dzd), 0) * 100,
                2
            )                                                                           AS taux_marge_pct,
            ROUND(SUM(total_cout_dzd) / NULLIF(SUM(total_km), 0), 2)                   AS cout_par_km,
            ROUND(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS taux_ponctualite_pct
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
        GROUP BY year_month, year, month_num, month_name_fr
        ORDER BY year, month_num
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Cost breakdown ───────────────────────────────────────────────────────────

def get_cost_breakdown(year=None, month=None, service_type=None):
    """Cost component breakdown for the selected period (donut/stacked bar)."""
    w, a = _where_mensuel(year, month, service_type)
    sql = f"""
        SELECT
            COALESCE(SUM(total_cout_dzd), 0)                AS total_cost,
            COALESCE(SUM(total_cout_base_dzd), 0)           AS cout_base,
            COALESCE(SUM(total_cout_distance_supp_dzd), 0)  AS cout_distance_supp,
            COALESCE(SUM(total_cout_assurance_dzd), 0)      AS cout_assurance,
            COALESCE(SUM(total_cout_carburant_dzd), 0)      AS cout_carburant,
            COALESCE(SUM(total_cout_manutention_dzd), 0)    AS cout_manutention
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)

    row = _coerce(rows[0]) if rows else {}
    total = row.get("total_cost") or 0
    known = (
        (row.get("cout_base") or 0)
        + (row.get("cout_distance_supp") or 0)
        + (row.get("cout_assurance") or 0)
        + (row.get("cout_carburant") or 0)
        + (row.get("cout_manutention") or 0)
    )
    row["cout_autres"] = round(max(0.0, total - known), 2)
    return row


# ─── By service type ──────────────────────────────────────────────────────────

def get_by_service(year=None, month=None):
    """Volume, revenue, margin, and performance grouped by service type."""
    w, a = _where_mensuel(year, month)
    sql = f"""
        SELECT
            service_type,
            COALESCE(sub_service_type, 'N/A')                                           AS sub_service_type,
            SUM(nbr_requests)                                                           AS nbr_requests,
            SUM(nbr_terminees)                                                          AS nbr_terminees,
            SUM(total_facture_dzd)                                                      AS total_revenue,
            SUM(total_marge_brute_dzd)                                                  AS total_marge,
            SUM(total_cout_dzd)                                                         AS total_cost,
            ROUND(
                SUM(total_marge_brute_dzd) / NULLIF(SUM(total_facture_dzd), 0) * 100,
                2
            )                                                                           AS taux_marge_pct,
            ROUND(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS taux_ponctualite_pct,
            ROUND(
                SUM(avg_note_client * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS avg_note_client
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
        GROUP BY service_type, COALESCE(sub_service_type, 'N/A')
        ORDER BY SUM(nbr_requests) DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)
    return _coerce(rows)


# ─── By vehicle type ──────────────────────────────────────────────────────────

def get_by_vehicle(year=None, month=None, service_type=None):
    """Cost efficiency and performance grouped by vehicle type."""
    w, a = _where_mensuel(year, month, service_type)
    sql = f"""
        SELECT
            vehicle_type,
            payload_class,
            SUM(nbr_requests)                                                           AS nbr_requests,
            SUM(total_km)                                                               AS total_km,
            SUM(total_cout_dzd)                                                         AS total_cost,
            ROUND(SUM(total_cout_dzd) / NULLIF(SUM(total_km), 0), 2)                   AS cout_par_km,
            ROUND(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS taux_ponctualite_pct,
            ROUND(
                SUM(avg_note_client * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS avg_note_client
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
        GROUP BY vehicle_type, payload_class
        ORDER BY SUM(nbr_requests) DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Corridors ────────────────────────────────────────────────────────────────

_ALLOWED_CORRIDOR_SORT = {"nbr_requests", "total_revenue", "taux_marge_pct", "avg_distance_km"}


def get_corridors(year=None, month=None, service_type=None, client_type=None,
                  limit=15, sort_by="nbr_requests"):
    """Top OD corridors ranked by the chosen metric."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if service_type and service_type != "all":
        conds.append("service_type = %s")
        args.append(service_type)
    if client_type and client_type != "all":
        conds.append("client_type = %s")
        args.append(client_type)
    w = ("AND " + " AND ".join(conds)) if conds else ""

    order = sort_by if sort_by in _ALLOWED_CORRIDOR_SORT else "nbr_requests"

    sql = f"""
        SELECT
            wilaya_depart_name,
            wilaya_arrivee_name,
            region_depart,
            region_arrivee,
            meme_region,
            SUM(nbr_requests)                                                           AS nbr_requests,
            SUM(nbr_terminees)                                                          AS nbr_terminees,
            SUM(total_cout_dzd)                                                         AS total_cost,
            SUM(total_facture_dzd)                                                      AS total_revenue,
            SUM(total_marge_brute_dzd)                                                  AS total_marge,
            ROUND(
                SUM(total_marge_brute_dzd) / NULLIF(SUM(total_facture_dzd), 0) * 100,
                2
            )                                                                           AS taux_marge_pct,
            ROUND(AVG(avg_distance_reelle_km), 1)                                       AS avg_distance_km,
            ROUND(AVG(avg_cout_par_km_dzd), 2)                                          AS cout_par_km
        FROM warehouse.agg_demande_transport
        WHERE 1=1 {w}
        GROUP BY wilaya_depart_name, wilaya_arrivee_name, region_depart, region_arrivee, meme_region
        ORDER BY {order} DESC
        LIMIT %s
    """
    args.append(int(limit))
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── OD Matrix ────────────────────────────────────────────────────────────────

def get_od_matrix(year=None, month=None):
    """Region-level origin × destination matrix (3×3 max)."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    w = ("AND " + " AND ".join(conds)) if conds else ""

    sql = f"""
        SELECT
            region_depart                                                               AS origin,
            region_arrivee                                                              AS destination,
            SUM(nbr_requests)                                                           AS nbr_requests,
            ROUND(
                SUM(total_marge_brute_dzd) / NULLIF(SUM(total_facture_dzd), 0) * 100,
                2
            )                                                                           AS taux_marge_pct
        FROM warehouse.agg_demande_transport
        WHERE 1=1 {w}
        GROUP BY region_depart, region_arrivee
        ORDER BY nbr_requests DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── By agency ────────────────────────────────────────────────────────────────

def get_by_agency(year=None, month=None, region=None, service_type=None):
    """Agency-level performance ranking."""
    conds, args = ["agence_id IS NOT NULL"], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if region and region != "all":
        conds.append("region = %s")
        args.append(region)
    if service_type and service_type != "all":
        conds.append("service_type = %s")
        args.append(service_type)
    w = "AND " + " AND ".join(conds)

    sql = f"""
        SELECT
            agence_id,
            agence_name,
            wilaya_dispatch_name,
            region,
            SUM(nbr_requests)                                                           AS nbr_requests,
            SUM(nbr_terminees)                                                          AS nbr_terminees,
            SUM(total_facture_dzd)                                                      AS total_revenue,
            SUM(total_marge_brute_dzd)                                                  AS total_marge,
            SUM(total_km)                                                               AS total_km,
            SUM(total_cout_dzd)                                                         AS total_cost,
            ROUND(SUM(nbr_terminees) * 100.0 / NULLIF(SUM(nbr_requests), 0), 1)        AS completion_rate,
            ROUND(
                SUM(taux_ponctualite_pct * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                1
            )                                                                           AS taux_ponctualite_pct,
            ROUND(
                SUM(avg_note_client * nbr_terminees) / NULLIF(SUM(nbr_terminees), 0),
                2
            )                                                                           AS avg_note_client,
            ROUND(
                SUM(total_marge_brute_dzd) / NULLIF(SUM(total_facture_dzd), 0) * 100,
                1
            )                                                                           AS taux_marge_pct,
            ROUND(SUM(total_cout_dzd) / NULLIF(SUM(total_km), 0), 1)                   AS cout_par_km
        FROM warehouse.agg_transport_mensuel
        WHERE 1=1 {w}
        GROUP BY agence_id, agence_name, wilaya_dispatch_name, region
        ORDER BY SUM(nbr_requests) DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Delay distribution ───────────────────────────────────────────────────────

def get_delay_distribution(year=None, month=None, service_type=None):
    """Arrival-delay histogram bucketed into 5 bands."""
    conds, args = ["ft.status = 'terminée'"], []
    if year:
        conds.append("d.year = %s")
        args.append(int(year))
    if month:
        conds.append("d.month_num = %s")
        args.append(int(month))
    if service_type and service_type != "all":
        conds.append("ft.service_type = %s")
        args.append(service_type)
    w = " AND ".join(conds)

    sql = f"""
        WITH bucketed AS (
            SELECT
                CASE
                    WHEN ft.arrival_delay_minutes IS NULL OR ft.arrival_delay_minutes <= 0
                        THEN 0
                    WHEN ft.arrival_delay_minutes <= 15  THEN 1
                    WHEN ft.arrival_delay_minutes <= 30  THEN 2
                    WHEN ft.arrival_delay_minutes <= 60  THEN 3
                    ELSE 4
                END AS bucket_order,
                CASE
                    WHEN ft.arrival_delay_minutes IS NULL OR ft.arrival_delay_minutes <= 0
                        THEN 'À l''heure'
                    WHEN ft.arrival_delay_minutes <= 15  THEN '1-15 min'
                    WHEN ft.arrival_delay_minutes <= 30  THEN '16-30 min'
                    WHEN ft.arrival_delay_minutes <= 60  THEN '31-60 min'
                    ELSE '> 60 min'
                END AS bucket
            FROM warehouse.fact_transport ft
            JOIN warehouse.dim_date d ON ft.date_creation_key = d.date_key
            WHERE {w}
        )
        SELECT bucket, COUNT(*) AS count
        FROM bucketed
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)
