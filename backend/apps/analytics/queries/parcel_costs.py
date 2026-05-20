"""
Raw SQL queries for parcel cost analytics.

Sources:
- warehouse.agg_profitabilite_colis        grain: month × agence × zone × delivery_type
- warehouse.agg_performance_livraison      grain: month × agence × delivery_type
- warehouse.agg_livraisons_journalieres    grain: day × agence × delivery_type × status_group
- warehouse.agg_depenses_mensuelles        grain: month × agence × nature
- warehouse.agg_cout_total_mensuel         grain: month × agence
- warehouse.fact_livraisons                grain: one row per parcel — always filter by year+month
- warehouse.fact_remboursements            grain: one row per sinistre — small table
- warehouse.fact_paiements_livreurs        grain: one row per payment period per driver
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


def _prev_period(year, month):
    if not year or not month:
        return None, None
    y, m = int(year), int(month)
    return (y - 1, 12) if m == 1 else (y, m - 1)


def _mom(curr, prev):
    """Month-over-month % change. Returns 0 when prev is zero."""
    if not prev:
        return 0.0
    return round((float(curr) - float(prev)) / float(prev) * 100, 1)


def _where_perf(year=None, month=None, company_id=None, agence_id=None,
                delivery_type=None, region=None):
    """WHERE snippet for agg_performance_livraison and agg_profitabilite_colis.
    Both views expose agence_id (HRForce business key) as a denormalized column."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    if agence_id:
        conds.append("agence_id = %s")
        args.append(int(agence_id))
    if delivery_type and delivery_type != "all":
        conds.append("delivery_type = %s")
        args.append(delivery_type)
    if region and region != "all":
        conds.append("region = %s")
        args.append(region)
    return ("AND " + " AND ".join(conds)) if conds else "", args


