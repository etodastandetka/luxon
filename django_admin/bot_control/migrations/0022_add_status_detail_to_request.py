from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0021_incoming_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='request',
            name='status_detail',
            field=models.CharField(max_length=50, blank=True, null=True),
        ),
    ]


