import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("users", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("notification_type", models.CharField(
                    choices=[("alert","Alerte seuil"),("etl","Pipeline ETL"),
                             ("announcement","Annonce"),("system","Système")],
                    default="system", max_length=20,
                )),
                ("title", models.CharField(max_length=200)),
                ("message", models.TextField()),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("metadata", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="notifications", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "notifications_notification", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AlertRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True)),
                ("metric", models.CharField(
                    choices=[
                        ("ecart_tarif_pct","Écart tarif moyen (%)"),
                        ("taux_livraison_pct","Taux de livraison (%)"),
                        ("transport_cost_dzd","Coût transport mensuel (DZD)"),
                        ("nbr_sous_tarif","Nombre de colis sous-tarif"),
                        ("marge_brute_transport_pct","Marge brute transport (%)"),
                        ("nbr_livraisons_jour","Volume livraisons / jour"),
                    ],
                    max_length=50,
                )),
                ("operator", models.CharField(
                    choices=[("gt","Supérieur à (>)"),("gte","Supérieur ou égal à (≥)"),
                             ("lt","Inférieur à (<)"),("lte","Inférieur ou égal à (≤)")],
                    max_length=5,
                )),
                ("threshold", models.FloatField()),
                ("severity", models.CharField(
                    choices=[("info","Information"),("warning","Avertissement"),("critical","Critique")],
                    default="warning", max_length=10,
                )),
                ("dashboard", models.CharField(
                    choices=[("overview","Vue d'ensemble"),("transport","Transport"),("parcels","Colis & PCC")],
                    max_length=20,
                )),
                ("notify_roles", models.JSONField(default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("cooldown_minutes", models.PositiveIntegerField(default=60)),
                ("last_triggered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_alert_rules", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "notifications_alert_rule", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Alert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("triggered_value", models.FloatField()),
                ("triggered_at", models.DateTimeField(auto_now_add=True)),
                ("is_acknowledged", models.BooleanField(db_index=True, default=False)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("note", models.TextField(blank=True)),
                ("acknowledged_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="acknowledged_alerts", to=settings.AUTH_USER_MODEL,
                )),
                ("rule", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="alerts", to="notifications.alertrule",
                )),
            ],
            options={"db_table": "notifications_alert", "ordering": ["-triggered_at"]},
        ),
    ]
