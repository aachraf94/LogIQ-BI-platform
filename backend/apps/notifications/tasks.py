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

_METRIC_QUERIES = {
    "ecart_tarif_pct": """
        SELECT ROUND(AVG(ecart_tarif_dzd / NULLIF(tarif_theorique, 0) * 100)::NUMERIC, 2)
        FROM warehouse.fact_livraisons
        WHERE date_key >= (SELECT date_key FROM warehouse.dim_date
                           WHERE full_date = DATE_TRUNC('month', CURRENT_DATE))
          AND tarif_theorique IS NOT NULL AND ecart_tarif_dzd IS NOT NULL
    """,
    "taux_livraison_pct": """
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE statut_final = 'Livré')
            / NULLIF(COUNT(*), 0)
        ::NUMERIC, 2)
        FROM warehouse.fact_livraisons
        WHERE date_key >= (SELECT date_key FROM warehouse.dim_date
                           WHERE full_date = DATE_TRUNC('month', CURRENT_DATE))
    """,
    "transport_cost_dzd": """
        SELECT COALESCE(SUM(total_cost), 0)
        FROM warehouse.fact_transport
        WHERE date_key IN (
            SELECT date_key FROM warehouse.dim_date
            WHERE EXTRACT(YEAR FROM full_date) = EXTRACT(YEAR FROM CURRENT_DATE)
              AND EXTRACT(MONTH FROM full_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        )
    """,
    "nbr_sous_tarif": """
        SELECT COUNT(*)
        FROM warehouse.fact_livraisons
        WHERE date_key >= (SELECT date_key FROM warehouse.dim_date
                           WHERE full_date = DATE_TRUNC('month', CURRENT_DATE))
          AND ecart_tarif_dzd < 0
    """,
    "marge_brute_transport_pct": """
        SELECT ROUND(
            100.0 * SUM(amount_invoiced - total_cost)
            / NULLIF(SUM(amount_invoiced), 0)
        ::NUMERIC, 2)
        FROM warehouse.fact_transport
        WHERE date_key IN (
            SELECT date_key FROM warehouse.dim_date
            WHERE EXTRACT(YEAR FROM full_date) = EXTRACT(YEAR FROM CURRENT_DATE)
              AND EXTRACT(MONTH FROM full_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        )
    """,
    "nbr_livraisons_jour": """
        SELECT COUNT(*)
        FROM warehouse.fact_livraisons
        WHERE date_key = (SELECT date_key FROM warehouse.dim_date
                          WHERE full_date = CURRENT_DATE)
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


def _notify_users_for_rule(rule, alert):
    """Create in-app Notification rows for all users targeted by this rule."""
    from apps.notifications.models import Notification
    from apps.users.models import User

    qs = User.objects.filter(is_active=True)
    if rule.notify_roles:
        qs = qs.filter(role__name__in=rule.notify_roles)
    else:
        # Notify all users who have access to the rule's dashboard
        qs = [u for u in qs if u.can_access_dashboard(rule.dashboard)]

    severity_emoji = {"info": "ℹ️", "warning": "⚠️", "critical": "🚨"}.get(rule.severity, "🔔")
    notifications = [
        Notification(
            user=user,
            notification_type="alert",
            title=f"{severity_emoji} {rule.name}",
            message=(
                f"La métrique «{rule.get_metric_display()}» a atteint "
                f"{alert.triggered_value:.2f} "
                f"(seuil configuré : {rule.get_operator_display()} {rule.threshold})."
            ),
            metadata={
                "alert_id": alert.id,
                "rule_id": rule.id,
                "dashboard": rule.dashboard,
                "severity": rule.severity,
            },
        )
        for user in qs
    ]
    if notifications:
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)


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
