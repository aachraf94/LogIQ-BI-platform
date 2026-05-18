from django.contrib.auth import authenticate
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Announcement, DashboardBookmark, LoginSession, Role, User, UserActivity, UserPreferences


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "name", "display_name", "description", "dashboards", "color", "user_count"]

    @extend_schema_field(serializers.IntegerField())
    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text="Email ou identifiant HRForce")
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, data):
        login_input = data["username"]
        password = data["password"]

        # Try direct username authentication first
        user = authenticate(username=login_input, password=password)

        if not user:
            # Fall back: look up by email (unique per HRForce import)
            try:
                found = User.objects.get(email=login_input)
                user = authenticate(username=found.username, password=password)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                pass

        if not user:
            raise serializers.ValidationError("Identifiants invalides.")
        if not user.is_active:
            raise serializers.ValidationError(
                "Compte inactif. Contactez l'administrateur pour activer votre accès."
            )
        data["user"] = user
        return data


class TokenPairSerializer(serializers.Serializer):
    """Response body for login — tokens + full user profile."""
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = serializers.SerializerMethodField(read_only=True)

    def get_user(self, obj):
        return UserDetailSerializer(obj["user"], context=self.context).data


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = [
            "theme", "language",
            "default_dashboard", "pinned_dashboards", "saved_filters",
            "notif_in_app", "notif_email",
            "notif_alert_triggered", "notif_etl_status", "notif_announcements",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class LoginSessionSerializer(serializers.ModelSerializer):
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = LoginSession
        fields = [
            "id", "ip_address", "browser", "os", "device_type",
            "logged_in_at", "logged_out_at", "is_active", "duration_minutes",
        ]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_duration_minutes(self, obj):
        end = obj.logged_out_at or (timezone.now() if obj.is_active else None)
        if not end:
            return None
        delta = end - obj.logged_in_at
        return int(delta.total_seconds() / 60)


class UserDetailSerializer(serializers.ModelSerializer):
    """Full profile — returned on login and GET /me/."""
    role = RoleSerializer(read_only=True)
    preferences = UserPreferencesSerializer(read_only=True)
    accessible_dashboards = serializers.ListField(
        child=serializers.CharField(), read_only=True
    )
    unread_notifications = serializers.SerializerMethodField()
    last_login_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "phone", "avatar_url", "department",
            "hrforce_id", "hrforce_code", "hrforce_role", "occupation",
            "agence_id", "agence_name", "agence_code", "company_id", "company_name",
            "role", "accessible_dashboards",
            "is_active", "is_staff", "is_superuser", "has_completed_onboarding",
            "last_login", "last_login_display",
            "preferences", "unread_notifications",
            "date_joined",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField())
    def get_unread_notifications(self, obj):
        return obj.notifications.filter(is_read=False).count()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_last_login_display(self, obj):
        if not obj.last_login:
            return None
        delta = timezone.now() - obj.last_login
        minutes = int(delta.total_seconds() / 60)
        if minutes < 1:
            return "À l'instant"
        if minutes < 60:
            return f"Il y a {minutes} min"
        hours = minutes // 60
        if hours < 24:
            return f"Il y a {hours}h"
        days = hours // 24
        if days == 1:
            return "Hier"
        if days < 7:
            return f"Il y a {days} jours"
        return obj.last_login.strftime("%d/%m/%Y")


class UserListSerializer(serializers.ModelSerializer):
    """Compact user representation for admin user-management list."""
    role = RoleSerializer(read_only=True)
    last_login_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "phone", "department",
            "hrforce_id", "hrforce_code", "hrforce_role", "occupation",
            "agence_id", "agence_name", "agence_code", "company_id", "company_name",
            "role", "is_active", "is_staff", "is_superuser",
            "last_login", "last_login_display", "date_joined",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_last_login_display(self, obj):
        if not obj.last_login:
            return None
        delta = timezone.now() - obj.last_login
        minutes = int(delta.total_seconds() / 60)
        if minutes < 60:
            return f"Il y a {minutes} min" if minutes >= 1 else "À l'instant"
        hours = minutes // 60
        if hours < 24:
            return f"Il y a {hours}h"
        days = hours // 24
        return "Hier" if days == 1 else (f"Il y a {days} jours" if days < 7 else obj.last_login.strftime("%d/%m/%Y"))


