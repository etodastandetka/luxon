# Generated manually to create BotReferral model

from django.db import migrations, models
import django.db.models.deletion


def create_botreferral_table_if_needed(apps, schema_editor):
    """Создаем таблицу referrals только если её нет"""
    with schema_editor.connection.cursor() as cursor:
        # Проверяем существование таблицы
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='referrals'
            """)
        else:
            # Для PostgreSQL
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'referrals'
            """)
        
        table_exists = cursor.fetchone() is not None
    
    # Если таблица уже существует, просто пропускаем создание
    if table_exists:
        return
    
    # Создаем таблицу через SQL
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                CREATE TABLE referrals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    referrer_id INTEGER NOT NULL,
                    referred_id INTEGER NOT NULL UNIQUE,
                    created_at TIMESTAMP NOT NULL,
                    FOREIGN KEY (referrer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    FOREIGN KEY (referred_id) REFERENCES users(user_id) ON DELETE CASCADE
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON referrals(referred_id)")
        else:
            # PostgreSQL
            cursor.execute("""
                CREATE TABLE referrals (
                    id SERIAL PRIMARY KEY,
                    referrer_id BIGINT NOT NULL,
                    referred_id BIGINT NOT NULL UNIQUE,
                    created_at TIMESTAMP NOT NULL,
                    FOREIGN KEY (referrer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    FOREIGN KEY (referred_id) REFERENCES users(user_id) ON DELETE CASCADE
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON referrals(referred_id)")


def reverse_create_table(apps, schema_editor):
    """Обратная миграция - не удаляем таблицу"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0026_merge_0023_0025'),
    ]

    operations = [
        # Используем SeparateDatabaseAndState чтобы создать модель только в состоянии Django
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Создаем модель только в состоянии Django (для ORM)
                migrations.CreateModel(
                    name='BotReferral',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                        ('referrer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='referrals_made', to='bot_control.botuser', db_column='referrer_id')),
                        ('referred', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='referral_from', to='bot_control.botuser', db_column='referred_id')),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'db_table': 'referrals',
                        'verbose_name': 'Реферальная связь',
                        'verbose_name_plural': 'Реферальные связи',
                    },
                ),
                migrations.AddIndex(
                    model_name='botreferral',
                    index=models.Index(fields=['referrer'], name='referrals_referrer_idx'),
                ),
                migrations.AddIndex(
                    model_name='botreferral',
                    index=models.Index(fields=['referred'], name='referrals_referred_idx'),
                ),
            ],
            database_operations=[
                # Создаем таблицу условно только через RunPython
                migrations.RunPython(
                    create_botreferral_table_if_needed,
                    reverse_create_table,
                ),
            ],
        ),
    ]

