import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_alter_alert_id_alter_alert_note_alter_alertrule_id_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='alertrule',
            name='is_default',
            field=models.BooleanField(
                default=False,
                help_text='System-seeded rule shown to all eligible users; individual users may unsubscribe',
            ),
        ),
        migrations.CreateModel(
            name='UserAlertRulePreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_subscribed', models.BooleanField(
                    default=True,
                    help_text='False = user has explicitly unsubscribed from this rule',
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('rule', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_preferences',
                    to='notifications.alertrule',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='alert_rule_preferences',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'notifications_user_alert_rule_pref',
                'unique_together': {('user', 'rule')},
            },
        ),
    ]
