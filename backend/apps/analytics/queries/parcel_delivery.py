"""
Raw SQL queries for the Parcel Delivery analytics section (Operations / Cost & Profitability / Performance).

Filter convention: start_date / end_date (YYYY-MM-DD strings), optional delivery_type ('HD'|'SD').

Parcel volume metrics  → filter on dim_parcel.date_creation_id
Revenue metrics        → filter on dim_parcel.date_terminal_id  (fact_parcel_revenue exists only for resolved parcels)
Cost metrics           → filter on fact_charges.date_id / fact_cost_salaire.date_id
Claims metrics         → filter on dim_remboursement.date_remboursement_id

Status keys (dim_parcels_status):
  13 = Livré (terminal)
  19 = Retourné au vendeur (terminal)
  14 = Echèc livraison (non-terminal)

Cost perimeter (Parcel Delivery only):
  fact_charges (depense_status_id = 2 = validated)  +  fact_cost_salaire
  fact_transfert_caisse is excluded (internal cash flow, never in profitability).
"""

from datetime import date as _date, timedelta
from decimal import Decimal

from django.db import connections


# ─── Utilities ────────────────────────────────────────────────────────────────

def _rows(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _coerce(obj):
    """Recursively convert Decimal → float for JSON serialisation."""
    if isinstance(obj, dict):
        return {k: _coerce(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_coerce(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _pop(curr, prev):
    """Period-over-period % change. Returns 0.0 when prev is 0."""
    if not prev:
        return 0.0
    return round((float(curr) - float(prev)) / float(prev) * 100, 1)


def _prev_period(start_date_str, end_date_str):
    """Return (prev_start, prev_end) — a window of the same length immediately before start_date."""
    start = _date.fromisoformat(start_date_str)
    end   = _date.fromisoformat(end_date_str)
    delta = end - start
    prev_end   = start - timedelta(days=1)
    prev_start = prev_end - delta
    return prev_start.isoformat(), prev_end.isoformat()


def _dt_filter(delivery_type):
    """Return (sql_snippet, args) for optional delivery_type filter.
    Requires dim_delivery_type aliased as ddt to be LEFT JOINed."""
    if delivery_type and delivery_type.upper() in ("HD", "SD"):
        return "AND ddt.type_code = %s", [delivery_type.upper()]
    return "", []


def _run(sql, args):
    with connections["warehouse"].cursor() as cur:
        cur.execute(sql, args)
        return _coerce(_rows(cur))


# ─── Shared cost helpers (used by multiple cost/profitability endpoints) ───────

def _get_charges(start_date, end_date):
    """Sum of validated operational charges for the date window."""
    rows = _run("""
        SELECT COALESCE(SUM(fc.montant), 0) AS total
        FROM warehouse.fact_charges fc
        JOIN warehouse.dim_depense dd ON fc.depense_id = dd.depense_id
        WHERE fc.date_id >= %s AND fc.date_id <= %s
          AND dd.depense_status_id = 2
    """, [start_date, end_date])
    return float(rows[0]["total"]) if rows else 0.0


def _get_salaires(start_date, end_date):
    """Sum of employer payroll cost (brut + patronal charges) for the date window."""
    rows = _run("""
        SELECT COALESCE(SUM(fcs.total_brut + fcs.total_charges_patronales), 0) AS total
        FROM warehouse.fact_cost_salaire fcs
        WHERE fcs.date_id >= %s AND fcs.date_id <= %s
    """, [start_date, end_date])
    return float(rows[0]["total"]) if rows else 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# SUB-PAGE 1 — OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_ops_kpis(start_date, end_date, delivery_type=None):
    """
    Five KPI cards for the Operations page + period-over-period deltas.

    Counts parcels created in [start_date, end_date] and classifies them by
    current status.  Avg delivery duration comes from fact_parcel_performance
    (NULL for unresolved parcels — AVG filters those out automatically).
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    kpi_sql = f"""
        SELECT
            COUNT(*)                                                           AS nbr_colis,
            COUNT(*) FILTER (WHERE dp.current_status_id = 13)                 AS nbr_livres,
            COUNT(*) FILTER (WHERE dp.current_status_id = 19)                 AS nbr_retours,
            COUNT(*) FILTER (WHERE dp.current_status_id = 14)                 AS nbr_echecs,
            COUNT(*) FILTER (WHERE ps.is_terminal = FALSE)                     AS nbr_en_transit,
            COALESCE(
                AVG(fpp.duree_totale_minutes) FILTER (WHERE dp.current_status_id = 13)
                / 60.0,
                0
            )                                                                  AS avg_duree_livraison_h
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.dim_parcels_status   ps  ON dp.current_status_id  = ps.status_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id  = ddt.delivery_type_id
        LEFT JOIN warehouse.fact_parcel_performance fpp ON dp.parcel_key  = fpp.parcel_key
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
    """

    curr = _run(kpi_sql, [start_date, end_date] + dt_args)[0]
    prev_s, prev_e = _prev_period(start_date, end_date)
    prev = _run(kpi_sql, [prev_s, prev_e] + dt_args)[0]

    nbr      = curr.get("nbr_colis")    or 0
    livres   = curr.get("nbr_livres")   or 0
    retours  = curr.get("nbr_retours")  or 0
    p_nbr    = prev.get("nbr_colis")    or 0
    p_livres = prev.get("nbr_livres")   or 0
    p_retours = prev.get("nbr_retours") or 0

    curr_rate = livres  / nbr   * 100 if nbr   else 0.0
    prev_rate = p_livres / p_nbr * 100 if p_nbr else 0.0
    curr_ret  = retours  / nbr   * 100 if nbr   else 0.0
    prev_ret  = p_retours / p_nbr * 100 if p_nbr else 0.0

    return {
        "nbr_colis":              nbr,
        "nbr_livres":             livres,
        "nbr_retours":            retours,
        "nbr_echecs":             int(curr.get("nbr_echecs") or 0),
        "nbr_en_transit":         int(curr.get("nbr_en_transit") or 0),
        "avg_duree_livraison_h":  round(float(curr.get("avg_duree_livraison_h") or 0), 1),
        "taux_livraison_pct":     round(curr_rate, 1),
        "taux_retour_pct":        round(curr_ret, 1),
        "pop_colis":              _pop(nbr, p_nbr),
        "pop_livraison":          _pop(curr_rate, prev_rate),
        "pop_retour":             _pop(curr_ret, prev_ret),
        "pop_echecs":             _pop(curr.get("nbr_echecs") or 0,     prev.get("nbr_echecs") or 0),
        "pop_en_transit":         _pop(curr.get("nbr_en_transit") or 0, prev.get("nbr_en_transit") or 0),
        "pop_duree":              _pop(curr.get("avg_duree_livraison_h") or 0,
                                       prev.get("avg_duree_livraison_h") or 0),
    }


def get_ops_trend(start_date, end_date, delivery_type=None):
    """
    Daily volume trend grouped by parcel creation date.
    Each row: { date, nbr_livres, nbr_retours, nbr_echecs, nbr_en_transit }.
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            dp.date_creation_id::text                                                       AS date,
            COUNT(*) FILTER (WHERE dp.current_status_id = 13)    AS nbr_livres,
            COUNT(*) FILTER (WHERE dp.current_status_id = 19)    AS nbr_retours,
            COUNT(*) FILTER (WHERE dp.current_status_id = 14)    AS nbr_echecs,
            COUNT(*) FILTER (WHERE ps.is_terminal = FALSE)        AS nbr_en_transit
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.dim_parcels_status   ps  ON dp.current_status_id = ps.status_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY dp.date_creation_id
        ORDER BY dp.date_creation_id
    """
    return _run(sql, [start_date, end_date] + dt_args)


def get_status_breakdown(start_date, end_date, delivery_type=None):
    """Status distribution for the pie chart."""
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            ps.status_name,
            COUNT(*) AS nbr_colis
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.dim_parcels_status   ps  ON dp.current_status_id = ps.status_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY ps.status_id, ps.status_name
        ORDER BY nbr_colis DESC
    """
    return _run(sql, [start_date, end_date] + dt_args)


def get_region_flow(start_date, end_date, delivery_type=None):
    """
    Origin × destination wilaya flow matrix.

    Navigates: dim_parcel.center_depart_key / center_destination_key
               → dim_center → dim_agence → dim_commune → dim_wilaya.
    Returns up to 200 (origin, destination, nbr_colis) rows ordered by volume.
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            w_dep.wilaya_name  AS origin,
            w_dest.wilaya_name AS destination,
            COUNT(*)           AS nbr_colis
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.dim_delivery_type ddt  ON dp.delivery_type_id      = ddt.delivery_type_id
        LEFT JOIN warehouse.dim_center        cd1  ON dp.center_depart_key      = cd1.center_id
        LEFT JOIN warehouse.dim_agence        ag1  ON cd1.agence_key            = ag1.agence_key
        LEFT JOIN warehouse.dim_commune       cm1  ON ag1.commune_id            = cm1.commune_id
        LEFT JOIN warehouse.dim_wilaya        w_dep  ON cm1.wilaya_id           = w_dep.wilaya_id
        LEFT JOIN warehouse.dim_center        cd2  ON dp.center_destination_key = cd2.center_id
        LEFT JOIN warehouse.dim_agence        ag2  ON cd2.agence_key            = ag2.agence_key
        LEFT JOIN warehouse.dim_commune       cm2  ON ag2.commune_id            = cm2.commune_id
        LEFT JOIN warehouse.dim_wilaya        w_dest ON cm2.wilaya_id           = w_dest.wilaya_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          AND w_dep.wilaya_name  IS NOT NULL
          AND w_dest.wilaya_name IS NOT NULL
          {dt_sql}
        GROUP BY w_dep.wilaya_name, w_dest.wilaya_name
        HAVING COUNT(*) > 0
        ORDER BY nbr_colis DESC
        LIMIT 200
    """
    return _run(sql, [start_date, end_date] + dt_args)


def get_zone_breakdown(start_date, end_date, delivery_type=None):
    """Zone distribution: volume + delivery rate per pricing zone."""
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            dz.zone_num,
            dz.fee_range_dzd                                                                AS fee_range,
            COUNT(*)                                                                        AS nbr_colis,
            COUNT(*) FILTER (WHERE dp.current_status_id = 13)                              AS nbr_livres,
            ROUND(
                COUNT(*) FILTER (WHERE dp.current_status_id = 13) * 100.0
                / NULLIF(COUNT(*), 0),
                1
            )                                                                               AS taux_livraison_pct
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.dim_zone          dz  ON dp.zone_id        = dz.zone_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY dz.zone_id, dz.zone_num, dz.fee_range_dzd
        ORDER BY dz.zone_num
    """
    return _run(sql, [start_date, end_date] + dt_args)


# ═══════════════════════════════════════════════════════════════════════════════
# SUB-PAGE 2 — COST & PROFITABILITY
# ═══════════════════════════════════════════════════════════════════════════════

def get_cost_kpis(start_date, end_date, delivery_type=None):
    """
    Revenue + cost KPI cards with period-over-period deltas.

    Revenue uses dim_parcel.date_terminal_id (fees collected at resolution).
    Costs use fact_charges.date_id + fact_cost_salaire.date_id.
    Zone/region cost split uses proportional allocation (no per-parcel cost dim).
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    rev_sql = f"""
        SELECT
            COALESCE(SUM(fpr.delivery_fee), 0) AS total_fees,
            COUNT(*)                            AS nbr_colis_livres
        FROM warehouse.fact_parcel_revenue fpr
        JOIN  warehouse.dim_parcel        dp  ON fpr.parcel_key        = dp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_terminal_id >= %s AND dp.date_terminal_id <= %s
          {dt_sql}
    """

    rev  = _run(rev_sql, [start_date, end_date] + dt_args)[0]
    fees = float(rev.get("total_fees") or 0)
    nbr  = int(rev.get("nbr_colis_livres") or 0)
    cost = _get_charges(start_date, end_date) + _get_salaires(start_date, end_date)

    prev_s, prev_e = _prev_period(start_date, end_date)
    p_rev  = _run(rev_sql, [prev_s, prev_e] + dt_args)[0]
    p_fees = float(p_rev.get("total_fees") or 0)
    p_nbr  = int(p_rev.get("nbr_colis_livres") or 0)
    p_cost = _get_charges(prev_s, prev_e) + _get_salaires(prev_s, prev_e)

    marge    = fees - cost
    marge_pct = round(marge / fees * 100, 1) if fees else 0.0
    avg_fee   = round(fees / nbr, 1)          if nbr  else 0.0
    cout_livre = round(cost / nbr, 1)          if nbr  else 0.0

    p_marge    = p_fees - p_cost
    p_marge_pct = round(p_marge / p_fees * 100, 1) if p_fees else 0.0
    p_avg_fee   = round(p_fees / p_nbr, 1)          if p_nbr  else 0.0
    p_cout_livre = round(p_cost / p_nbr, 1)          if p_nbr  else 0.0

    return {
        "total_fees":           round(fees, 2),
        "cout_total":           round(cost, 2),
        "marge_brute":          round(marge, 2),
        "marge_pct":            marge_pct,
        "avg_fee_par_colis":    avg_fee,
        "cout_par_colis_livre": cout_livre,
        "pop_fees":             _pop(fees,      p_fees),
        "pop_cout":             _pop(cost,      p_cost),
        "pop_marge":            _pop(marge_pct, p_marge_pct),
        "pop_avg_fee":          _pop(avg_fee,   p_avg_fee),
        "pop_cout_par_livre":   _pop(cout_livre, p_cout_livre),
    }


def get_revenue_cost_trend(start_date, end_date, delivery_type=None):
    """
    Monthly revenue / cost / margin trend for the dual-line + bar chart.

    Revenue grouped by date_terminal_id; costs grouped by their own date columns.
    Months present in any of the three series are included.
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    rev_sql = f"""
        SELECT
            TO_CHAR(dp.date_terminal_id, 'YYYY-MM')    AS period,
            COALESCE(SUM(fpr.delivery_fee), 0)          AS total_fees
        FROM warehouse.fact_parcel_revenue fpr
        JOIN  warehouse.dim_parcel        dp  ON fpr.parcel_key        = dp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_terminal_id >= %s AND dp.date_terminal_id <= %s
          {dt_sql}
        GROUP BY period
        ORDER BY period
    """

    charges_sql = """
        SELECT
            TO_CHAR(fc.date_id, 'YYYY-MM')   AS period,
            COALESCE(SUM(fc.montant), 0)      AS total_charges
        FROM warehouse.fact_charges fc
        JOIN warehouse.dim_depense dd ON fc.depense_id = dd.depense_id
        WHERE fc.date_id >= %s AND fc.date_id <= %s
          AND dd.depense_status_id = 2
        GROUP BY period
        ORDER BY period
    """

    sal_sql = """
        SELECT
            TO_CHAR(fcs.date_id, 'YYYY-MM')                                    AS period,
            COALESCE(SUM(fcs.total_brut + fcs.total_charges_patronales), 0)    AS total_salaires
        FROM warehouse.fact_cost_salaire fcs
        WHERE fcs.date_id >= %s AND fcs.date_id <= %s
        GROUP BY period
        ORDER BY period
    """

    rev_rows  = _run(rev_sql,     [start_date, end_date] + dt_args)
    chr_rows  = _run(charges_sql, [start_date, end_date])
    sal_rows  = _run(sal_sql,     [start_date, end_date])

    rev_map = {r["period"]: float(r["total_fees"])     for r in rev_rows}
    chr_map = {r["period"]: float(r["total_charges"])  for r in chr_rows}
    sal_map = {r["period"]: float(r["total_salaires"]) for r in sal_rows}

    all_periods = sorted(set(rev_map) | set(chr_map) | set(sal_map))
    result = []
    for p in all_periods:
        fees  = rev_map.get(p, 0.0)
        costs = chr_map.get(p, 0.0) + sal_map.get(p, 0.0)
        result.append({
            "period":      p,
            "total_fees":  round(fees, 2),
            "cout_total":  round(costs, 2),
            "marge_brute": round(fees - costs, 2),
        })
    return result


def get_cost_by_nature(start_date, end_date, delivery_type=None):
    """
    Operational expense breakdown by nature name for the horizontal bar chart.

    Navigates dim_depense → dim_rubriques (when set) → dim_nature,
    or dim_depense → dim_nature directly (when rubrique_id is NULL).
    """
    sql = """
        SELECT
            dn.nature_name,
            COALESCE(SUM(fc.montant), 0) AS total_dzd
        FROM warehouse.fact_charges fc
        JOIN  warehouse.dim_depense   dd  ON fc.depense_id   = dd.depense_id
        LEFT JOIN warehouse.dim_rubriques dr  ON dd.rubrique_id  = dr.rubrique_id
        JOIN  warehouse.dim_nature    dn
              ON COALESCE(dr.nature_id, dd.nature_id) = dn.nature_id
        WHERE fc.date_id >= %s AND fc.date_id <= %s
          AND dd.depense_status_id = 2
        GROUP BY dn.nature_id, dn.nature_name
        ORDER BY total_dzd DESC
    """
    return _run(sql, [start_date, end_date])


def get_region_profit(start_date, end_date, delivery_type=None):
    """
    Origin × destination wilaya profitability heatmap.

    Revenue per flow from fact_parcel_revenue; total period costs are
    allocated proportionally to each flow's revenue share.
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    rev_sql = f"""
        SELECT
            w_dep.wilaya_name  AS origin,
            w_dest.wilaya_name AS destination,
            COUNT(*)           AS nbr_colis,
            COALESCE(SUM(fpr.delivery_fee), 0) AS total_fees
        FROM warehouse.fact_parcel_revenue fpr
        JOIN  warehouse.dim_parcel        dp    ON fpr.parcel_key            = dp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type ddt  ON dp.delivery_type_id   = ddt.delivery_type_id
        LEFT JOIN warehouse.dim_center        cd1  ON dp.center_depart_key   = cd1.center_id
        LEFT JOIN warehouse.dim_agence        ag1  ON cd1.agence_key         = ag1.agence_key
        LEFT JOIN warehouse.dim_commune       cm1  ON ag1.commune_id         = cm1.commune_id
        LEFT JOIN warehouse.dim_wilaya        w_dep  ON cm1.wilaya_id        = w_dep.wilaya_id
        LEFT JOIN warehouse.dim_center        cd2  ON dp.center_destination_key = cd2.center_id
        LEFT JOIN warehouse.dim_agence        ag2  ON cd2.agence_key         = ag2.agence_key
        LEFT JOIN warehouse.dim_commune       cm2  ON ag2.commune_id         = cm2.commune_id
        LEFT JOIN warehouse.dim_wilaya        w_dest ON cm2.wilaya_id        = w_dest.wilaya_id
        WHERE dp.date_terminal_id >= %s AND dp.date_terminal_id <= %s
          AND w_dep.wilaya_name  IS NOT NULL
          AND w_dest.wilaya_name IS NOT NULL
          {dt_sql}
        GROUP BY w_dep.wilaya_name, w_dest.wilaya_name
        HAVING COUNT(*) > 0
        ORDER BY total_fees DESC
        LIMIT 200
    """

    rows = _run(rev_sql, [start_date, end_date] + dt_args)
    if not rows:
        return []

    total_cost  = _get_charges(start_date, end_date) + _get_salaires(start_date, end_date)
    total_fees  = sum(float(r["total_fees"]) for r in rows)

    result = []
    for r in rows:
        fees  = float(r["total_fees"])
        cost  = round(total_cost * (fees / total_fees), 2) if total_fees else 0.0
        marge = round(fees - cost, 2)
        result.append({
            "origin":      r["origin"],
            "destination": r["destination"],
            "nbr_colis":   int(r["nbr_colis"]),
            "total_fees":  round(fees, 2),
            "cout_total":  cost,
            "marge_brute": marge,
            "marge_pct":   round(marge / fees * 100, 1) if fees else 0.0,
        })
    return result


def get_zone_profit(start_date, end_date, delivery_type=None):
    """
    Zone-level profitability: fees, allocated cost, and margin per pricing zone.
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    rev_sql = f"""
        SELECT
            dz.zone_num,
            dz.fee_range_dzd                   AS fee_range,
            COUNT(*)                            AS nbr_colis,
            COALESCE(SUM(fpr.delivery_fee), 0) AS total_fees
        FROM warehouse.fact_parcel_revenue fpr
        JOIN  warehouse.dim_parcel        dp  ON fpr.parcel_key    = dp.parcel_key
        JOIN  warehouse.dim_zone          dz  ON dp.zone_id        = dz.zone_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_terminal_id >= %s AND dp.date_terminal_id <= %s
          {dt_sql}
        GROUP BY dz.zone_id, dz.zone_num, dz.fee_range_dzd
        ORDER BY dz.zone_num
    """

    rows = _run(rev_sql, [start_date, end_date] + dt_args)
    if not rows:
        return []

    total_cost = _get_charges(start_date, end_date) + _get_salaires(start_date, end_date)
    total_fees = sum(float(r["total_fees"]) for r in rows)

    result = []
    for r in rows:
        fees  = float(r["total_fees"])
        cost  = round(total_cost * (fees / total_fees), 2) if total_fees else 0.0
        marge = round(fees - cost, 2)
        result.append({
            "zone_num":    int(r["zone_num"]),
            "fee_range":   r["fee_range"],
            "nbr_colis":   int(r["nbr_colis"]),
            "total_fees":  round(fees, 2),
            "cout_total":  cost,
            "marge_brute": marge,
            "marge_pct":   round(marge / fees * 100, 1) if fees else 0.0,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# SUB-PAGE 3 — PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════════

def get_perf_kpis(start_date, end_date, delivery_type=None):
    """
    Five performance KPI cards + period-over-period deltas.

    avg_tentatives = AVG of nbr_tentatives_livraison for delivered parcels
                     (0 = delivered on first attempt).
    taux_premier_essai_pct = % of delivered parcels with 0 failed attempts.
    nbr_sinistres from dim_remboursement (date_remboursement_id range).
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    parcel_sql = f"""
        SELECT
            COUNT(*)                                                                         AS nbr_colis,
            COUNT(*) FILTER (WHERE dp.current_status_id = 13)                               AS nbr_livres,
            COALESCE(
                AVG(fpp.nbr_tentatives_livraison)
                    FILTER (WHERE dp.current_status_id = 13),
                0
            )                                                                                AS avg_tentatives,
            COUNT(*) FILTER (
                WHERE dp.current_status_id = 13
                  AND fpp.nbr_tentatives_livraison = 0
            )                                                                                AS nbr_premier_essai,
            COALESCE(
                AVG(fpp.duree_totale_minutes)
                    FILTER (WHERE dp.current_status_id = 13)
                / 60.0,
                0
            )                                                                                AS avg_duree_h
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.fact_parcel_performance fpp ON dp.parcel_key      = fpp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type       ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
    """

    claims_sql = """
        SELECT COUNT(*) AS nbr_sinistres
        FROM warehouse.dim_remboursement
        WHERE date_remboursement_id >= %s AND date_remboursement_id <= %s
    """

    curr_p = _run(parcel_sql, [start_date, end_date] + dt_args)[0]
    curr_c = _run(claims_sql, [start_date, end_date])[0]

    prev_s, prev_e = _prev_period(start_date, end_date)
    prev_p = _run(parcel_sql, [prev_s, prev_e] + dt_args)[0]
    prev_c = _run(claims_sql, [prev_s, prev_e])[0]

    nbr      = curr_p.get("nbr_colis")  or 0
    livres   = curr_p.get("nbr_livres") or 0
    p_nbr    = prev_p.get("nbr_colis")  or 0
    p_livres = prev_p.get("nbr_livres") or 0

    curr_rate   = livres   / nbr    * 100 if nbr    else 0.0
    prev_rate   = p_livres / p_nbr  * 100 if p_nbr  else 0.0
    curr_pe_pct = (curr_p.get("nbr_premier_essai") or 0) / livres   * 100 if livres   else 0.0
    prev_pe_pct = (prev_p.get("nbr_premier_essai") or 0) / p_livres * 100 if p_livres else 0.0

    curr_tent = float(curr_p.get("avg_tentatives") or 0)
    prev_tent = float(prev_p.get("avg_tentatives") or 0)
    curr_dur  = float(curr_p.get("avg_duree_h")    or 0)
    prev_dur  = float(prev_p.get("avg_duree_h")    or 0)

    return {
        "taux_livraison_pct":     round(curr_rate, 1),
        "avg_tentatives":         round(curr_tent, 2),
        "taux_premier_essai_pct": round(curr_pe_pct, 1),
        "avg_duree_livraison_h":  round(curr_dur, 1),
        "nbr_sinistres":          int(curr_c.get("nbr_sinistres") or 0),
        "pop_livraison":          _pop(curr_rate,   prev_rate),
        "pop_tentatives":         _pop(curr_tent,   prev_tent),
        "pop_premier_essai":      _pop(curr_pe_pct, prev_pe_pct),
        "pop_duree":              _pop(curr_dur,    prev_dur),
        "pop_sinistres":          _pop(curr_c.get("nbr_sinistres") or 0,
                                       prev_c.get("nbr_sinistres") or 0),
    }


def get_perf_trend(start_date, end_date, delivery_type=None):
    """Monthly delivery-rate + avg-duration trend for the dual-axis line chart."""
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            TO_CHAR(dp.date_creation_id, 'YYYY-MM')                                         AS period,
            ROUND(
                COUNT(*) FILTER (WHERE dp.current_status_id = 13) * 100.0
                / NULLIF(COUNT(*), 0),
                1
            )                                                                                AS taux_livraison_pct,
            COALESCE(
                AVG(fpp.duree_totale_minutes)
                    FILTER (WHERE dp.current_status_id = 13)
                / 60.0,
                0
            )                                                                                AS avg_duree_livraison_h
        FROM warehouse.dim_parcel dp
        LEFT JOIN warehouse.fact_parcel_performance fpp ON dp.parcel_key      = fpp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type       ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY period
        ORDER BY period
    """
    return _run(sql, [start_date, end_date] + dt_args)


def get_duration_distribution(start_date, end_date, delivery_type=None):
    """
    Delivery duration histogram for successfully delivered parcels (6 buckets).

    Buckets defined in hours/days:
      < 1h | 1–12h | 12h–24h | 1–3 jours | 3–5 jours | > 5 jours
    """
    dt_sql, dt_args = _dt_filter(delivery_type)

    sql = f"""
        SELECT
            CASE
                WHEN fpp.duree_totale_minutes < 60    THEN '< 1h'
                WHEN fpp.duree_totale_minutes < 720   THEN '1–12h'
                WHEN fpp.duree_totale_minutes < 1440  THEN '12h–24h'
                WHEN fpp.duree_totale_minutes < 4320  THEN '1–3 jours'
                WHEN fpp.duree_totale_minutes < 7200  THEN '3–5 jours'
                ELSE                                       '> 5 jours'
            END                                                                              AS bucket,
            CASE
                WHEN fpp.duree_totale_minutes < 60    THEN 1
                WHEN fpp.duree_totale_minutes < 720   THEN 2
                WHEN fpp.duree_totale_minutes < 1440  THEN 3
                WHEN fpp.duree_totale_minutes < 4320  THEN 4
                WHEN fpp.duree_totale_minutes < 7200  THEN 5
                ELSE                                       6
            END                                                                              AS bucket_order,
            COUNT(*)                                                                         AS nbr_colis
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.fact_parcel_performance fpp ON dp.parcel_key       = fpp.parcel_key
        LEFT JOIN warehouse.dim_delivery_type   ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.current_status_id = 13
          AND fpp.duree_totale_minutes IS NOT NULL
          AND dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
    """
    return _run(sql, [start_date, end_date] + dt_args)


def get_center_expedition_ranking(start_date, end_date, delivery_type=None, limit=8):
    """Top N departure centers ranked by parcel volume expedited in the date window."""
    dt_sql, dt_args = _dt_filter(delivery_type)
    try:
        lim = int(limit)
    except (TypeError, ValueError):
        lim = 8

    sql = f"""
        SELECT
            dc.code  AS center_code,
            dc.name  AS center_name,
            COUNT(*) AS nbr_colis
        FROM warehouse.dim_parcel dp
        JOIN  warehouse.dim_center        dc  ON dp.center_depart_key   = dc.center_id
        LEFT JOIN warehouse.dim_delivery_type ddt ON dp.delivery_type_id = ddt.delivery_type_id
        WHERE dp.date_creation_id >= %s AND dp.date_creation_id <= %s
          {dt_sql}
        GROUP BY dc.center_id, dc.code, dc.name
        ORDER BY nbr_colis DESC
        LIMIT %s
    """
    return _run(sql, [start_date, end_date] + dt_args + [lim])


def get_claims_types(start_date, end_date, delivery_type=None):
    """
    Claims (reimbursements) grouped by sinistre type for the pie chart.

    delivery_type has no dimension in dim_remboursement — filter is ignored.
    """
    sql = """
        SELECT
            dst.sinistre_type,
            COUNT(*) AS nbr_sinistres
        FROM warehouse.dim_remboursement   dr
        JOIN  warehouse.dim_sinistre_type  dst ON dr.sinistre_type_id = dst.sinistre_type_id
        WHERE dr.date_remboursement_id >= %s AND dr.date_remboursement_id <= %s
        GROUP BY dst.sinistre_type_id, dst.sinistre_type
        ORDER BY nbr_sinistres DESC
    """
    return _run(sql, [start_date, end_date])