def _where_costs(year=None, month=None, company_id=None, agence_id=None,
                 region=None):
    """WHERE snippet for agg_cout_total_mensuel and agg_depenses_mensuelles
    (no delivery_type dimension in these views)."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    if agence_id:
        conds.append("agence_id = %s")
        args.append(int(agence_id))
    if region and region != "all":
        conds.append("region = %s")
        args.append(region)
    return ("AND " + " AND ".join(conds)) if conds else "", args


def _where_ym_perf(from_ym=None, to_ym=None, company_id=None, agence_id=None,
                   delivery_type=None):
    """WHERE snippet for trend queries (year_month range) on views with delivery_type."""
    conds, args = [], []
    if from_ym:
        conds.append("year_month >= %s")
        args.append(from_ym)
    if to_ym:
        conds.append("year_month <= %s")
        args.append(to_ym)
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    if agence_id:
        conds.append("agence_id = %s")
        args.append(int(agence_id))
    if delivery_type and delivery_type != "all":
        conds.append("delivery_type = %s")
        args.append(delivery_type)
    return ("AND " + " AND ".join(conds)) if conds else "", args


def _where_ym_costs(from_ym=None, to_ym=None, company_id=None, agence_id=None):
    """WHERE snippet for trend queries (year_month range) on views without delivery_type."""
    conds, args = [], []
    if from_ym:
        conds.append("year_month >= %s")
        args.append(from_ym)
    if to_ym:
        conds.append("year_month <= %s")
        args.append(to_ym)
    if company_id:
        conds.append("company_id = %s")
        args.append(int(company_id))
    if agence_id:
        conds.append("agence_id = %s")
        args.append(int(agence_id))
    return ("AND " + " AND ".join(conds)) if conds else "", args


# ─── Summary ──────────────────────────────────────────────────────────────────

def get_summary(year=None, month=None, company_id=None, agence_id=None,
                delivery_type=None):
    """
    Aggregate KPIs for the selected period.

    Three separate queries (performance, PCC, cost) merged in Python,
    plus a previous-period performance query for MoM deltas.
    """
    w_perf, a_perf = _where_perf(year, month, company_id, agence_id, delivery_type)
    w_costs, a_costs = _where_costs(year, month, company_id, agence_id)

    perf_sql = f"""
        SELECT
            COALESCE(SUM(nbr_colis_total), 0)                                           AS nbr_colis,
            COALESCE(SUM(nbr_livres), 0)                                                AS nbr_livres,
            COALESCE(SUM(nbr_retours), 0)                                               AS nbr_retours,
            COALESCE(SUM(nbr_echecs), 0)                                                AS nbr_echecs,
            COALESCE(SUM(total_fees_dzd), 0)                                            AS total_fees,
            COALESCE(SUM(fees_livres_dzd), 0)                                           AS fees_livres,
            COALESCE(
                SUM(avg_duree_livree_minutes * nbr_livres) / NULLIF(SUM(nbr_livres), 0),
                0
            )                                                                           AS avg_duree_min
        FROM warehouse.agg_performance_livraison
        WHERE 1=1 {w_perf}
    """

    pcc_sql = f"""
        SELECT
            COALESCE(SUM(nbr_colis_total), 0)                                           AS nbr_avec_tarif,
            COALESCE(SUM(nbr_sous_tarif), 0)                                            AS nbr_sous_tarif,
            COALESCE(SUM(nbr_sur_tarif), 0)                                             AS nbr_sur_tarif,
            COALESCE(SUM(total_fees_dzd), 0)                                            AS total_fees_pcc,
            COALESCE(SUM(total_tarif_theorique_dzd), 0)                                 AS total_tarif_theorique,
            COALESCE(SUM(total_ecart_dzd), 0)                                           AS total_ecart,
            COALESCE(AVG(avg_ecart_dzd), 0)                                             AS avg_ecart
        FROM warehouse.agg_profitabilite_colis
        WHERE 1=1 {w_perf}
    """

    costs_sql = f"""
        SELECT
            COALESCE(SUM(cout_total_dzd), 0)                                            AS cout_total,
            COALESCE(SUM(total_depenses_dzd), 0)                                        AS total_depenses,
            COALESCE(SUM(total_cout_employeur_dzd), 0)                                  AS total_salaires,
            COALESCE(SUM(total_freelance_dzd), 0)                                       AS total_freelance,
            COALESCE(SUM(nbr_employes_payes), 0)                                        AS nbr_employes,
            COALESCE(SUM(nbr_livreurs_freelance), 0)                                    AS nbr_freelance
        FROM warehouse.agg_cout_total_mensuel
        WHERE 1=1 {w_costs}
    """

    with connections["warehouse"].cursor() as cur:
        cur.execute(perf_sql, a_perf)
        rows = _rows(cur)
    perf = _coerce(rows[0]) if rows else {}

    with connections["warehouse"].cursor() as cur:
        cur.execute(pcc_sql, a_perf)
        rows = _rows(cur)
    pcc = _coerce(rows[0]) if rows else {}

    with connections["warehouse"].cursor() as cur:
        cur.execute(costs_sql, a_costs)
        rows = _rows(cur)
    costs = _coerce(rows[0]) if rows else {}

    nbr_colis  = perf.get("nbr_colis") or 0
    nbr_livres = perf.get("nbr_livres") or 0
    nbr_retours = perf.get("nbr_retours") or 0
    total_fees = perf.get("total_fees") or 0
    nbr_sous   = pcc.get("nbr_sous_tarif") or 0
    nbr_avec   = pcc.get("nbr_avec_tarif") or 0
    cout_total = costs.get("cout_total") or 0

    derived = {
        "taux_livraison_pct":  round(nbr_livres / nbr_colis * 100, 1) if nbr_colis else 0.0,
        "taux_retour_pct":     round(nbr_retours / nbr_colis * 100, 1) if nbr_colis else 0.0,
        "taux_sous_tarif_pct": round(nbr_sous / nbr_avec * 100, 1) if nbr_avec else 0.0,
        "avg_fee_par_colis":   round(total_fees / nbr_colis, 1) if nbr_colis else 0.0,
        "cout_par_colis_livre": round(cout_total / nbr_livres, 1) if nbr_livres else 0.0,
    }

    # MoM comparison (delivery rate + volume + revenue)
    py, pm = _prev_period(year, month)
    pw, pa = _where_perf(py, pm, company_id, agence_id, delivery_type)
    prev_pcc_w, prev_pcc_a = _where_perf(py, pm, company_id, agence_id, delivery_type)

    prev_perf_sql = f"""
        SELECT
            COALESCE(SUM(nbr_colis_total), 0) AS nbr_colis,
            COALESCE(SUM(nbr_livres), 0)      AS nbr_livres,
            COALESCE(SUM(total_fees_dzd), 0)  AS total_fees
        FROM warehouse.agg_performance_livraison
        WHERE 1=1 {pw}
    """
    prev_pcc_sql = f"""
        SELECT
            COALESCE(SUM(nbr_colis_total), 0) AS nbr_avec_tarif,
            COALESCE(SUM(nbr_sous_tarif), 0)  AS nbr_sous_tarif
        FROM warehouse.agg_profitabilite_colis
        WHERE 1=1 {prev_pcc_w}
    """

    with connections["warehouse"].cursor() as cur:
        cur.execute(prev_perf_sql, pa)
        rows = _rows(cur)
    pp = _coerce(rows[0]) if rows else {}

    with connections["warehouse"].cursor() as cur:
        cur.execute(prev_pcc_sql, prev_pcc_a)
        rows = _rows(cur)
    ppcc = _coerce(rows[0]) if rows else {}

    prev_nbr  = pp.get("nbr_colis") or 0
    prev_fees = pp.get("total_fees") or 0
    prev_livres = pp.get("nbr_livres") or 0
    prev_avec = ppcc.get("nbr_avec_tarif") or 0
    prev_sous = ppcc.get("nbr_sous_tarif") or 0
    prev_compliance = round((1 - prev_sous / prev_avec) * 100, 1) if prev_avec else 0.0
    curr_compliance = round((1 - nbr_sous / nbr_avec) * 100, 1) if nbr_avec else 0.0

    derived["mom_colis"]       = _mom(nbr_colis, prev_nbr)
    derived["mom_fees"]        = _mom(total_fees, prev_fees)
    derived["mom_livraison"]   = _mom(nbr_livres / nbr_colis * 100 if nbr_colis else 0,
                                       prev_livres / prev_nbr * 100 if prev_nbr else 0)
    derived["mom_compliance"]  = _mom(curr_compliance, prev_compliance)

    return {"current": perf, "pcc": pcc, "costs": costs, "derived": derived}


# ─── Trends ───────────────────────────────────────────────────────────────────

def get_trends(from_year_month=None, to_year_month=None, company_id=None,
               agence_id=None, delivery_type=None):
    """
    Monthly time-series combining performance, PCC, and cost metrics.

    Uses three CTEs joined on (year, month_num); cost CTE lacks delivery_type
    so it may overcount when filtering by delivery_type — total costs are
    always for the full agency regardless of delivery mix.
    """
    w_p, a_p = _where_ym_perf(from_year_month, to_year_month, company_id, agence_id,
                               delivery_type)
    w_c, a_c = _where_ym_costs(from_year_month, to_year_month, company_id, agence_id)

    sql = f"""
        WITH perf AS (
            SELECT
                year, month_num, year_month, month_name_fr,
                SUM(nbr_colis_total)                                                    AS nbr_colis,
                SUM(nbr_livres)                                                         AS nbr_livres,
                SUM(nbr_retours)                                                        AS nbr_retours,
                SUM(total_fees_dzd)                                                     AS total_fees,
                ROUND(SUM(nbr_livres) * 100.0 / NULLIF(SUM(nbr_colis_total), 0), 2)    AS taux_livraison_pct,
                ROUND(SUM(nbr_retours) * 100.0 / NULLIF(SUM(nbr_colis_total), 0), 2)   AS taux_retour_pct,
                ROUND(
                    SUM(avg_duree_livree_minutes * nbr_livres) / NULLIF(SUM(nbr_livres), 0),
                    1
                )                                                                       AS avg_duree_min
            FROM warehouse.agg_performance_livraison
            WHERE 1=1 {w_p}
            GROUP BY year, month_num, year_month, month_name_fr
        ),
        pcc AS (
            SELECT
                year, month_num,
                SUM(nbr_colis_total)                                                    AS nbr_avec_tarif,
                SUM(nbr_sous_tarif)                                                     AS nbr_sous_tarif,
                SUM(total_ecart_dzd)                                                    AS total_ecart,
                ROUND(
                    SUM(nbr_sous_tarif) * 100.0 / NULLIF(SUM(nbr_colis_total), 0),
                    2
                )                                                                       AS taux_sous_tarif_pct
            FROM warehouse.agg_profitabilite_colis
            WHERE 1=1 {w_p}
            GROUP BY year, month_num
        ),
        costs AS (
            SELECT
                year, month_num,
                SUM(cout_total_dzd)       AS cout_total,
                SUM(total_depenses_dzd)   AS total_depenses,
                SUM(total_freelance_dzd)  AS total_freelance
            FROM warehouse.agg_cout_total_mensuel
            WHERE 1=1 {w_c}
            GROUP BY year, month_num
        )
        SELECT
            p.year_month,
            p.year,
            p.month_num,
            p.month_name_fr,
            p.nbr_colis,
            p.nbr_livres,
            p.nbr_retours,
            p.total_fees,
            p.taux_livraison_pct,
            p.taux_retour_pct,
            p.avg_duree_min,
            COALESCE(pc.nbr_sous_tarif, 0)     AS nbr_sous_tarif,
            COALESCE(pc.total_ecart, 0)        AS total_ecart_dzd,
            COALESCE(pc.taux_sous_tarif_pct, 0) AS taux_sous_tarif_pct,
            COALESCE(c.cout_total, 0)          AS cout_total,
            COALESCE(c.total_depenses, 0)      AS total_depenses,
            COALESCE(c.total_freelance, 0)     AS total_freelance,
            ROUND(
                COALESCE(c.cout_total, 0) / NULLIF(p.nbr_livres, 0),
                2
            )                                  AS cout_par_colis_livre
        FROM perf p
        LEFT JOIN pcc pc ON p.year = pc.year AND p.month_num = pc.month_num
        LEFT JOIN costs c ON p.year = c.year AND p.month_num = c.month_num
        ORDER BY p.year, p.month_num
    """
    args = a_p + a_p + a_c
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── PCC summary ──────────────────────────────────────────────────────────────

def get_pcc_summary(year=None, month=None, company_id=None, agence_id=None,
                    delivery_type=None):
    """Detailed PCC metrics for the selected period from agg_profitabilite_colis."""
    w, a = _where_perf(year, month, company_id, agence_id, delivery_type)
    sql = f"""
        SELECT
            COALESCE(SUM(nbr_colis_total), 0)                                           AS nbr_colis,
            COALESCE(SUM(nbr_avec_tarif), 0)                                            AS nbr_avec_tarif,
            COALESCE(SUM(nbr_sous_tarif), 0)                                            AS nbr_sous_tarif,
            COALESCE(SUM(nbr_sur_tarif), 0)                                             AS nbr_sur_tarif,
            COALESCE(SUM(nbr_au_tarif), 0)                                              AS nbr_au_tarif,
            COALESCE(SUM(total_fees_dzd), 0)                                            AS total_fees,
            COALESCE(SUM(total_tarif_theorique_dzd), 0)                                 AS total_tarif_theorique,
            COALESCE(SUM(total_ecart_dzd), 0)                                           AS total_ecart_dzd,
            ROUND(COALESCE(AVG(avg_ecart_dzd), 0), 2)                                  AS avg_ecart_dzd,
            ROUND(COALESCE(AVG(avg_ecart_absolu_dzd), 0), 2)                           AS avg_ecart_absolu_dzd,
            ROUND(
                SUM(nbr_sous_tarif) * 100.0 / NULLIF(SUM(nbr_avec_tarif), 0),
                2
            )                                                                           AS taux_sous_tarif_pct,
            ROUND(
                SUM(total_ecart_dzd) * 100.0 / NULLIF(SUM(total_tarif_theorique_dzd), 0),
                2
            )                                                                           AS taux_ecart_global_pct
        FROM warehouse.agg_profitabilite_colis
        WHERE 1=1 {w}
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)
    return _coerce(rows[0]) if rows else {}


