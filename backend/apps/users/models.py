import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    Operational role controlling dashboard access.
    Seeded via data migration; managed by superadmin in admin panel.
    """
    DASHBOARD_KEYS = ["overview", "transport", "parcels", "routes"]

    name = models.CharField(max_length=60, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # List of dashboard keys this role can access, e.g. ["overview", "transport"]
    dashboards = models.JSONField(default=list)
    color = models.CharField(max_length=7, default="#6366f1", help_text="Hex color for UI badge")
    is_system = models.BooleanField(default=False, help_text="System roles cannot be deleted")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_role"
        ordering = ["name"]

    def __str__(self):
        return self.display_name

    def has_dashboard(self, key: str) -> bool:
        return key in self.dashboards


class User(AbstractUser):
    """
    Platform user imported from HRForce.
    Imported users start with is_active=False; superadmin activates them and assigns a role.
    Passwords are synced from HRForce (users cannot change them here).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hrforce_id = models.IntegerField(
        unique=True, null=True, blank=True, db_index=True,
        help_text="Corresponding user id in HRForce — used for sync identification",
    )
    hrforce_code = models.CharField(
        max_length=100, blank=True,
        help_text="Employee code from HRForce (e.g. '1042-Benali')",
    )
    hrforce_role = models.CharField(
        max_length=20, blank=True,
        help_text="HRForce role: Employé | Manager | Admin",
    )
    occupation = models.CharField(
        max_length=150, blank=True,
        help_text="Job title from HRForce occupation field",
    )
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )
    phone = models.CharField(max_length=20, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    department = models.CharField(max_length=150, blank=True)
    agence_id = models.IntegerField(null=True, blank=True)
    agence_name = models.CharField(max_length=200, blank=True)
    agence_code = models.CharField(max_length=50, blank=True)
    company_id = models.IntegerField(null=True, blank=True)
    company_name = models.CharField(max_length=200, blank=True)
    # Imported users are inactive by default until activated by a superadmin
    is_active = models.BooleanField(default=False)
    # Tracks first-ever login for onboarding flow
    has_completed_onboarding = models.BooleanField(default=False)

    REQUIRED_FIELDS = ["email", "first_name", "last_name"]

    class Meta:
        db_table = "users_user"

    def __str__(self):
        return self.full_name or self.username

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def accessible_dashboards(self) -> list:
        if self.is_superuser:
            return Role.DASHBOARD_KEYS
        if self.role:
            return list(self.role.dashboards)
        return []

    def can_access_dashboard(self, key: str) -> bool:
        return key in self.accessible_dashboards

    def get_preferences(self):
        try:
            return self.preferences
        except UserPreferences.DoesNotExist:
            return UserPreferences.objects.create(user=self)


class UserPreferences(models.Model):
    """Per-user UI and notification preferences — created on first access."""
    THEME_CHOICES = [("light", "Clair"), ("dark", "Sombre"), ("system", "Système")]
    LANGUAGE_CHOICES = [("fr", "Français"), ("ar", "العربية"), ("en", "English")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default="system")
    language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default="fr")
    # Dashboard navigation preferences
    default_dashboard = models.CharField(max_length=20, default="overview")
    pinned_dashboards = models.JSONField(default=list, help_text="Ordered list of pinned dashboard keys")
    saved_filters = models.JSONField(
        default=dict,
        help_text="Persisted filter state per dashboard, keyed by dashboard name",
    )
    # Notification channel preferences
    notif_in_app = models.BooleanField(default=True)
    notif_email = models.BooleanField(default=False)
    notif_alert_triggered = models.BooleanField(default=True, help_text="Notify when a threshold alert fires")
    notif_etl_status = models.BooleanField(default=False, help_text="Notify on ETL pipeline completion")
    notif_announcements = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_preferences"

    def __str__(self):
        return f"Preferences({self.user.username})"


class LoginSession(models.Model):
    """
    Audit trail of user logins.
    Enables 'last seen' display and suspicious-session detection in the admin.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_sessions")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    browser = models.CharField(max_length=80, blank=True)
    os = models.CharField(max_length=80, blank=True)
    device_type = models.CharField(max_length=20, blank=True, help_text="mobile / tablet / pc")
    # JWT jti claim stored so we can correlate session with a specific token
    jti = models.CharField(max_length=64, blank=True, db_index=True)
    logged_in_at = models.DateTimeField(auto_now_add=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "users_login_session"
        ordering = ["-logged_in_at"]

    def __str__(self):
        return f"{self.user.username} @ {self.logged_in_at:%Y-%m-%d %H:%M} — {self.browser}/{self.os}"

    def terminate(self):
        self.logged_out_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["logged_out_at", "is_active"])


class Announcement(models.Model):
    """
    Admin-broadcast messages displayed in the dashboard header.
    Can be targeted to specific roles or sent platform-wide.
    """
    LEVEL_CHOICES = [
        ("info", "Information"),
        ("success", "Succès"),
        ("warning", "Avertissement"),
        ("critical", "Critique"),
    ]

    title = models.CharField(max_length=200)
    body = models.TextField()
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="info")
    # Empty list means all roles; otherwise list of role.name values
    target_roles = models.JSONField(
        default=list,
        help_text="Role names that see this announcement; empty = broadcast to everyone",
    )
    is_active = models.BooleanField(default=True)
    pinned = models.BooleanField(
        default=False,
        help_text="Pinned announcements remain visible after the user dismisses them",
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="announcements_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Auto-deactivate after this datetime")

    class Meta:
        db_table = "users_announcement"
        ordering = ["-pinned", "-created_at"]

    def __str__(self):
        return f"[{self.get_level_display()}] {self.title}"

    def is_visible_to(self, user: "User") -> bool:
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        if not self.target_roles:
            return True
        user_role_name = user.role.name if user.role else None
        return user_role_name in self.target_roles


class DashboardBookmark(models.Model):
    """
    A named snapshot of a dashboard's filter/date state.
    Can be kept private or shared with all members of the creator's role.
    """
    DASHBOARD_CHOICES = [
        ("overview", "Vue d'ensemble"),
        ("transport", "Transport"),
        ("parcels", "Colis & PCC"),
        ("routes", "Tournées"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    dashboard = models.CharField(max_length=20, choices=DASHBOARD_CHOICES)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True)
    # Complete filter state: date_range, wilaya_ids, company_id, etc.
    filters = models.JSONField(default=dict)
    # If True, visible to all users with the same role who have dashboard access
    is_shared = models.BooleanField(default=False)
    emoji = models.CharField(max_length=10, default="📌", help_text="Emoji identifier for quick recognition")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_dashboard_bookmark"
        ordering = ["-updated_at"]
        unique_together = [("user", "dashboard", "name")]

    def __str__(self):
        shared = "🔗" if self.is_shared else "🔒"
        return f"{shared} {self.emoji} {self.name} ({self.dashboard})"


class UserActivity(models.Model):
    """
    Lightweight audit trail of dashboard visits and key interactions.
    Powers the admin activity feed and the 'most active users' widget.
    Not a full event log — one row per visit, not per click.
    """
    ACTION_CHOICES = [
        ("view", "Vue"),
        ("filter", "Filtre appliqué"),
        ("export", "Export"),
        ("bookmark_save", "Signet sauvegardé"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activities")
    dashboard = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default="view")
    # Extra context: applied filters, export format, etc.
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "users_activity"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.action} {self.dashboard}"