class UserActivateSerializer(serializers.Serializer):
    """Payload for bulk activate/deactivate (superadmin only)."""
    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    is_active = serializers.BooleanField()


class UserRoleAssignSerializer(serializers.Serializer):
    """Assign a role to one or more users (superadmin only)."""
    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    role_id = serializers.IntegerField(allow_null=True, help_text="null to remove role")


class AdminUserEditSerializer(serializers.ModelSerializer):
    """
    Fields an admin can update on any user.
    Passwords are managed by HRForce — not editable here.
    """
    class Meta:
        model = User
        fields = [
            "role", "is_active", "is_staff",
            "phone", "department", "avatar_url",
            "agence_id", "agence_name", "company_id", "company_name",
        ]


class RoleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["name", "display_name", "description", "dashboards", "color"]

    def validate_dashboards(self, value):
        valid = set(Role.DASHBOARD_KEYS)
        invalid = set(value) - valid
        if invalid:
            raise serializers.ValidationError(
                f"Clés invalides: {invalid}. Valeurs acceptées: {valid}"
            )
        return value

    def validate_name(self, value):
        # Prevent overwriting system roles via API
        qs = Role.objects.filter(name=value, is_system=True)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ce nom est réservé à un rôle système.")
        return value


class UserStatsSerializer(serializers.Serializer):
    """Aggregated user statistics for the admin dashboard."""
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    inactive = serializers.IntegerField()
    superadmins = serializers.IntegerField()
    without_role = serializers.IntegerField()
    by_role = serializers.ListField(child=serializers.DictField())
    new_this_month = serializers.IntegerField()
    never_logged_in = serializers.IntegerField()


class AnnouncementSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "id", "title", "body", "level", "level_display",
            "target_roles", "is_active", "pinned",
            "created_by_name", "created_at", "expires_at",
        ]
        read_only_fields = ["created_by_name", "created_at"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return None


class AnnouncementWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["title", "body", "level", "target_roles", "is_active", "pinned", "expires_at"]


class DashboardBookmarkSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField(read_only=True)
    is_mine = serializers.SerializerMethodField(read_only=True)
    dashboard_display = serializers.CharField(source="get_dashboard_display", read_only=True)

    class Meta:
        model = DashboardBookmark
        fields = [
            "id", "dashboard", "dashboard_display", "name", "description",
            "filters", "is_shared", "emoji",
            "owner_name", "is_mine",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "owner_name", "is_mine", "created_at", "updated_at", "dashboard_display"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_owner_name(self, obj):
        return obj.user.full_name or obj.user.username

    @extend_schema_field(serializers.BooleanField())
    def get_is_mine(self, obj):
        request = self.context.get("request")
        return request and obj.user_id == request.user.id

    def validate_dashboard(self, value):
        request = self.context.get("request")
        if request and not request.user.can_access_dashboard(value):
            raise serializers.ValidationError("Vous n'avez pas accès à ce tableau de bord.")
        return value


class UserActivitySerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = UserActivity
        fields = ["id", "dashboard", "action", "action_display", "metadata", "created_at"]
        read_only_fields = fields


class UserActivityWriteSerializer(serializers.Serializer):
    dashboard = serializers.CharField(max_length=20)
    action = serializers.ChoiceField(
        choices=["view", "filter", "export", "bookmark_save"], default="view"
    )
    metadata = serializers.DictField(required=False, default=dict)


class AdminActivitySummarySerializer(serializers.Serializer):
    """Per-dashboard visit counts for the admin activity report."""
    dashboard = serializers.CharField()
    visits_today = serializers.IntegerField()
    visits_this_week = serializers.IntegerField()
    unique_users_today = serializers.IntegerField()