# ─── PCC by agency ────────────────────────────────────────────────────────────

_ALLOWED_PCC_AGENCY_SORT = {
    "nbr_sous_tarif", "taux_sous_tarif_pct", "total_ecart_dzd", "nbr_colis_total",
}


def get_pcc_by_agency(year=None, month=None, region=None, delivery_type=None,
                      sort_by="nbr_sous_tarif", limit=20):
    """PCC compliance ranking by agency."""
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if region and region != "all":
        conds.append("region = %s")
        args.append(region)
    if delivery_type and delivery_type != "all":
        conds.append("delivery_type = %s")
        args.append(delivery_type)
    w = ("AND " + " AND ".join(conds)) if conds else ""

    order = sort_by if sort_by in _ALLOWED_PCC_AGENCY_SORT else "nbr_sous_tarif"

    sql = f"""
        SELECT
            agence_id,
            agence_name,
            wilaya_name,
            region,
            SUM(nbr_colis_total)                                                        AS nbr_colis_total,
            SUM(nbr_avec_tarif)                                                         AS nbr_avec_tarif,
            SUM(nbr_sous_tarif)                                                         AS nbr_sous_tarif,
            SUM(nbr_sur_tarif)                                                          AS nbr_sur_tarif,
            SUM(total_fees_dzd)                                                         AS total_fees,
            SUM(total_tarif_theorique_dzd)                                              AS total_tarif_theorique,
            SUM(total_ecart_dzd)                                                        AS total_ecart_dzd,
            ROUND(
                SUM(nbr_sous_tarif) * 100.0 / NULLIF(SUM(nbr_avec_tarif), 0),
                2
            )                                                                           AS taux_sous_tarif_pct,
            ROUND(AVG(avg_ecart_dzd), 2)                                               AS avg_ecart_dzd
        FROM warehouse.agg_profitabilite_colis
        WHERE agence_id IS NOT NULL {w}
        GROUP BY agence_id, agence_name, wilaya_name, region
        ORDER BY {order} DESC
        LIMIT %s
    """
    args.append(int(limit))
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Ecart distribution ───────────────────────────────────────────────────────

