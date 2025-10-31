# Generated manually to fix BotReferral.referred field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0026_merge_0023_0025'),
    ]

    operations = [
        migrations.AlterField(
            model_name='botreferral',
            name='referred',
            field=models.OneToOneField(
                db_column='referred_id',
                on_delete=models.CASCADE,
                related_name='referral_from',
                to='bot_control.botuser'
            ),
        ),
    ]

