from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Alert, AlertRule, Notification


class NotificationSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_notification_type_display", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id", "notification_type", "type_display",
            "title", "message", "is_read", "read_at",
            "metadata", "created_at",
        ]
        read_only_fields = fields


class NotificationCountSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    unread = serializers.IntegerField()


class AlertRuleSerializer(serializers.ModelSerializer):
    metric_display = serializers.CharField(source="get_metric_display", read_only=True)
    operator_display = serializers.CharField(source="get_operator_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    trigger_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AlertRule
        fields = [
            "id", "name", "description",
            "metric", "metric_display",
            "operator", "operator_display",
            "threshold", "severity", "severity_display",
            "dashboard", "notify_roles",
            "is_active", "cooldown_minutes",
            "last_triggered_at", "trigger_count",
            "created_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["last_triggered_at", "trigger_count", "created_by_name", "created_at", "updated_at"]

    @extend_schema_field(serializers.IntegerField())
    def get_trigger_count(self, obj):
        return obj.alerts.count()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return None


class AlertRuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = [
            "name", "description", "metric", "operator",
            "threshold", "severity", "dashboard",
            "notify_roles", "is_active", "cooldown_minutes",
        ]


class AlertSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)
    rule_metric = serializers.CharField(source="rule.metric", read_only=True)
    rule_severity = serializers.CharField(source="rule.severity", read_only=True)
    rule_dashboard = serializers.CharField(source="rule.dashboard", read_only=True)
    acknowledged_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            "id", "rule", "rule_name", "rule_metric", "rule_severity", "rule_dashboard",
            "triggered_value", "triggered_at",
            "is_acknowledged", "acknowledged_by_name", "acknowledged_at", "note",
        ]
        read_only_fields = [f for f in fields if f != "rule"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by:
            return obj.acknowledged_by.full_name or obj.acknowledged_by.username
        return None


class AlertAcknowledgeSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")
