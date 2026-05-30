"""
Celery tasks for alert evaluation and notification dispatch.

evaluate_alert_rules() runs every 15 minutes (configured in CELERY_BEAT_SCHEDULE).
When a rule fires, it creates an Alert and a Notification for each target user.
"""

import logging

from celery import shared_task
from django.db import connections
from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SQL queries per metric — executed against the warehouse DB
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Weekly KPI queries — the 7-day window ending on the most recent Saturday.
# Task fires every Sunday at 07:00, so:
#   CURRENT_DATE - 1  =  last Saturday  (end of week, inclusive)
#   CURRENT_DATE - 7  =  last Sunday    (start of week, inclusive)
# All queries use the same warehouse schema as the analytics app.
# ---------------------------------------------------------------------------

_W = (
    "dd.full_date >= CURRENT_DATE - INTERVAL '7 days'"
    " AND dd.full_date <= CURRENT_DATE - INTERVAL '1 day'"
)

_METRIC_QUERIES: dict[str, str] = {
    # ── Parcel Delivery — Operations ────────────────────────────────────────
    "pd_ops_total_parcels": f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W}
    """,
    "pd_ops_delivered": f"""
        SELECT COUNT(*) FILTER (WHERE dp.current_status_id = 13)
        FROM warehouse.dim_parcel dp
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W}
    """,
    "pd_ops_returns": f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.current_status_id = 19
    """,
    "pd_ops_in_transit": f"""
        SELECT COUNT(*)
        FROM warehouse.dim_parcel dp
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.is_terminal = FALSE
    """,
    "pd_ops_avg_duration": f"""
        SELECT ROUND(COALESCE(AVG(fpp.duree_totale_minutes) / 60.0, 0)::NUMERIC, 2)
        FROM warehouse.fact_parcel_performance fpp
        JOIN warehouse.dim_parcel dp ON fpp.parcel_id = dp.parcel_id
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.current_status_id = 13
    """,

    # ── Parcel Delivery — Cost & Profitability ───────────────────────────────
    "pd_cost_fees_collected": f"""
        SELECT COALESCE(SUM(fpr.delivery_fee), 0)
        FROM warehouse.fact_parcel_revenue fpr
        JOIN warehouse.dim_date dd ON fpr.date_terminal_id = dd.date_key
        WHERE {_W}
    """,
    "pd_cost_total_cost": f"""
        SELECT COALESCE(SUM(fc.montant), 0)
        FROM warehouse.fact_charges fc
        JOIN warehouse.dim_date dd ON fc.date_key = dd.date_key
        WHERE {_W} AND fc.depense_status_id = 2
    """,
    "pd_cost_gross_margin": f"""
        SELECT ROUND(
            100.0 * (fees.v - cost.v) / NULLIF(fees.v, 0)::NUMERIC, 2
        )
        FROM (
            SELECT COALESCE(SUM(fpr.delivery_fee), 0) AS v
            FROM warehouse.fact_parcel_revenue fpr
            JOIN warehouse.dim_date dd ON fpr.date_terminal_id = dd.date_key
            WHERE {_W}
        ) fees,
        (
            SELECT COALESCE(SUM(fc.montant), 0) AS v
            FROM warehouse.fact_charges fc
            JOIN warehouse.dim_date dd ON fc.date_key = dd.date_key
            WHERE {_W} AND fc.depense_status_id = 2
        ) cost
    """,
    "pd_cost_avg_fee": f"""
        SELECT ROUND(
            COALESCE(SUM(fpr.delivery_fee), 0)
            / NULLIF(COUNT(dp.parcel_id) FILTER (WHERE dp.current_status_id = 13), 0)
        ::NUMERIC, 2)
        FROM warehouse.fact_parcel_revenue fpr
        JOIN warehouse.dim_parcel dp ON fpr.parcel_id = dp.parcel_id
        JOIN warehouse.dim_date dd ON fpr.date_terminal_id = dd.date_key
        WHERE {_W}
    """,
    "pd_cost_per_delivery": f"""
        SELECT ROUND(
            COALESCE(SUM(fc.montant), 0)
            / NULLIF(
                (SELECT COUNT(*) FROM warehouse.dim_parcel dp2
                 JOIN warehouse.dim_date dd2 ON dp2.date_creation_id = dd2.date_key
                 WHERE dd2.full_date >= CURRENT_DATE - INTERVAL '7 days'
                   AND dd2.full_date <= CURRENT_DATE - INTERVAL '1 day'
                   AND dp2.current_status_id = 13),
                0)
        ::NUMERIC, 2)
        FROM warehouse.fact_charges fc
        JOIN warehouse.dim_date dd ON fc.date_key = dd.date_key
        WHERE {_W} AND fc.depense_status_id = 2
    """,

    # ── Parcel Delivery — Performance ────────────────────────────────────────
    "pd_perf_delivery_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE dp.current_status_id = 13)
            / NULLIF(COUNT(*), 0)::NUMERIC, 2
        )
        FROM warehouse.dim_parcel dp
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W}
    """,
    "pd_perf_avg_attempts": f"""
        SELECT ROUND(COALESCE(
            AVG(fpp.nbr_tentatives_livraison + 1), 0
        )::NUMERIC, 2)
        FROM warehouse.fact_parcel_performance fpp
        JOIN warehouse.dim_parcel dp ON fpp.parcel_id = dp.parcel_id
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.current_status_id = 13
    """,
    "pd_perf_first_attempt_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE fpp.nbr_tentatives_livraison = 0)
            / NULLIF(COUNT(*), 0)::NUMERIC, 2
        )
        FROM warehouse.fact_parcel_performance fpp
        JOIN warehouse.dim_parcel dp ON fpp.parcel_id = dp.parcel_id
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.current_status_id = 13
    """,
    "pd_perf_avg_duration": f"""
        SELECT ROUND(COALESCE(AVG(fpp.duree_totale_minutes) / 60.0, 0)::NUMERIC, 2)
        FROM warehouse.fact_parcel_performance fpp
        JOIN warehouse.dim_parcel dp ON fpp.parcel_id = dp.parcel_id
        JOIN warehouse.dim_date dd ON dp.date_creation_id = dd.date_key
        WHERE {_W} AND dp.current_status_id = 13
    """,
    "pd_perf_claims_count": f"""
        SELECT COUNT(*)
        FROM warehouse.dim_remboursement dr
        JOIN warehouse.dim_date dd ON dr.date_remboursement_id = dd.date_key
        WHERE {_W}
    """,

    # ── Transport — Operations ────────────────────────────────────────────────
    "tr_ops_total_requests": f"""
        SELECT COUNT(*)
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_ops_completion_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE dts.status_name = 'terminée')
            / NULLIF(COUNT(*), 0)::NUMERIC, 2
        )
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        JOIN warehouse.dim_transport_status dts ON dt.status_id = dts.status_id
        WHERE {_W}
    """,
    "tr_ops_cancellation_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE dts.status_name = 'annulée')
            / NULLIF(COUNT(*), 0)::NUMERIC, 2
        )
        FROM warehouse.dim_transport dt
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        JOIN warehouse.dim_transport_status dts ON dt.status_id = dts.status_id
        WHERE {_W}
    """,
    "tr_ops_avg_distance": f"""
        SELECT ROUND(COALESCE(AVG(ftp.distance_real_km), 0)::NUMERIC, 2)
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_ops_avg_stops": f"""
        SELECT ROUND(COALESCE(AVG(ftp.nbr_stops_total), 0)::NUMERIC, 2)
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,

    # ── Transport — Cost & Profitability ─────────────────────────────────────
    "tr_cost_total_revenue": f"""
        SELECT COALESCE(SUM(ftb.amount_invoiced), 0)
        FROM warehouse.fact_transport_billing ftb
        JOIN warehouse.dim_transport dt ON ftb.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_cost_total_cost": f"""
        SELECT COALESCE(SUM(ftc.total_cost), 0)
        FROM warehouse.fact_transport_cost ftc
        JOIN warehouse.dim_transport dt ON ftc.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_cost_gross_margin": f"""
        SELECT COALESCE(SUM(ftb.marge_brute_dzd), 0)
        FROM warehouse.fact_transport_billing ftb
        JOIN warehouse.dim_transport dt ON ftb.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_cost_margin_pct": f"""
        SELECT ROUND(
            100.0 * COALESCE(SUM(ftb.marge_brute_dzd), 0)
            / NULLIF(SUM(ftb.amount_invoiced), 0)::NUMERIC, 2
        )
        FROM warehouse.fact_transport_billing ftb
        JOIN warehouse.dim_transport dt ON ftb.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_cost_per_km": f"""
        SELECT ROUND(
            COALESCE(SUM(ftc.total_cost), 0)
            / NULLIF(SUM(ftp.distance_real_km), 0)::NUMERIC, 2
        )
        FROM warehouse.fact_transport_cost ftc
        JOIN warehouse.fact_transport_performance ftp ON ftc.transport_id = ftp.transport_id
        JOIN warehouse.dim_transport dt ON ftc.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,

    # ── Transport — Performance ───────────────────────────────────────────────
    "tr_perf_on_time_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE ftp.is_on_time = TRUE)
            / NULLIF(COUNT(*) FILTER (WHERE ftp.is_on_time IS NOT NULL), 0)::NUMERIC, 2
        )
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_perf_avg_duration": f"""
        SELECT ROUND(COALESCE(AVG(ftp.total_duration_minutes) / 60.0, 0)::NUMERIC, 2)
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
    "tr_perf_avg_rating": f"""
        SELECT ROUND(COALESCE(AVG(ftp.client_rating), 0)::NUMERIC, 2)
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W} AND ftp.client_rating IS NOT NULL
    """,
    "tr_perf_avg_delay": f"""
        SELECT ROUND(COALESCE(AVG(ftp.arrival_delay_minutes), 0)::NUMERIC, 2)
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_transport_status dts ON dt.status_id = dts.status_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
          AND dts.status_name = 'terminée'
          AND ftp.arrival_delay_minutes IS NOT NULL
    """,
    "tr_perf_night_shift_rate": f"""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE ftp.night_shift_hours > 0)
            / NULLIF(COUNT(*), 0)::NUMERIC, 2
        )
        FROM warehouse.fact_transport_performance ftp
        JOIN warehouse.dim_transport dt ON ftp.transport_id = dt.transport_id
        JOIN warehouse.dim_date dd ON dt.created_date_id = dd.date_key
        WHERE {_W}
    """,
}


