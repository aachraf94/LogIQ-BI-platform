from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ETLRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("dagster_run_id", models.CharField(db_index=True, max_length=64, unique=True)),
                ("job_name", models.CharField(db_index=True, max_length=100)),
                ("status", models.CharField(
                    choices=[("running","En cours"),("success","Succès"),
                             ("failed","Échec"),("cancelled","Annulé")],
                    db_index=True, default="running", max_length=12,
                )),
                ("triggered_by", models.CharField(
                    choices=[("schedule","Planifié"),("manual","Manuel"),("sensor","Capteur")],
                    default="schedule", max_length=10,
                )),
                ("started_at", models.DateTimeField()),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("duration_seconds", models.IntegerField(blank=True, null=True)),
                ("assets_materialized", models.JSONField(default=dict)),
                ("total_rows_loaded", models.IntegerField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("tags", models.JSONField(default=dict)),
            ],
            options={"db_table": "integrations_etl_run", "ordering": ["-started_at"]},
        ),
    ]
