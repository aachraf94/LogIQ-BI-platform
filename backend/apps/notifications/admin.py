from django.contrib import admin, messages
from django.utils.html import format_html

from .models import Alert, AlertRule, Notification, UserAlertRulePreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "type_badge", "is_read", "created_at"]
    list_filter = ["notification_type", "is_read"]
    search_fields = ["user__username", "title", "message"]
    readonly_fields = ["user", "notification_type", "title", "message", "metadata",
                       "is_read", "read_at", "created_at"]
    ordering = ["-created_at"]
    date_hierarchy = "created_at"
    actions = ["mark_all_read"]

    def type_badge(self, obj):
        colors = {"alert": "#ef4444", "etl": "#6366f1", "announcement": "#0ea5e9", "system": "#9ca3af"}
        color = colors.get(obj.notification_type, "#9ca3af")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px">{}</span>',
            color, obj.get_notification_type_display(),
        )
    type_badge.short_description = "Type"

    @admin.action(description="Marquer comme lues")
    def mark_all_read(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(is_read=False).update(is_read=True, read_at=timezone.now())
        self.message_user(request, f"{updated} notification(s) marquée(s) comme lues.", messages.SUCCESS)

    def has_add_permission(self, request):
        return False


@admin.register(AlertRule)
class AlertRuleAdmin(admin.ModelAdmin):
    list_display = ["name", "is_default", "kpi_category", "metric_display_col", "condition_display",
                    "severity_badge", "dashboard", "is_active", "cooldown_minutes", "last_triggered_at", "trigger_count"]
    list_filter = ["is_active", "is_default", "severity", "dashboard", "kpi_category", "metric"]
    search_fields = ["name", "description"]
    readonly_fields = ["last_triggered_at", "created_at", "updated_at", "trigger_count"]
    ordering = ["-is_default", "dashboard", "kpi_category", "-created_at"]
    fieldsets = [
        (None, {"fields": ["name", "description", "is_active", "is_default"]}),
        ("Condition", {"fields": ["dashboard", "kpi_category", "metric", "operator", "threshold", "severity"]}),
        ("Portée", {"fields": ["notify_roles", "cooldown_minutes"]}),
        ("Statistiques", {"fields": ["last_triggered_at", "trigger_count", "created_at", "updated_at"],
                          "classes": ["collapse"]}),
    ]

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def metric_display_col(self, obj):
        return obj.get_metric_display()
    metric_display_col.short_description = "Métrique"

    def condition_display(self, obj):
        op_symbols = {"gt": ">", "gte": "≥", "lt": "<", "lte": "≤"}
        return f"{op_symbols.get(obj.operator, obj.operator)} {obj.threshold}"
    condition_display.short_description = "Condition"

    def severity_badge(self, obj):
        colors = {"info": "#6366f1", "warning": "#f59e0b", "critical": "#ef4444"}
        color = colors.get(obj.severity, "#9ca3af")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px">{}</span>',
            color, obj.get_severity_display(),
        )
    severity_badge.short_description = "Sévérité"

    def trigger_count(self, obj):
        return obj.alerts.count()
    trigger_count.short_description = "Déclenchements"


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["rule", "triggered_value", "severity_badge", "triggered_at",
                    "is_acknowledged", "acknowledged_by", "acknowledged_at"]
    list_filter = ["is_acknowledged", "rule__severity", "rule__dashboard"]
    search_fields = ["rule__name", "acknowledged_by__username"]
    readonly_fields = ["rule", "triggered_value", "triggered_at",
                       "is_acknowledged", "acknowledged_by", "acknowledged_at", "note"]
    ordering = ["-triggered_at"]
    date_hierarchy = "triggered_at"
    actions = ["bulk_acknowledge"]

    def severity_badge(self, obj):
        colors = {"info": "#6366f1", "warning": "#f59e0b", "critical": "#ef4444"}
        color = colors.get(obj.rule.severity, "#9ca3af")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px">{}</span>',
            color, obj.rule.get_severity_display(),
        )
    severity_badge.short_description = "Sévérité"

    @admin.action(description="Acquitter les alertes sélectionnées")
    def bulk_acknowledge(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(is_acknowledged=False).update(
            is_acknowledged=True,
            acknowledged_by=request.user,
            acknowledged_at=timezone.now(),
            note="Acquitté en masse via admin",
        )
        self.message_user(request, f"{updated} alerte(s) acquittée(s).", messages.SUCCESS)

    def has_add_permission(self, request):
        return False


@admin.register(UserAlertRulePreference)
class UserAlertRulePreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "rule", "is_subscribed", "updated_at"]
    list_filter = ["is_subscribed", "rule__dashboard", "rule__severity"]
    search_fields = ["user__username", "rule__name"]
    readonly_fields = ["updated_at"]
    ordering = ["user__username", "rule__name"]
