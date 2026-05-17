from django.db import models


class ETLRun(models.Model):
    """
    Records every Dagster pipeline execution.
    Dagster calls POST /api/integrations/etl/webhook/ on start and completion.
    Powers the "Data freshness" indicator in the dashboard header.
    """
    STATUS_CHOICES = [
        ("running", "En cours"),
        ("success", "Succès"),
        ("failed", "Échec"),
        ("cancelled", "Annulé"),
    ]
    TRIGGER_CHOICES = [
        ("schedule", "Planifié"),
        ("manual", "Manuel"),
        ("sensor", "Capteur"),
    ]

    dagster_run_id = models.CharField(max_length=64, unique=True, db_index=True)
    job_name = models.CharField(max_length=100, db_index=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="running", db_index=True)
    triggered_by = models.CharField(max_length=10, choices=TRIGGER_CHOICES, default="schedule")
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    # Asset-level row counts: {"fact_livraisons": 45000, "dim_agence": 12, ...}
    assets_materialized = models.JSONField(default=dict)
    total_rows_loaded = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    # Metadata from Dagster run tags
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = "integrations_etl_run"
        ordering = ["-started_at"]

    def __str__(self):
        icon = {"running": "⏳", "success": "✅", "failed": "❌", "cancelled": "⚠️"}.get(self.status, "?")
        return f"{icon} {self.job_name} — {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def duration_display(self) -> str:
        if not self.duration_seconds:
            return "—"
        m, s = divmod(self.duration_seconds, 60)
        return f"{m}m {s}s" if m else f"{s}s"

    @classmethod
    def last_successful(cls):
        return cls.objects.filter(status="success").first()