def get_ecart_distribution(year, month, agence_id=None):
    """
    Ecart tarif histogram bucketed into 6 bands.
    year and month are required — fact_livraisons is large.
    """
    conds = ["d.year = %s", "d.month_num = %s"]
    args = [int(year), int(month)]
    if agence_id:
        # dim_agence.agency_id is the HRForce business key
        conds.append("da.agency_id = %s")
        args.append(int(agence_id))

    agence_join = (
        "JOIN warehouse.dim_agence da ON fl.agence_origine_key = da.agence_key"
        if agence_id else ""
    )
    w = " AND ".join(conds)

    sql = f"""
        WITH bucketed AS (
            SELECT
                CASE
                    WHEN fl.ecart_tarif_dzd IS NULL             THEN 5
                    WHEN fl.ecart_tarif_dzd < -500              THEN 0
                    WHEN fl.ecart_tarif_dzd BETWEEN -500 AND -100 THEN 1
                    WHEN fl.ecart_tarif_dzd BETWEEN -100 AND -1  THEN 2
                    WHEN fl.ecart_tarif_dzd = 0                  THEN 3
                    WHEN fl.ecart_tarif_dzd BETWEEN 1 AND 100    THEN 4
                    ELSE                                              5
                END                     AS bucket_order,
                CASE
                    WHEN fl.ecart_tarif_dzd IS NULL             THEN 'Sans tarif théorique'
                    WHEN fl.ecart_tarif_dzd < -500              THEN '< -500 DZD'
                    WHEN fl.ecart_tarif_dzd BETWEEN -500 AND -100 THEN '-500 à -100 DZD'
                    WHEN fl.ecart_tarif_dzd BETWEEN -100 AND -1  THEN '-100 à -1 DZD'
                    WHEN fl.ecart_tarif_dzd = 0                  THEN 'Au tarif exactement'
                    WHEN fl.ecart_tarif_dzd BETWEEN 1 AND 100    THEN '+1 à +100 DZD'
                    ELSE                                              '> +100 DZD'
                END                     AS bucket,
                fl.ecart_tarif_dzd
            FROM warehouse.fact_livraisons fl
            JOIN warehouse.dim_date d ON fl.date_creation_key = d.date_key
            {agence_join}
            WHERE {w}
        )
        SELECT
            bucket,
            bucket_order,
            COUNT(*)                    AS nbr_colis,
            COALESCE(SUM(ecart_tarif_dzd), 0) AS sum_ecart_dzd
        FROM bucketed
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── PCC by wilaya destination ────────────────────────────────────────────────

def get_pcc_by_wilaya(year, month, agence_id=None):
    """
    Under-pricing rate and ecart by destination wilaya.
    year and month are required — fact_livraisons is large.
    """
    conds = ["d.year = %s", "d.month_num = %s", "fl.wilaya_destination_key IS NOT NULL"]
    args = [int(year), int(month)]
    if agence_id:
        conds.append("da.agency_id = %s")
        args.append(int(agence_id))

    agence_join = (
        "JOIN warehouse.dim_agence da ON fl.agence_origine_key = da.agence_key"
        if agence_id else ""
    )
    w = " AND ".join(conds)

    sql = f"""
        SELECT
            dw.wilaya_name,
            dw.region,
            COUNT(*)                                                                    AS nbr_colis,
            COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd IS NOT NULL)                     AS nbr_avec_tarif,
            COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd < 0)                             AS nbr_sous_tarif,
            COALESCE(SUM(fl.ecart_tarif_dzd), 0)                                       AS sum_ecart_dzd,
            ROUND(AVG(fl.ecart_tarif_dzd), 2)                                          AS avg_ecart_dzd,
            ROUND(
                COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd < 0) * 100.0
                / NULLIF(COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd IS NOT NULL), 0),
                2
            )                                                                           AS taux_sous_tarif_pct
        FROM warehouse.fact_livraisons fl
        JOIN warehouse.dim_date d ON fl.date_creation_key = d.date_key
        JOIN warehouse.dim_wilaya dw ON fl.wilaya_destination_key = dw.wilaya_key
        {agence_join}
        WHERE {w}
        GROUP BY dw.wilaya_name, dw.region
        ORDER BY nbr_sous_tarif DESC
        LIMIT 58
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Cost structure ───────────────────────────────────────────────────────────

