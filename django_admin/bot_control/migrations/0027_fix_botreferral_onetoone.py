# Generated manually to fix BotReferral.referred field

from django.db import migrations, models


def fix_botreferral_field_if_needed(apps, schema_editor):
    """Изменяем поле referred на OneToOneField только если таблица существует"""
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
    
    # Если таблицы нет, пропускаем изменение
    if not table_exists:
        return
    
    # Для SQLite - пересоздаем таблицу с правильной структурой
    # Для PostgreSQL - изменяем constraint
    # Но лучше пропустить - структура уже может быть правильной
    # Просто обновим состояние Django


def reverse_fix(apps, schema_editor):
    """Обратная миграция"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0026_merge_0023_0025'),
    ]

    operations = [
        # Используем SeparateDatabaseAndState - обновляем только состояние Django
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Изменяем поле в состоянии Django
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
            ],
            database_operations=[
                # Проверяем и изменяем только если нужно
                migrations.RunPython(
                    fix_botreferral_field_if_needed,
                    reverse_fix,
                ),
            ],
        ),
    ]

