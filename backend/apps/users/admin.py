from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Announcement, LoginSession, Role, User, UserPreferences


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["display_name", "name", "dashboards_badge", "active_users", "color_swatch", "is_system"]
    list_filter = ["is_system"]
    search_fields = ["name", "display_name"]
    readonly_fields = ["created_at", "updated_at", "active_users"]
    fieldsets = [
        (None, {"fields": ["name", "display_name", "description", "color"]}),
        ("Accès tableaux de bord", {
            "fields": ["dashboards"],
            "description": (
                "Liste des clés de tableau de bord accessibles. "
                "Valeurs valides : <code>overview</code>, <code>transport</code>, "
                "<code>parcels</code>, <code>routes</code>."
            ),
        }),
        ("Métadonnées", {"fields": ["is_system", "created_at", "updated_at", "active_users"], "classes": ["collapse"]}),
    ]

    def dashboards_badge(self, obj):
        labels = {
            "overview": ("#6366f1", "Vue d'ensemble"),
            "transport": ("#0ea5e9", "Transport"),
            "parcels": ("#10b981", "Colis"),
            "routes": ("#f59e0b", "Tournées"),
        }
        badges = []
        for key in obj.dashboards:
            color, label = labels.get(key, ("#9ca3af", key))
            badges.append(
                f'<span style="background:{color};color:#fff;padding:2px 8px;'
                f'border-radius:9999px;font-size:11px;margin-right:3px">{label}</span>'
            )
        return mark_safe("".join(badges) if badges else "—")
    dashboards_badge.short_description = "Tableaux de bord"

    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:18px;height:18px;'
            'border-radius:50%;background:{};border:1px solid #ccc"></span>',
            obj.color,
        )
    color_swatch.short_description = "Couleur"

    def active_users(self, obj):
        return obj.users.filter(is_active=True).count()
    active_users.short_description = "Utilisateurs actifs"

    def has_delete_permission(self, request, obj=None):
        if obj and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserPreferencesInline(admin.StackedInline):
    model = UserPreferences
    extra = 0
    can_delete = False
    verbose_name = "Préférences"
    verbose_name_plural = "Préférences"
    fields = ["theme", "language", "default_dashboard", "notif_in_app", "notif_email"]


class LoginSessionInline(admin.TabularInline):
    model = LoginSession
    extra = 0
    can_delete = False
    max_num = 5
    readonly_fields = ["ip_address", "browser", "os", "device_type", "logged_in_at", "logged_out_at", "is_active"]
    fields = readonly_fields
    verbose_name = "Session récente"
    verbose_name_plural = "5 dernières sessions"
    ordering = ["-logged_in_at"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "username", "full_name_display", "email", "role_badge",
        "agence_name", "status_badge", "last_login", "hrforce_id",
    ]
    list_filter = ["is_active", "is_superuser", "role", "company_id"]
    search_fields = ["username", "first_name", "last_name", "email", "hrforce_id"]
    ordering = ["-date_joined"]
    inlines = [UserPreferencesInline, LoginSessionInline]
    actions = ["activate_users", "deactivate_users"]
    readonly_fields = ["id", "hrforce_id", "date_joined", "last_login"]

    fieldsets = [
        ("Identité", {"fields": ["id", "username", "first_name", "last_name", "email", "phone", "avatar_url"]}),
        ("Organisation", {"fields": ["agence_id", "agence_name", "company_id", "company_name", "department"]}),
        ("Rôle & Accès", {"fields": ["role", "is_active", "is_superuser", "is_staff"]}),
        ("HRForce", {"fields": ["hrforce_id"], "description": "Identifiant de synchronisation avec HRForce"}),
        ("Dates", {"fields": ["date_joined", "last_login"], "classes": ["collapse"]}),
    ]

    add_fieldsets = [
        (None, {
            "classes": ["wide"],
            "fields": ["username", "first_name", "last_name", "email", "password1", "password2",
                       "role", "is_active", "hrforce_id"],
        }),
    ]

    def full_name_display(self, obj):
        return obj.full_name or "—"
    full_name_display.short_description = "Nom complet"

    def role_badge(self, obj):
        if not obj.role:
            return mark_safe('<span style="color:#9ca3af">—</span>')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 10px;'
            'border-radius:9999px;font-size:11px">{}</span>',
            obj.role.color, obj.role.display_name,
        )
    role_badge.short_description = "Rôle"

    def status_badge(self, obj):
        if obj.is_superuser:
            return mark_safe(
                '<span style="background:#7c3aed;color:#fff;padding:2px 8px;'
                'border-radius:9999px;font-size:11px">Super Admin</span>'
            )
        if obj.is_active:
            return mark_safe(
                '<span style="background:#10b981;color:#fff;padding:2px 8px;'
                'border-radius:9999px;font-size:11px">Actif</span>'
            )
        return mark_safe(
            '<span style="background:#ef4444;color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px">Inactif</span>'
        )
    status_badge.short_description = "Statut"

    @admin.action(description="Activer les utilisateurs sélectionnés")
    def activate_users(self, request, queryset):
        updated = queryset.filter(is_superuser=False).update(is_active=True)
        self.message_user(request, f"{updated} utilisateur(s) activé(s).", messages.SUCCESS)

    @admin.action(description="Désactiver les utilisateurs sélectionnés")
    def deactivate_users(self, request, queryset):
        updated = queryset.filter(is_superuser=False).update(is_active=False)
        self.message_user(request, f"{updated} utilisateur(s) désactivé(s).", messages.WARNING)


# ---------------------------------------------------------------------------
# Login Session
# ---------------------------------------------------------------------------

@admin.register(LoginSession)
class LoginSessionAdmin(admin.ModelAdmin):
    list_display = ["user", "browser", "os", "device_type", "ip_address", "logged_in_at", "is_active"]
    list_filter = ["is_active", "device_type", "browser"]
    search_fields = ["user__username", "user__first_name", "ip_address"]
    readonly_fields = ["user", "ip_address", "user_agent", "browser", "os", "device_type",
                       "jti", "logged_in_at", "logged_out_at", "is_active"]
    ordering = ["-logged_in_at"]
    date_hierarchy = "logged_in_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Announcement
# ---------------------------------------------------------------------------

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ["title", "level_badge", "target_display", "is_active", "pinned", "created_by", "created_at", "expires_at"]
    list_filter = ["level", "is_active", "pinned"]
    search_fields = ["title", "body"]
    readonly_fields = ["created_at", "created_by"]
    ordering = ["-pinned", "-created_at"]
    fieldsets = [
        (None, {"fields": ["title", "body", "level"]}),
        ("Visibilité", {"fields": ["is_active", "pinned", "target_roles", "expires_at"]}),
        ("Métadonnées", {"fields": ["created_by", "created_at"], "classes": ["collapse"]}),
    ]

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def level_badge(self, obj):
        colors = {"info": "#6366f1", "success": "#10b981", "warning": "#f59e0b", "critical": "#ef4444"}
        color = colors.get(obj.level, "#9ca3af")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px">{}</span>',
            color, obj.get_level_display(),
        )
    level_badge.short_description = "Niveau"

    def target_display(self, obj):
        if not obj.target_roles:
            return mark_safe('<em style="color:#9ca3af">Tous</em>')
        return ", ".join(obj.target_roles)
    target_display.short_description = "Destinataires"