def get_cost_structure(year=None, month=None, company_id=None, agence_id=None):
    """
    Cost component breakdown (expenses + payroll + freelance + sinistres)
    for the selected period.
    """
    w_costs, a_costs = _where_costs(year, month, company_id, agence_id)

    costs_sql = f"""
        SELECT
            COALESCE(SUM(cout_total_dzd), 0)            AS cout_total,
            COALESCE(SUM(total_depenses_dzd), 0)        AS total_depenses,
            COALESCE(SUM(total_cout_employeur_dzd), 0)  AS total_salaires,
            COALESCE(SUM(total_freelance_dzd), 0)       AS total_freelance,
            COALESCE(SUM(nbr_depenses), 0)              AS nbr_depenses,
            COALESCE(SUM(nbr_employes_payes), 0)        AS nbr_employes_payes,
            COALESCE(SUM(nbr_livreurs_freelance), 0)    AS nbr_livreurs_freelance,
            COALESCE(SUM(nbr_colis_livres_freelance), 0) AS nbr_colis_livres_freelance
        FROM warehouse.agg_cout_total_mensuel
        WHERE 1=1 {w_costs}
    """

    # sinistres come from fact_remboursements (small table — direct query)
    sin_conds, sin_args = [], []
    if year:
        sin_conds.append("d.year = %s")
        sin_args.append(int(year))
    if month:
        sin_conds.append("d.month_num = %s")
        sin_args.append(int(month))
    if agence_id:
        sin_conds.append("da.agency_id = %s")
        sin_args.append(int(agence_id))
    sin_w = "AND " + " AND ".join(sin_conds) if sin_conds else ""

    sin_sql = f"""
        SELECT
            COUNT(*)                                    AS nbr_sinistres,
            COALESCE(SUM(fr.montant_rembourse), 0)      AS total_sinistres
        FROM warehouse.fact_remboursements fr
        JOIN warehouse.dim_date d ON fr.date_remboursement_key = d.date_key
        JOIN warehouse.dim_agence da ON fr.agence_key = da.agence_key
        WHERE 1=1 {sin_w}
    """

    with connections["warehouse"].cursor() as cur:
        cur.execute(costs_sql, a_costs)
        rows = _rows(cur)
    result = _coerce(rows[0]) if rows else {}

    with connections["warehouse"].cursor() as cur:
        cur.execute(sin_sql, sin_args)
        rows = _rows(cur)
    sin = _coerce(rows[0]) if rows else {}

    result["total_sinistres"] = sin.get("total_sinistres") or 0.0
    result["nbr_sinistres"]   = sin.get("nbr_sinistres") or 0
    result["cout_total_avec_sinistres"] = round(
        (result.get("cout_total") or 0) + result["total_sinistres"], 2
    )
    return result


# ─── Cost by nature ───────────────────────────────────────────────────────────

