import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_seed_roles"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardBookmark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("dashboard", models.CharField(
                    choices=[("overview","Vue d'ensemble"),("transport","Transport"),
                             ("parcels","Colis & PCC"),("routes","Tournées")],
                    max_length=20,
                )),
                ("name", models.CharField(max_length=100)),
                ("description", models.CharField(blank=True, max_length=300)),
                ("filters", models.JSONField(default=dict)),
                ("is_shared", models.BooleanField(default=False)),
                ("emoji", models.CharField(default="📌", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="bookmarks", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "users_dashboard_bookmark",
                "ordering": ["-updated_at"],
                "unique_together": {("user", "dashboard", "name")},
            },
        ),
        migrations.CreateModel(
            name="UserActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("dashboard", models.CharField(blank=True, max_length=20)),
                ("action", models.CharField(
                    choices=[("view","Vue"),("filter","Filtre appliqué"),
                             ("export","Export"),("bookmark_save","Signet sauvegardé")],
                    default="view", max_length=20,
                )),
                ("metadata", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="activities", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "users_activity", "ordering": ["-created_at"]},
        ),
    ]
