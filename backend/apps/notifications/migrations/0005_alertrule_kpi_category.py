from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_seed_default_alert_rules'),
    ]

    operations = [
        migrations.AddField(
            model_name='alertrule',
            name='kpi_category',
            field=models.CharField(
                choices=[
                    ('operations', 'Opérations'),
                    ('cost_profitability', 'Coûts & Rentabilité'),
                    ('performance', 'Performance'),
                ],
                default='operations',
                help_text='KPI category grouping: operations, cost_profitability, or performance',
                max_length=20,
            ),
        ),
    ]
