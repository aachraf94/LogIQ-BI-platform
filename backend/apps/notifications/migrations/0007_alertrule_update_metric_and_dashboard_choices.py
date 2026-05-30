from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_reseed_default_alert_rules'),
    ]

    operations = [
        migrations.AlterField(
            model_name='alertrule',
            name='metric',
            field=models.CharField(
                max_length=50,
                choices=[
                    # Parcel Delivery — Operations
                    ('pd_ops_total_parcels',       'Livraison Colis — Colis traités'),
                    ('pd_ops_delivered',           'Livraison Colis — Colis livrés'),
                    ('pd_ops_returns',             'Livraison Colis — Retours'),
                    ('pd_ops_in_transit',          'Livraison Colis — En transit'),
                    ('pd_ops_avg_duration',        'Livraison Colis — Durée moy. livraison (h)'),
                    # Parcel Delivery — Cost & Profitability
                    ('pd_cost_fees_collected',     'Livraison Colis — Frais collectés (DZD)'),
                    ('pd_cost_total_cost',         'Livraison Colis — Coût opérationnel (DZD)'),
                    ('pd_cost_gross_margin',       'Livraison Colis — Marge brute (%)'),
                    ('pd_cost_avg_fee',            'Livraison Colis — Frais moy. / colis (DZD)'),
                    ('pd_cost_per_delivery',       'Livraison Colis — Coût / colis livré (DZD)'),
                    # Parcel Delivery — Performance
                    ('pd_perf_delivery_rate',      'Livraison Colis — Taux de livraison (%)'),
                    ('pd_perf_avg_attempts',       'Livraison Colis — Tentatives moy.'),
                    ('pd_perf_first_attempt_rate', 'Livraison Colis — Succès 1ère tentative (%)'),
                    ('pd_perf_avg_duration',       'Livraison Colis — Durée moy. livraison (h) [perf]'),
                    ('pd_perf_claims_count',       'Livraison Colis — Sinistres déclarés'),
                    # Transport — Operations
                    ('tr_ops_total_requests',      'Transport — Demandes totales'),
                    ('tr_ops_completion_rate',     'Transport — Taux de complétion (%)'),
                    ('tr_ops_cancellation_rate',   'Transport — Taux d\'annulation (%)'),
                    ('tr_ops_avg_distance',        'Transport — Distance moy. (km)'),
                    ('tr_ops_avg_stops',           'Transport — Arrêts moy. / demande'),
                    # Transport — Cost & Profitability
                    ('tr_cost_total_revenue',      'Transport — Revenu total (DZD)'),
                    ('tr_cost_total_cost',         'Transport — Coût total (DZD)'),
                    ('tr_cost_gross_margin',       'Transport — Marge brute (DZD)'),
                    ('tr_cost_margin_pct',         'Transport — Marge (%)'),
                    ('tr_cost_per_km',             'Transport — Coût / km (DZD)'),
                    # Transport — Performance
                    ('tr_perf_on_time_rate',       'Transport — Ponctualité (%)'),
                    ('tr_perf_avg_duration',       'Transport — Durée moy. (h)'),
                    ('tr_perf_avg_rating',         'Transport — Note client moy.'),
                    ('tr_perf_avg_delay',          'Transport — Retard arrivée moy. (min)'),
                    ('tr_perf_night_shift_rate',   'Transport — Taux de nuit (%)'),
                ],
            ),
        ),
        migrations.AlterField(
            model_name='alertrule',
            name='dashboard',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('transport', 'Transport à la demande'),
                    ('parcels',   'Livraison Colis'),
                ],
            ),
        ),
    ]
