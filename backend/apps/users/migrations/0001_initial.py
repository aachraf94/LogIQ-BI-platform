import django.contrib.auth.models
import django.contrib.auth.validators
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Role",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=60, unique=True)),
                ("display_name", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("dashboards", models.JSONField(default=list)),
                ("color", models.CharField(default="#6366f1", help_text="Hex color for UI badge", max_length=7)),
                ("is_system", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "users_role", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False)),
                ("username", models.CharField(
                    error_messages={"unique": "A user with that username already exists."},
                    help_text="Required. 150 characters or fewer.",
                    max_length=150, unique=True,
                    validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                    verbose_name="username",
                )),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="email address")),
                ("is_staff", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=False)),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("hrforce_id", models.IntegerField(db_index=True, null=True, blank=True, unique=True)),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("avatar_url", models.URLField(blank=True, max_length=500)),
                ("department", models.CharField(blank=True, max_length=150)),
                ("agence_id", models.IntegerField(blank=True, null=True)),
                ("agence_name", models.CharField(blank=True, max_length=200)),
                ("company_id", models.IntegerField(blank=True, null=True)),
                ("company_name", models.CharField(blank=True, max_length=200)),
                ("has_completed_onboarding", models.BooleanField(default=False)),
                ("groups", models.ManyToManyField(
                    blank=True, related_name="user_set", related_query_name="user",
                    to="auth.group", verbose_name="groups",
                )),
                ("user_permissions", models.ManyToManyField(
                    blank=True, related_name="user_set", related_query_name="user",
                    to="auth.permission", verbose_name="user permissions",
                )),
                ("role", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="users", to="users.role",
                )),
            ],
            options={"db_table": "users_user"},
            managers=[
                ("objects", django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name="UserPreferences",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("theme", models.CharField(choices=[("light","Clair"),("dark","Sombre"),("system","Système")], default="system", max_length=10)),
                ("language", models.CharField(choices=[("fr","Français"),("ar","العربية"),("en","English")], default="fr", max_length=5)),
                ("default_dashboard", models.CharField(default="overview", max_length=20)),
                ("pinned_dashboards", models.JSONField(default=list)),
                ("saved_filters", models.JSONField(default=dict)),
                ("notif_in_app", models.BooleanField(default=True)),
                ("notif_email", models.BooleanField(default=False)),
                ("notif_alert_triggered", models.BooleanField(default=True)),
                ("notif_etl_status", models.BooleanField(default=False)),
                ("notif_announcements", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="preferences", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "users_preferences"},
        ),
        migrations.CreateModel(
            name="LoginSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("browser", models.CharField(blank=True, max_length=80)),
                ("os", models.CharField(blank=True, max_length=80)),
                ("device_type", models.CharField(blank=True, max_length=20)),
                ("jti", models.CharField(blank=True, db_index=True, max_length=64)),
                ("logged_in_at", models.DateTimeField(auto_now_add=True)),
                ("logged_out_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="login_sessions", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "users_login_session", "ordering": ["-logged_in_at"]},
        ),
        migrations.CreateModel(
            name="Announcement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("body", models.TextField()),
                ("level", models.CharField(
                    choices=[("info","Information"),("success","Succès"),("warning","Avertissement"),("critical","Critique")],
                    default="info", max_length=10,
                )),
                ("target_roles", models.JSONField(default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("pinned", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_by", models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="announcements_created", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "users_announcement", "ordering": ["-pinned", "-created_at"]},
        ),
    ]