def get_cost_by_nature(year=None, month=None, agence_id=None):
    """Expense breakdown by category and nature from agg_depenses_mensuelles."""
    w, a = _where_costs(year, month, agence_id=agence_id)
    sql = f"""
        SELECT
            category_group,
            nature_name,
            SUM(montant_total_dzd)      AS total_dzd,
            SUM(nbr_depenses_validees)  AS nbr_depenses,
            ROUND(AVG(montant_moyen_dzd), 2) AS avg_depense_dzd
        FROM warehouse.agg_depenses_mensuelles
        WHERE 1=1 {w}
        GROUP BY category_group, nature_name
        ORDER BY SUM(montant_total_dzd) DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Agency scorecard (quadrant scatter) ──────────────────────────────────────

def get_by_agency(year=None, month=None, region=None, delivery_type=None):
    """
    Agency scorecard joining performance, PCC, and cost aggregates.
    Powers both the quadrant scatter chart and the sortable agency table.
    """
    w_p, a_p = _where_perf(year, month, region=region, delivery_type=delivery_type)
    w_c, a_c = _where_costs(year, month, region=region)

    sql = f"""
        WITH perf AS (
            SELECT
                agence_id,
                agence_name,
                wilaya_name,
                region,
                SUM(nbr_colis_total)                                                    AS nbr_colis,
                SUM(nbr_livres)                                                         AS nbr_livres,
                SUM(nbr_retours)                                                        AS nbr_retours,
                SUM(total_fees_dzd)                                                     AS total_fees,
                ROUND(
                    SUM(nbr_livres) * 100.0 / NULLIF(SUM(nbr_colis_total), 0),
                    2
                )                                                                       AS taux_livraison,
                ROUND(
                    SUM(nbr_retours) * 100.0 / NULLIF(SUM(nbr_colis_total), 0),
                    2
                )                                                                       AS taux_retour,
                ROUND(
                    SUM(avg_duree_livree_minutes * nbr_livres) / NULLIF(SUM(nbr_livres), 0),
                    1
                )                                                                       AS avg_duree_min
            FROM warehouse.agg_performance_livraison
            WHERE agence_id IS NOT NULL {w_p}
            GROUP BY agence_id, agence_name, wilaya_name, region
        ),
        pcc AS (
            SELECT
                agence_id,
                SUM(nbr_colis_total)                                                    AS nbr_pcc_colis,
                SUM(nbr_sous_tarif)                                                     AS nbr_sous_tarif,
                SUM(total_ecart_dzd)                                                    AS total_ecart,
                ROUND(
                    SUM(nbr_sous_tarif) * 100.0 / NULLIF(SUM(nbr_avec_tarif), 0),
                    2
                )                                                                       AS taux_sous_tarif
            FROM warehouse.agg_profitabilite_colis
            WHERE agence_id IS NOT NULL {w_p}
            GROUP BY agence_id
        ),
        costs AS (
            SELECT
                agence_id,
                SUM(cout_total_dzd) AS cout_total
            FROM warehouse.agg_cout_total_mensuel
            WHERE agence_id IS NOT NULL {w_c}
            GROUP BY agence_id
        )
        SELECT
            p.agence_id,
            p.agence_name,
            p.wilaya_name,
            p.region,
            p.nbr_colis,
            p.nbr_livres,
            p.nbr_retours,
            p.total_fees,
            p.taux_livraison,
            p.taux_retour,
            p.avg_duree_min,
            COALESCE(pc.nbr_sous_tarif, 0)   AS nbr_sous_tarif,
            COALESCE(pc.total_ecart, 0)      AS total_ecart_dzd,
            COALESCE(pc.taux_sous_tarif, 0)  AS taux_sous_tarif_pct,
            COALESCE(c.cout_total, 0)        AS cout_total,
            ROUND(
                COALESCE(c.cout_total, 0) / NULLIF(p.nbr_livres, 0),
                2
            )                                AS cout_par_colis_livre
        FROM perf p
        LEFT JOIN pcc  pc ON p.agence_id = pc.agence_id
        LEFT JOIN costs c ON p.agence_id = c.agence_id
        ORDER BY p.nbr_colis DESC
    """
    args = a_p + a_p + a_c
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── By delivery type ─────────────────────────────────────────────────────────

def get_by_delivery_type(year=None, month=None, agence_id=None):
    """HD vs SD performance comparison from agg_performance_livraison."""
    w, a = _where_perf(year, month, agence_id=agence_id)
    sql = f"""
        SELECT
            delivery_type,
            SUM(nbr_colis_total)                                                        AS nbr_colis,
            SUM(nbr_livres)                                                             AS nbr_livres,
            SUM(nbr_retours)                                                            AS nbr_retours,
            SUM(total_fees_dzd)                                                         AS total_fees,
            ROUND(AVG(avg_fee_dzd), 2)                                                  AS avg_fee_dzd,
            ROUND(
                SUM(nbr_livres) * 100.0 / NULLIF(SUM(nbr_colis_total), 0),
                2
            )                                                                           AS taux_livraison_pct,
            ROUND(
                SUM(nbr_retours) * 100.0 / NULLIF(SUM(nbr_colis_total), 0),
                2
            )                                                                           AS taux_retour_pct,
            ROUND(
                SUM(avg_duree_livree_minutes * nbr_livres) / NULLIF(SUM(nbr_livres), 0),
                1
            )                                                                           AS avg_duree_livree_min
        FROM warehouse.agg_performance_livraison
        WHERE delivery_type IS NOT NULL {w}
        GROUP BY delivery_type
        ORDER BY nbr_colis DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, a)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Daily volume ─────────────────────────────────────────────────────────────

def get_daily_volume(year=None, month=None, agence_id=None):
    """
    Daily delivery volume for the selected month from agg_livraisons_journalieres.
    Aggregates across delivery_type and status_group (view grain is finer than day).
    """
    conds, args = [], []
    if year:
        conds.append("year = %s")
        args.append(int(year))
    if month:
        conds.append("month_num = %s")
        args.append(int(month))
    if agence_id:
        conds.append("agence_id = %s")
        args.append(int(agence_id))
    w = ("AND " + " AND ".join(conds)) if conds else ""

    sql = f"""
        SELECT
            full_date,
            day_of_week,
            is_weekend,
            is_friday,
            SUM(nbr_colis)                                                              AS nbr_colis,
            SUM(nbr_colis_livres)                                                       AS nbr_livres,
            SUM(nbr_colis_retours)                                                      AS nbr_retours,
            SUM(nbr_colis_echoues)                                                      AS nbr_echecs,
            ROUND(SUM(total_delivery_fee_dzd), 2)                                       AS total_fees,
            ROUND(
                SUM(nbr_colis_livres) * 100.0 / NULLIF(SUM(nbr_colis), 0),
                2
            )                                                                           AS taux_livraison_pct
        FROM warehouse.agg_livraisons_journalieres
        WHERE 1=1 {w}
        GROUP BY full_date, day_of_week, is_weekend, is_friday
        ORDER BY full_date
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Duration distribution ────────────────────────────────────────────────────

def get_duration_distribution(year, month, agence_id=None, delivery_type=None):
    """
    Delivery duration histogram bucketed into 6 bands (delivered parcels only).
    year and month are required — fact_livraisons is large.
    """
    conds = ["d.year = %s", "d.month_num = %s", "sc.is_success = TRUE",
             "fl.duree_livraison_minutes IS NOT NULL"]
    args = [int(year), int(month)]
    if agence_id:
        conds.append("da.agency_id = %s")
        args.append(int(agence_id))
    if delivery_type and delivery_type in ("HD", "SD"):
        conds.append("fl.delivery_type = %s")
        args.append(delivery_type)

    agence_join = (
        "JOIN warehouse.dim_agence da ON fl.agence_origine_key = da.agence_key"
        if agence_id else ""
    )
    w = " AND ".join(conds)

    sql = f"""
        WITH bucketed AS (
            SELECT
                CASE
                    WHEN fl.duree_livraison_minutes < 60     THEN 0
                    WHEN fl.duree_livraison_minutes < 240    THEN 1
                    WHEN fl.duree_livraison_minutes < 1440   THEN 2
                    WHEN fl.duree_livraison_minutes < 2880   THEN 3
                    WHEN fl.duree_livraison_minutes < 7200   THEN 4
                    ELSE                                          5
                END AS bucket_order,
                CASE
                    WHEN fl.duree_livraison_minutes < 60     THEN '< 1h'
                    WHEN fl.duree_livraison_minutes < 240    THEN '1–4h'
                    WHEN fl.duree_livraison_minutes < 1440   THEN '4–24h'
                    WHEN fl.duree_livraison_minutes < 2880   THEN '1–2 jours'
                    WHEN fl.duree_livraison_minutes < 7200   THEN '2–5 jours'
                    ELSE                                          '> 5 jours'
                END AS bucket
            FROM warehouse.fact_livraisons fl
            JOIN warehouse.dim_date d ON fl.date_creation_key = d.date_key
            JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key = sc.statut_key
            {agence_join}
            WHERE {w}
        )
        SELECT bucket, bucket_order, COUNT(*) AS nbr_colis
        FROM bucketed
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Sinistres ────────────────────────────────────────────────────────────────

