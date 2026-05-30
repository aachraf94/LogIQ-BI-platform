from django.db import models
from django.utils import timezone


class Notification(models.Model):
    """
    In-app notification delivered to a specific user.
    Created by the system (ETL events, alert triggers) or by admin (announcements).
    """
    TYPE_CHOICES = [
        ("alert", "Alerte seuil"),
        ("etl", "Pipeline ETL"),
        ("announcement", "Annonce"),
        ("system", "Système"),
    ]

    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="system")
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    # Contextual payload: link, dashboard_key, alert_id, etc.
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} → {self.user.username}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])


class AlertRule(models.Model):
    """
    Threshold rule evaluated periodically by Celery.
    When the metric crosses the threshold, an Alert + Notification are created.
    Default rules (is_default=True) are seeded by migrations and serve as a baseline;
    users can subscribe or unsubscribe from any rule accessible to them.
    """
    METRIC_CHOICES = [
        ("ecart_tarif_pct", "Écart tarif moyen (%)"),
        ("taux_livraison_pct", "Taux de livraison (%)"),
        ("transport_cost_dzd", "Coût transport mensuel (DZD)"),
        ("nbr_sous_tarif", "Nombre de colis sous-tarif"),
        ("marge_brute_transport_pct", "Marge brute transport (%)"),
        ("nbr_livraisons_jour", "Volume livraisons / jour"),
    ]
    OPERATOR_CHOICES = [
        ("gt", "Supérieur à (>)"),
        ("gte", "Supérieur ou égal à (≥)"),
        ("lt", "Inférieur à (<)"),
        ("lte", "Inférieur ou égal à (≤)"),
    ]
    DASHBOARD_CHOICES = [
        ("overview", "Vue d'ensemble"),
        ("transport", "Transport"),
        ("parcels", "Colis & PCC"),
    ]
    SEVERITY_CHOICES = [
        ("info", "Information"),
        ("warning", "Avertissement"),
        ("critical", "Critique"),
    ]

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(
        default=False,
        help_text="System-seeded rule shown to all eligible users; individual users may unsubscribe",
    )
    metric = models.CharField(max_length=50, choices=METRIC_CHOICES)
    operator = models.CharField(max_length=5, choices=OPERATOR_CHOICES)
    threshold = models.FloatField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="warning")
    dashboard = models.CharField(max_length=20, choices=DASHBOARD_CHOICES)
    # Role names to notify; empty list = notify all roles with dashboard access
    notify_roles = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    # Cooldown: minimum minutes between two consecutive firings for same rule
    cooldown_minutes = models.PositiveIntegerField(default=60)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="created_alert_rules"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_alert_rule"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.get_metric_display()} {self.get_operator_display()} {self.threshold})"

    def is_in_cooldown(self) -> bool:
        if not self.last_triggered_at:
            return False
        elapsed = (timezone.now() - self.last_triggered_at).total_seconds() / 60
        return elapsed < self.cooldown_minutes

    def evaluate(self, current_value: float) -> bool:
        ops = {"gt": current_value > self.threshold, "gte": current_value >= self.threshold,
               "lt": current_value < self.threshold, "lte": current_value <= self.threshold}
        return ops.get(self.operator, False)


class Alert(models.Model):
    """
    A triggered instance of an AlertRule.
    Must be acknowledged by a user with access to the relevant dashboard.
    """
    rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name="alerts")
    triggered_value = models.FloatField()
    triggered_at = models.DateTimeField(auto_now_add=True)
    is_acknowledged = models.BooleanField(default=False, db_index=True)
    acknowledged_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="acknowledged_alerts",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, help_text="Optional note left when acknowledging")

    class Meta:
        db_table = "notifications_alert"
        ordering = ["-triggered_at"]

    def __str__(self):
        status = "✓" if self.is_acknowledged else "!"
        return f"[{status}] {self.rule.name} = {self.triggered_value} @ {self.triggered_at:%Y-%m-%d %H:%M}"

    def acknowledge(self, user, note: str = ""):
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.note = note
        self.save(update_fields=["is_acknowledged", "acknowledged_by", "acknowledged_at", "note"])


class UserAlertRulePreference(models.Model):
    """
    Per-user opt-in/out for a specific AlertRule.
    If no row exists, the user is implicitly subscribed (default=True).
    Only rows with is_subscribed=False represent an explicit unsubscription.
    """
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="alert_rule_preferences"
    )
    rule = models.ForeignKey(
        AlertRule, on_delete=models.CASCADE, related_name="user_preferences"
    )
    is_subscribed = models.BooleanField(
        default=True,
        help_text="False = user has explicitly unsubscribed from this rule",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_user_alert_rule_pref"
        unique_together = [("user", "rule")]

    def __str__(self):
        status = "✓" if self.is_subscribed else "✗"
        return f"[{status}] {self.user.username} → {self.rule.name}"
