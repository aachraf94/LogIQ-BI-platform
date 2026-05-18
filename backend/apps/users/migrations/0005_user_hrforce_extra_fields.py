from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_alter_announcement_expires_at_alter_announcement_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="hrforce_code",
            field=models.CharField(
                blank=True,
                max_length=100,
                help_text="Employee code from HRForce (e.g. '1042-Benali')",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="hrforce_role",
            field=models.CharField(
                blank=True,
                max_length=20,
                help_text="HRForce role: Employé | Manager | Admin",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="occupation",
            field=models.CharField(
                blank=True,
                max_length=150,
                help_text="Job title from HRForce occupation field",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="agence_code",
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