def get_sinistres(year=None, month=None, agence_id=None):
    """
    Reimbursement analysis from fact_remboursements.
    Returns summary KPIs, breakdown by sinistre_type, and top agencies by claims.
    """
    conds, args = [], []
    if year:
        conds.append("d.year = %s")
        args.append(int(year))
    if month:
        conds.append("d.month_num = %s")
        args.append(int(month))
    if agence_id:
        conds.append("da.agency_id = %s")
        args.append(int(agence_id))
    w = ("AND " + " AND ".join(conds)) if conds else ""

    by_type_sql = f"""
        SELECT
            fr.sinistre_type,
            COUNT(*)                                                                    AS nbr_sinistres,
            COALESCE(SUM(fr.declared_value), 0)                                        AS sum_declared_dzd,
            SUM(fr.montant_rembourse)                                                   AS sum_rembourse_dzd,
            ROUND(
                SUM(fr.montant_rembourse) * 100.0 / NULLIF(SUM(fr.declared_value), 0),
                2
            )                                                                           AS taux_couverture_pct
        FROM warehouse.fact_remboursements fr
        JOIN warehouse.dim_date d ON fr.date_remboursement_key = d.date_key
        JOIN warehouse.dim_agence da ON fr.agence_key = da.agence_key
        WHERE 1=1 {w}
        GROUP BY fr.sinistre_type
        ORDER BY sum_rembourse_dzd DESC
    """

    # Agency breakdown — always shows all agencies (no agence_id filter)
    agency_conds, agency_args = [], []
    if year:
        agency_conds.append("d.year = %s")
        agency_args.append(int(year))
    if month:
        agency_conds.append("d.month_num = %s")
        agency_args.append(int(month))
    agency_w = ("AND " + " AND ".join(agency_conds)) if agency_conds else ""

    by_agency_sql = f"""
        SELECT
            da.agency_id                                                                AS agence_id,
            da.name                                                                     AS agence_nom,
            dw.wilaya_name,
            COUNT(*)                                                                    AS nbr_sinistres,
            COALESCE(SUM(fr.declared_value), 0)                                        AS sum_declared_dzd,
            SUM(fr.montant_rembourse)                                                   AS sum_rembourse_dzd
        FROM warehouse.fact_remboursements fr
        JOIN warehouse.dim_date d ON fr.date_remboursement_key = d.date_key
        JOIN warehouse.dim_agence da ON fr.agence_key = da.agence_key
        JOIN warehouse.dim_wilaya dw ON da.wilaya_key = dw.wilaya_key
        WHERE 1=1 {agency_w}
        GROUP BY da.agency_id, da.name, dw.wilaya_name
        ORDER BY sum_rembourse_dzd DESC
        LIMIT 20
    """

    with connections["warehouse"].cursor() as cur:
        cur.execute(by_type_sql, args)
        by_type = _coerce(_rows(cur))

    with connections["warehouse"].cursor() as cur:
        cur.execute(by_agency_sql, agency_args)
        by_agency = _coerce(_rows(cur))

    total_sinistres  = sum(r.get("nbr_sinistres") or 0 for r in by_type)
    total_declared   = sum(r.get("sum_declared_dzd") or 0 for r in by_type)
    total_rembourse  = sum(r.get("sum_rembourse_dzd") or 0 for r in by_type)
    coverage = round(total_rembourse * 100 / total_declared, 2) if total_declared else 0.0

    summary = {
        "nbr_sinistres":     total_sinistres,
        "sum_declared_dzd":  round(total_declared, 2),
        "sum_rembourse_dzd": round(total_rembourse, 2),
        "taux_couverture_pct": coverage,
        "avg_rembourse_dzd": round(total_rembourse / total_sinistres, 2) if total_sinistres else 0.0,
    }

    return {"summary": summary, "by_type": by_type, "by_agency": by_agency}


# ─── Freelance driver efficiency ──────────────────────────────────────────────

