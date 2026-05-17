import os

from django.db import connections
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsSuperAdmin

from .models import ETLRun
from .serializers import (
    DataFreshnessSerializer,
    ETLRunSerializer,
    ETLWebhookSerializer,
    HealthSerializer,
    PlatformStatsSerializer,
)


# ---------------------------------------------------------------------------
# ETL Webhook — called by Dagster
# ---------------------------------------------------------------------------

@extend_schema(tags=["etl"])
class ETLWebhookView(APIView):
    """
    Webhook called by Dagster after each pipeline run (start + completion).
    Secured by a shared secret in the `X-Dagster-Webhook-Token` header.
    On completion, dispatches the `notify_etl_complete` Celery task.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        request=ETLWebhookSerializer,
        responses={
            200: OpenApiResponse(description="Run updated"),
            201: OpenApiResponse(description="Run created"),
            401: OpenApiResponse(description="Invalid webhook token"),
        },
    )
    def post(self, request):
        # Shared-secret auth (simpler than JWT for machine-to-machine)
        expected = os.environ.get("DAGSTER_WEBHOOK_TOKEN", "")
        received = request.headers.get("X-Dagster-Webhook-Token", "")
        if expected and received != expected:
            return Response({"detail": "Token invalide."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = ETLWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        run, created = ETLRun.objects.update_or_create(
            dagster_run_id=data["dagster_run_id"],
            defaults={
                "job_name": data["job_name"],
                "status": data["status"],
                "triggered_by": data.get("triggered_by", "schedule"),
                "started_at": data["started_at"],
                "finished_at": data.get("finished_at"),
                "duration_seconds": data.get("duration_seconds"),
                "assets_materialized": data.get("assets_materialized", {}),
                "total_rows_loaded": data.get("total_rows_loaded", 0),
                "error_message": data.get("error_message", ""),
                "tags": data.get("tags", {}),
            },
        )

        # Notify users when a run completes (success or failure)
        if data["status"] in ("success", "failed") and data.get("duration_seconds"):
            from apps.notifications.tasks import notify_etl_complete
            notify_etl_complete.delay(
                job_name=data["job_name"],
                duration_seconds=data["duration_seconds"],
                success=(data["status"] == "success"),
            )

        return Response(
            ETLRunSerializer(run).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(tags=["etl"])
class ETLRunListView(generics.ListAPIView):
    """
    List ETL pipeline runs, newest first.
    Filterable by `job_name` and `status`.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ETLRunSerializer
    filterset_fields = ["job_name", "status"]
    ordering_fields = ["started_at", "duration_seconds"]
    ordering = ["-started_at"]

    def get_queryset(self):
        return ETLRun.objects.all()[:100]


@extend_schema(tags=["etl"])
class DataFreshnessView(APIView):
    """
    Returns a compact data-freshness summary for the dashboard header:
    last successful run, staleness flag, and human-readable lag.
    Available to all authenticated users.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: DataFreshnessSerializer})
    def get(self, request):
        now = timezone.now()
        last_success = ETLRun.last_successful()
        last_run = ETLRun.objects.first()

        lag_display = "Jamais"
        is_stale = True
        if last_success:
            delta = now - last_success.finished_at if last_success.finished_at else None
            is_stale = delta is None or delta.total_seconds() > 26 * 3600
            if delta:
                minutes = int(delta.total_seconds() / 60)
                if minutes < 1:
                    lag_display = "À l'instant"
                elif minutes < 60:
                    lag_display = f"Il y a {minutes} min"
                elif minutes < 1440:
                    lag_display = f"Il y a {minutes // 60}h"
                elif minutes < 2880:
                    lag_display = "Hier"
                else:
                    lag_display = f"Il y a {minutes // 1440} jours"

        from datetime import timedelta
        week_ago = now - timedelta(days=7)
        runs_week = ETLRun.objects.filter(started_at__gte=week_ago)
        total_week = runs_week.count()
        success_week = runs_week.filter(status="success").count()
        success_rate = round(100 * success_week / total_week, 1) if total_week else 0.0

        return Response({
            "last_successful_run": ETLRunSerializer(last_success).data if last_success else None,
            "last_run": ETLRunSerializer(last_run).data if last_run else None,
            "is_stale": is_stale,
            "lag_display": lag_display,
            "runs_last_7_days": total_week,
            "success_rate_pct": success_rate,
        })


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def _check_db(alias: str) -> dict:
    try:
        connections[alias].ensure_connection()
        with connections[alias].cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "healthy"}
    except Exception as exc:
        return {"status": "down", "error": str(exc)}


def _check_redis() -> dict:
    try:
        import redis
        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(url, socket_connect_timeout=2)
        r.ping()
        return {"status": "healthy"}
    except Exception as exc:
        return {"status": "down", "error": str(exc)}


@extend_schema(tags=["health"])
class HealthView(APIView):
    """
    Public health check endpoint.
    Returns overall platform status and per-service connectivity.
    Used by load balancers, uptime monitors, and the admin dashboard.
    """
    permission_classes = [AllowAny]

    @extend_schema(responses={200: HealthSerializer, 503: HealthSerializer})
    def get(self, request):
        services = {
            "platform_db": _check_db("default"),
            "warehouse_db": _check_db("warehouse"),
            "cache": _check_redis(),
        }
        all_healthy = all(s["status"] == "healthy" for s in services.values())
        overall = "healthy" if all_healthy else "degraded"

        payload = {
            "status": overall,
            "timestamp": timezone.now(),
            "services": services,
        }
        http_status = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(payload, status=http_status)


@extend_schema(tags=["health"])
class PlatformStatsView(APIView):
    """
    Detailed platform statistics for the superadmin dashboard.
    Aggregates user counts, alert state, ETL history, and online sessions.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: PlatformStatsSerializer})
    def get(self, request):
        from datetime import timedelta

        from apps.notifications.models import Alert, AlertRule, Notification
        from apps.users.models import LoginSession, User

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        online_cutoff = now - timedelta(minutes=15)

        last_etl = ETLRun.objects.first()

        return Response({
            "users_total": User.objects.count(),
            "users_active": User.objects.filter(is_active=True).count(),
            "users_online_now": LoginSession.objects.filter(
                is_active=True, logged_in_at__gte=online_cutoff
            ).values("user").distinct().count(),
            "unacknowledged_alerts": Alert.objects.filter(is_acknowledged=False).count(),
            "active_alert_rules": AlertRule.objects.filter(is_active=True).count(),
            "notifications_unread_total": Notification.objects.filter(is_read=False).count(),
            "etl_runs_today": ETLRun.objects.filter(started_at__gte=today_start).count(),
            "last_etl_status": last_etl.status if last_etl else None,
            "last_etl_job": last_etl.job_name if last_etl else None,
            "last_etl_at": last_etl.started_at if last_etl else None,
        })
