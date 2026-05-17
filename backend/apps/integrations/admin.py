from django.contrib import admin
from django.utils.html import format_html

from .models import ETLRun


@admin.register(ETLRun)
class ETLRunAdmin(admin.ModelAdmin):
    list_display = [
        "job_name", "status_badge", "triggered_by",
        "started_at", "duration_col", "total_rows_loaded", "assets_count",
    ]
    list_filter = ["status", "job_name", "triggered_by"]
    search_fields = ["job_name", "dagster_run_id"]
    readonly_fields = [
        "dagster_run_id", "job_name", "status", "triggered_by",
        "started_at", "finished_at", "duration_seconds",
        "assets_materialized", "total_rows_loaded", "error_message", "tags",
    ]
    ordering = ["-started_at"]
    date_hierarchy = "started_at"

    def status_badge(self, obj):
        colors = {
            "running": "#6366f1", "success": "#10b981",
            "failed": "#ef4444", "cancelled": "#9ca3af",
        }
        icons = {"running": "⏳", "success": "✅", "failed": "❌", "cancelled": "⚠️"}
        color = colors.get(obj.status, "#9ca3af")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 10px;'
            'border-radius:9999px;font-size:11px">{} {}</span>',
            color, icons.get(obj.status, ""), obj.get_status_display(),
        )
    status_badge.short_description = "Statut"

    def duration_col(self, obj):
        return obj.duration_display
    duration_col.short_description = "Durée"

    def assets_count(self, obj):
        return len(obj.assets_materialized)
    assets_count.short_description = "Assets"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