def get_freelance_efficiency(year=None, month=None, agence_id=None):
    """Per-agency freelance driver cost efficiency from fact_paiements_livreurs."""
    conds, args = [], []
    if year:
        conds.append("d.year = %s")
        args.append(int(year))
    if month:
        conds.append("d.month_num = %s")
        args.append(int(month))
    if agence_id:
        conds.append("da.agency_id = %s")
        args.append(int(agence_id))
    w = ("AND " + " AND ".join(conds)) if conds else ""

    sql = f"""
        SELECT
            da.agency_id                                                                AS agence_id,
            da.name                                                                     AS agence_nom,
            dw.wilaya_name,
            COUNT(DISTINCT fp.driver_key)                                               AS nbr_livreurs,
            SUM(fp.nbr_colis_livres)                                                    AS nbr_colis_livres,
            SUM(fp.nbr_colis_echoues)                                                   AS nbr_colis_echoues,
            SUM(fp.total_net)                                                           AS total_paiements_dzd,
            ROUND(
                SUM(fp.total_net) / NULLIF(SUM(fp.nbr_colis_livres), 0),
                2
            )                                                                           AS cout_par_colis_livre,
            ROUND(
                SUM(fp.nbr_colis_livres) * 100.0
                / NULLIF(SUM(fp.nbr_colis_livres) + SUM(fp.nbr_colis_echoues), 0),
                2
            )                                                                           AS taux_succes_freelance_pct
        FROM warehouse.fact_paiements_livreurs fp
        JOIN warehouse.dim_date d ON fp.date_paiement_key = d.date_key
        JOIN warehouse.dim_agence da ON fp.agence_key = da.agence_key
        JOIN warehouse.dim_wilaya dw ON da.wilaya_key = dw.wilaya_key
        WHERE 1=1 {w}
        GROUP BY da.agency_id, da.name, dw.wilaya_name
        ORDER BY total_paiements_dzd DESC
    """
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        rows = _rows(cur)
    return _coerce(rows)


# ─── Parcel drill-down ────────────────────────────────────────────────────────

_ALLOWED_PARCEL_SORT = {
    "ecart_tarif_dzd", "delivery_fee", "duree_livraison_minutes", "nbr_evenements",
    "date_creation",
}


def get_parcels(year, month, agence_id=None, delivery_type=None,
                ecart_direction=None, sort_by="ecart_tarif_dzd",
                page=1, page_size=25):
    """
    Paginated parcel drill-down table.
    year and month are required — enforced by the view before calling this function.
    Default sort: ecart_tarif_dzd ASC NULLS LAST (worst under-billing first).
    """
    base_conds = ["d.year = %s", "d.month_num = %s"]
    base_args  = [int(year), int(month)]

    if agence_id:
        base_conds.append("da.agency_id = %s")
        base_args.append(int(agence_id))
    if delivery_type and delivery_type in ("HD", "SD"):
        base_conds.append("fl.delivery_type = %s")
        base_args.append(delivery_type)

    ecart_cond = ""
    if ecart_direction == "sous-tarif":
        ecart_cond = "AND fl.ecart_tarif_dzd < 0"
    elif ecart_direction == "sur-tarif":
        ecart_cond = "AND fl.ecart_tarif_dzd > 0"
    elif ecart_direction == "au-tarif":
        ecart_cond = "AND fl.ecart_tarif_dzd = 0"

    order_col = sort_by if sort_by in _ALLOWED_PARCEL_SORT else "ecart_tarif_dzd"
    order_dir = "DESC" if order_col in {"delivery_fee", "duree_livraison_minutes",
                                         "nbr_evenements"} else "ASC"
    order_sql = f"{order_col} {order_dir} NULLS LAST"

    w = " AND ".join(base_conds) + f" {ecart_cond}"

    count_sql = f"""
        SELECT COUNT(*)
        FROM warehouse.fact_livraisons fl
        JOIN warehouse.dim_date d ON fl.date_creation_key = d.date_key
        JOIN warehouse.dim_agence da ON fl.agence_origine_key = da.agence_key
        WHERE {w}
    """

    data_sql = f"""
        SELECT
            fl.tracking,
            dd.full_date                                AS date_creation,
            da.agency_id                                AS agence_id,
            da.name                                     AS agence_nom,
            COALESCE(dw.wilaya_name, 'Inconnue')        AS wilaya_destination,
            fl.delivery_type,
            ds.statut_name                              AS statut_actuel,
            fl.delivery_fee,
            fl.tarif_theorique,
            fl.ecart_tarif_dzd,
            fl.duree_livraison_minutes,
            fl.nbr_evenements
        FROM warehouse.fact_livraisons fl
        JOIN warehouse.dim_date dd ON fl.date_creation_key = dd.date_key
        JOIN warehouse.dim_agence da ON fl.agence_origine_key = da.agence_key
        LEFT JOIN warehouse.dim_wilaya dw ON fl.wilaya_destination_key = dw.wilaya_key
        JOIN warehouse.dim_statut_colis ds ON fl.statut_final_key = ds.statut_key
        WHERE {w}
        ORDER BY fl.{order_sql}
        LIMIT %s OFFSET %s
    """

    page     = max(1, int(page))
    page_size = min(100, max(1, int(page_size)))
    offset   = (page - 1) * page_size

    with connections["warehouse"].cursor() as cur:
        cur.execute(count_sql, base_args)
        total = cur.fetchone()[0]

    with connections["warehouse"].cursor() as cur:
        cur.execute(data_sql, base_args + [page_size, offset])
        rows = _rows(cur)

    return {
        "results": _coerce(rows),
        "count":   total,
        "page":    page,
        "pages":   (total + page_size - 1) // page_size,
    }