def _fetch_metric(metric: str) -> float | None:
    """Run the metric SQL on the warehouse DB and return a float or None."""
    sql = _METRIC_QUERIES.get(metric)
    if not sql:
        return None
    try:
        with connections["warehouse"].cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
            return float(row[0]) if row and row[0] is not None else None
    except Exception as exc:
        logger.warning("Failed to fetch metric %s: %s", metric, exc)
        return None


_SEVERITY_META = {
    "info":     ("ℹ️",  "Information", "#6366f1", "#1e1b4b"),
    "warning":  ("⚠️",  "Avertissement", "#f59e0b", "#1c1000"),
    "critical": ("🚨", "Critique",     "#ef4444", "#200a0a"),
}

_OPERATOR_LABELS = {
    "gt": "supérieur à",
    "gte": "supérieur ou égal à",
    "lt": "inférieur à",
    "lte": "inférieur ou égal à",
}

_DASHBOARD_LABELS = {
    "parcels": "Livraison Colis",
    "transport": "Transport à la demande",
}

_CATEGORY_LABELS = {
    "operations": "Opérations",
    "cost_profitability": "Coûts & Rentabilité",
    "performance": "Performance",
}


def _notify_users_for_rule(rule, alert):
    """Dispatch in-app and email notifications for a fired AlertRule.

    Respects three layers of filtering:
    1. Role / dashboard targeting defined on the AlertRule
    2. UserPreferences.notif_alert_triggered (blanket on/off for alerts)
    3. UserAlertRulePreference.is_subscribed (per-rule opt-out)

    For each eligible user:
    - notif_in_app=True → creates a Notification row (SSE-delivered)
    - notif_email=True  → sends an HTML email via alert_email.html
    """
    from datetime import datetime, timedelta

    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string

    from apps.notifications.models import Notification, UserAlertRulePreference
    from apps.users.models import User

    # ── Resolve eligible users ────────────────────────────────────────────────
    base_qs = User.objects.filter(is_active=True).select_related("preferences", "role")

    if rule.notify_roles:
        base_qs = base_qs.filter(role__name__in=rule.notify_roles)

    users = [
        u for u in base_qs
        if u.can_access_dashboard(rule.dashboard)
        and getattr(getattr(u, "preferences", None), "notif_alert_triggered", True)
    ]

    unsubscribed_ids = set(
        UserAlertRulePreference.objects
        .filter(rule=rule, is_subscribed=False)
        .values_list("user_id", flat=True)
    )
    users = [u for u in users if u.pk not in unsubscribed_ids]

    if not users:
        return

    # ── Build shared context ──────────────────────────────────────────────────
    severity_icon, severity_label, severity_color, severity_bg_color = _SEVERITY_META.get(
        rule.severity, ("🔔", rule.severity, "#6366f1", "#1e1b4b")
    )
    title = f"{severity_icon} {rule.name}"
    operator_label = _OPERATOR_LABELS.get(rule.operator, rule.operator)
    plain_message = (
        f"La métrique «{rule.get_metric_display()}» a atteint "
        f"{alert.triggered_value:.2f} "
        f"(seuil : {operator_label} {rule.threshold})."
    )

    today = datetime.today()
    week_start = (today - timedelta(days=7)).strftime("%d/%m/%Y")
    week_end = (today - timedelta(days=1)).strftime("%d/%m/%Y")

    template_ctx = {
        "title": title,
        "rule_name": rule.name,
        "rule_description": rule.description,
        "metric_display": rule.get_metric_display(),
        "triggered_value": f"{alert.triggered_value:.2f}",
        "threshold": rule.threshold,
        "operator_label": operator_label,
        "severity": rule.severity,
        "severity_label": severity_label,
        "severity_color": severity_color,
        "severity_bg_color": severity_bg_color,
        "severity_icon": severity_icon,
        "dashboard_label": _DASHBOARD_LABELS.get(rule.dashboard, rule.dashboard),
        "kpi_category_label": _CATEGORY_LABELS.get(rule.kpi_category, rule.kpi_category),
        "week_start": week_start,
        "week_end": week_end,
        "current_year": today.year,
    }

    # ── Dispatch ──────────────────────────────────────────────────────────────
    in_app_batch = []
    emails_sent = 0

    for user in users:
        prefs = user.preferences

        if prefs.notif_in_app:
            in_app_batch.append(Notification(
                user=user,
                notification_type="alert",
                title=title,
                message=plain_message,
                metadata={
                    "alert_id": alert.id,
                    "rule_id": rule.id,
                    "dashboard": rule.dashboard,
                    "severity": rule.severity,
                },
            ))

        if prefs.notif_email and user.email:
            try:
                email = EmailMultiAlternatives(
                    subject=f"[LOGIQ Alerte] {rule.name} — {severity_label}",
                    body=render_to_string("notifications/alert_email.txt", template_ctx),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                email.attach_alternative(
                    render_to_string("notifications/alert_email.html", template_ctx),
                    "text/html",
                )
                email.send(fail_silently=False)
                emails_sent += 1
            except Exception as exc:
                logger.warning("Alert email failed for %s: %s", user.email, exc)

    if in_app_batch:
        Notification.objects.bulk_create(in_app_batch, ignore_conflicts=True)

    logger.info(
        "Rule '%s' [%s] — in-app: %d, email: %d",
        rule.name, rule.severity, len(in_app_batch), emails_sent,
    )


@shared_task(name="apps.notifications.tasks.evaluate_alert_rules", bind=True, max_retries=2)
def evaluate_alert_rules(self):
    """
    Evaluate all active AlertRules against current warehouse metrics.
    Fires once per rule per cooldown window.
    """
    from apps.notifications.models import Alert, AlertRule

    rules = AlertRule.objects.filter(is_active=True).select_related("created_by")
    fired = 0

    for rule in rules:
        if rule.is_in_cooldown():
            continue

        current_value = _fetch_metric(rule.metric)
        if current_value is None:
            continue

        if rule.evaluate(current_value):
            alert = Alert.objects.create(rule=rule, triggered_value=current_value)
            rule.last_triggered_at = timezone.now()
            rule.save(update_fields=["last_triggered_at"])
            _notify_users_for_rule(rule, alert)
            logger.info("Alert fired: rule=%s value=%s", rule.name, current_value)
            fired += 1

    logger.info("Alert evaluation complete. %d rule(s) fired.", fired)
    return {"evaluated": rules.count(), "fired": fired}


_ETL_STATUS_META = {
    "success":   ("✅", "terminé avec succès", "#10b981", "#052e16"),
    "failed":    ("❌", "échoué",              "#ef4444", "#200a0a"),
    "cancelled": ("⚠️", "annulé",             "#6b7280", "#1c1c1e"),
}


def _format_duration(seconds: int | None) -> str:
    if not seconds:
        return ""
    m, s = divmod(seconds, 60)
    return f"{m}m {s}s" if m else f"{s}s"


@shared_task(name="apps.notifications.tasks.notify_etl_complete")
def notify_etl_complete(
    job_name: str,
    status: str,
    duration_seconds: int | None = None,
    total_rows: int = 0,
    error_message: str = "",
):
    """
    Dispatch ETL run completion notifications via in-app and/or email channels
    based on each active user's notification preferences.

    Channels:
    - notif_in_app=True  → creates a Notification row (picked up by the SSE stream)
    - notif_email=True   → sends an email via the configured EMAIL_BACKEND
    Both require notif_etl_status=True.
    """
    from datetime import datetime

    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string

    from apps.notifications.models import Notification
    from apps.users.models import User

    icon, status_label, status_color, status_bg_color = _ETL_STATUS_META.get(
        status, ("🔔", status, "#6366f1", "#1e1b4b")
    )
    title = f"{icon} ETL {job_name} {status_label}"

    parts = [f"Le pipeline «{job_name}» s'est {status_label}."]
    if duration_seconds:
        parts.append(f"Durée : {_format_duration(duration_seconds)}.")
    if total_rows:
        parts.append(f"Lignes chargées : {total_rows:,}.")
    if error_message and status == "failed":
        parts.append(f"Erreur : {error_message[:500]}")
    plain_message = " ".join(parts)

    template_ctx = {
        "title": title,
        "job_name": job_name,
        "status": status,
        "status_label": status_label,
        "status_color": status_color,
        "status_bg_color": status_bg_color,
        "status_icon": icon,
        "duration": _format_duration(duration_seconds),
        "total_rows_formatted": f"{total_rows:,}" if total_rows else "",
        "error_message": error_message[:600] if error_message and status == "failed" else "",
        "current_year": datetime.now().year,
    }

    target_users = list(
        User.objects.filter(is_active=True, preferences__notif_etl_status=True)
        .select_related("preferences")
    )

    in_app_batch = []
    emails_sent = 0

    for user in target_users:
        prefs = user.preferences

        if prefs.notif_in_app:
            in_app_batch.append(Notification(
                user=user,
                notification_type="etl",
                title=title,
                message=plain_message,
                metadata={
                    "job": job_name,
                    "status": status,
                    "duration_s": duration_seconds,
                    "total_rows": total_rows,
                },
            ))

        if prefs.notif_email and user.email:
            try:
                email = EmailMultiAlternatives(
                    subject=f"[LOGIQ ETL] {job_name} — {status_label.capitalize()}",
                    body=render_to_string("notifications/etl_email.txt", template_ctx),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                email.attach_alternative(
                    render_to_string("notifications/etl_email.html", template_ctx),
                    "text/html",
                )
                email.send(fail_silently=False)
                emails_sent += 1
            except Exception as exc:
                logger.warning("ETL email failed for %s: %s", user.email, exc)

    if in_app_batch:
        Notification.objects.bulk_create(in_app_batch)

    logger.info(
        "ETL '%s' [%s] — in-app: %d, email: %d",
        job_name, status, len(in_app_batch), emails_sent,
    )
