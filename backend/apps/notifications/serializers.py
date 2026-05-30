from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Alert, AlertRule, Notification, UserAlertRulePreference


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="notification_type", read_only=True)
    type_display = serializers.CharField(source="get_notification_type_display", read_only=True)
    body = serializers.CharField(source="message", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id", "type", "type_display",
            "title", "body", "is_read", "read_at",
            "metadata", "created_at",
        ]
        read_only_fields = fields


class NotificationCountSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    unread = serializers.IntegerField()


class AlertRuleSerializer(serializers.ModelSerializer):
    metric_display = serializers.CharField(source="get_metric_display", read_only=True)
    condition = serializers.CharField(source="operator", read_only=True)
    operator_display = serializers.CharField(source="get_operator_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    trigger_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AlertRule
        fields = [
            "id", "name", "description", "is_default",
            "metric", "metric_display",
            "operator", "condition", "operator_display",
            "threshold", "severity", "severity_display",
            "dashboard", "notify_roles",
            "is_active", "cooldown_minutes",
            "last_triggered_at", "trigger_count",
            "created_by_name", "created_at", "updated_at",
        ]
        read_only_fields = [
            "last_triggered_at", "trigger_count", "created_by_name",
            "created_at", "updated_at",
        ]

    @extend_schema_field(serializers.IntegerField())
    def get_trigger_count(self, obj):
        return obj.alerts.count()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return None


class AlertRuleWithPreferenceSerializer(AlertRuleSerializer):
    """AlertRule enriched with the requesting user's subscription status."""
    is_subscribed = serializers.SerializerMethodField()

    class Meta(AlertRuleSerializer.Meta):
        fields = AlertRuleSerializer.Meta.fields + ["is_subscribed"]

    @extend_schema_field(serializers.BooleanField())
    def get_is_subscribed(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return True
        try:
            pref = UserAlertRulePreference.objects.get(user=request.user, rule=obj)
            return pref.is_subscribed
        except UserAlertRulePreference.DoesNotExist:
            return True  # implicit subscription


class AlertRuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = [
            "name", "description", "metric", "operator",
            "threshold", "severity", "dashboard",
            "notify_roles", "is_active", "cooldown_minutes",
        ]


class UserAlertRulePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAlertRulePreference
        fields = ["rule_id", "is_subscribed", "updated_at"]
        read_only_fields = ["rule_id", "updated_at"]


class AlertSerializer(serializers.ModelSerializer):
    rule = AlertRuleSerializer(read_only=True)
    severity = serializers.CharField(source="rule.severity", read_only=True)
    acknowledged_by = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="triggered_at", read_only=True)

    class Meta:
        model = Alert
        fields = [
            "id", "rule",
            "triggered_value", "severity", "created_at",
            "is_acknowledged", "acknowledged_by", "acknowledged_at", "note",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_acknowledged_by(self, obj):
        if obj.acknowledged_by:
            return obj.acknowledged_by.full_name or obj.acknowledged_by.username
        return None


class AlertAcknowledgeSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")
