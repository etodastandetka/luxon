from django.db import migrations, models
import django.db.models.deletion


def create_table_and_indexes_if_needed(apps, schema_editor):
    """Создаем таблицу и индексы только если таблицы нет"""
    with schema_editor.connection.cursor() as cursor:
        # Проверяем существование таблицы
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='incoming_payments'
            """)
        else:
            # Для PostgreSQL
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'incoming_payments'
            """)
        
        table_exists = cursor.fetchone() is not None
    
    # Если таблица уже существует, просто пропускаем создание
    if table_exists:
        return
    
    # Создаем таблицу через SQL
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                CREATE TABLE incoming_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount NUMERIC(10, 2) NOT NULL,
                    bank VARCHAR(50),
                    payment_date TIMESTAMP NOT NULL,
                    notification_text TEXT,
                    is_processed BOOLEAN NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    request_id INTEGER REFERENCES bot_control_request(id) ON DELETE SET NULL
                )
            """)
        else:
            # PostgreSQL
            cursor.execute("""
                CREATE TABLE incoming_payments (
                    id BIGSERIAL PRIMARY KEY,
                    amount NUMERIC(10, 2) NOT NULL,
                    bank VARCHAR(50),
                    payment_date TIMESTAMP NOT NULL,
                    notification_text TEXT,
                    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    request_id INTEGER REFERENCES bot_control_request(id) ON DELETE SET NULL
                )
            """)
    
    # Создаем индексы
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_amount_processed_idx 
                ON incoming_payments(amount, is_processed)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_payment_date_idx 
                ON incoming_payments(payment_date)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_bank_processed_idx 
                ON incoming_payments(bank, is_processed)
            """)
        else:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_amount_processed_idx 
                ON incoming_payments(amount, is_processed)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_payment_date_idx 
                ON incoming_payments(payment_date)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS incoming_bank_processed_idx 
                ON incoming_payments(bank, is_processed)
            """)


def reverse_migration(apps, schema_editor):
    """Обратная миграция - не удаляем таблицу, т.к. могут быть данные"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0020_request'),
    ]

    operations = [
        # Используем SeparateDatabaseAndState чтобы создать модель только в состоянии Django,
        # а таблицу создаем условно через RunPython
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Создаем модель только в состоянии Django (для ORM)
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
            ],
            database_operations=[
                # Создаем таблицу условно только через RunPython
                migrations.RunPython(
                    create_table_and_indexes_if_needed,
                    reverse_migration,
                ),
            ],
        ),
    ]


