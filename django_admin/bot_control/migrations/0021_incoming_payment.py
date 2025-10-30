from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0020_request'),
    ]

    operations = [
        migrations.CreateModel(
            name='IncomingPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10, db_index=True)),
                ('bank', models.CharField(blank=True, null=True, max_length=50, db_index=True)),
                ('payment_date', models.DateTimeField(db_index=True)),
                ('notification_text', models.TextField(blank=True, null=True)),
                ('is_processed', models.BooleanField(default=False, db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('request', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incoming_payments', to='bot_control.request')),
            ],
            options={
                'db_table': 'incoming_payments',
                'ordering': ['-payment_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='incomingpayment',
            index=models.Index(fields=['amount', 'is_processed'], name='incoming_amount_processed_idx'),
        ),
        migrations.AddIndex(
            model_name='incomingpayment',
            index=models.Index(fields=['payment_date'], name='incoming_payment_date_idx'),
        ),
        migrations.AddIndex(
            model_name='incomingpayment',
            index=models.Index(fields=['bank', 'is_processed'], name='incoming_bank_processed_idx'),
        ),
    ]


