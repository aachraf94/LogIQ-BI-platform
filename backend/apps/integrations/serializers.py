from rest_framework import serializers

from .models import ETLRun


class ETLRunSerializer(serializers.ModelSerializer):
    duration_display = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ETLRun
        fields = [
            "id", "dagster_run_id", "job_name",
            "status", "status_display",
            "triggered_by", "started_at", "finished_at",
            "duration_seconds", "duration_display",
            "assets_materialized", "total_rows_loaded",
            "error_message", "tags",
        ]
        read_only_fields = ["id", "duration_display", "status_display"]


class ETLWebhookSerializer(serializers.Serializer):
    """Payload posted by Dagster on run start and completion."""
    dagster_run_id = serializers.CharField(max_length=64)
    job_name = serializers.CharField(max_length=100)
    status = serializers.ChoiceField(choices=["running", "success", "failed", "cancelled"])
    triggered_by = serializers.ChoiceField(
        choices=["schedule", "manual", "sensor"], default="schedule"
    )
    started_at = serializers.DateTimeField()
    finished_at = serializers.DateTimeField(required=False, allow_null=True)
    duration_seconds = serializers.IntegerField(required=False, allow_null=True)
    assets_materialized = serializers.DictField(
        child=serializers.IntegerField(), required=False, default=dict
    )
    total_rows_loaded = serializers.IntegerField(required=False, default=0)
    error_message = serializers.CharField(required=False, allow_blank=True, default="")
    tags = serializers.DictField(required=False, default=dict)


class DataFreshnessSerializer(serializers.Serializer):
    """
    Compact freshness summary for the dashboard header.
    Shows when data was last successfully loaded and the lag in human-readable form.
    """
    last_successful_run = ETLRunSerializer(allow_null=True)
    last_run = ETLRunSerializer(allow_null=True)
    is_stale = serializers.BooleanField(
        help_text="True if last successful run was more than 26 hours ago"
    )
    lag_display = serializers.CharField(
        help_text="Human-readable lag, e.g. 'Il y a 2h', 'Hier'"
    )
    runs_last_7_days = serializers.IntegerField()
    success_rate_pct = serializers.FloatField()


class HealthSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["healthy", "degraded", "down"])
    timestamp = serializers.DateTimeField()
    services = serializers.DictField()


class PlatformStatsSerializer(serializers.Serializer):
    """Superadmin-only detailed platform statistics."""
    users_total = serializers.IntegerField()
    users_active = serializers.IntegerField()
    users_online_now = serializers.IntegerField(
        help_text="Sessions active in the last 15 minutes"
    )
    unacknowledged_alerts = serializers.IntegerField()
    active_alert_rules = serializers.IntegerField()
    notifications_unread_total = serializers.IntegerField()
    etl_runs_today = serializers.IntegerField()
    last_etl_status = serializers.CharField(allow_null=True)
    last_etl_job = serializers.CharField(allow_null=True)
    last_etl_at = serializers.DateTimeField(allow_null=True)
