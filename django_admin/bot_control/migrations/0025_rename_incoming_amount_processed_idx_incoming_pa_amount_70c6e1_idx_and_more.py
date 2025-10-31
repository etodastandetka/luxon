# Generated manually to safely rename indexes

from django.db import migrations


def rename_indexes_if_needed(apps, schema_editor):
    """Переименовываем индексы только если они существуют"""
    with schema_editor.connection.cursor() as cursor:
        # Проверяем и переименовываем индексы если они существуют
        if schema_editor.connection.vendor == 'sqlite':
            # Для SQLite проверяем существование индекса
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name='incoming_amount_processed_idx'
            """)
            if cursor.fetchone():
                # SQLite не поддерживает ALTER INDEX, поэтому пропускаем переименование
                # или используем другой подход
                pass
        else:
            # Для PostgreSQL проверяем и переименовываем
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'incoming_payments' 
                AND indexname = 'incoming_amount_processed_idx'
            """)
            if cursor.fetchone():
                try:
                    cursor.execute("""
                        ALTER INDEX incoming_amount_processed_idx 
                        RENAME TO incoming_pa_amount_70c6e1_idx
                    """)
                except Exception:
                    pass
            
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'incoming_payments' 
                AND indexname = 'incoming_payment_date_idx'
            """)
            if cursor.fetchone():
                try:
                    cursor.execute("""
                        ALTER INDEX incoming_payment_date_idx 
                        RENAME TO incoming_pa_payment_d_8f5b3a_idx
                    """)
                except Exception:
                    pass
            
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'incoming_payments' 
                AND indexname = 'incoming_bank_processed_idx'
            """)
            if cursor.fetchone():
                try:
                    cursor.execute("""
                        ALTER INDEX incoming_bank_processed_idx 
                        RENAME TO incoming_pa_bank_is_pr_9a8c7d_idx
                    """)
                except Exception:
                    pass


def reverse_rename_indexes(apps, schema_editor):
    """Обратное переименование индексов"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0022_add_status_detail_to_request'),
    ]

    operations = [
        # Используем SeparateDatabaseAndState - обновляем только состояние Django
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Пропускаем добавление индексов в состояние, т.к. они уже могут быть в БД
                # Django ORM будет работать с индексами из БД
            ],
            database_operations=[
                # Переименовываем индексы условно только через RunPython
                migrations.RunPython(
                    rename_indexes_if_needed,
                    reverse_rename_indexes,
                ),
            ],
        ),
        # Добавляем индексы в состояние Django отдельно (без переименования)
        migrations.AddIndex(
            model_name='incomingpayment',
            index=migrations.Index(fields=['amount', 'is_processed'], name='incoming_pa_amount_70c6e1_idx'),
        ),
        migrations.AddIndex(
            model_name='incomingpayment',
            index=migrations.Index(fields=['payment_date'], name='incoming_pa_payment_d_8f5b3a_idx'),
        ),
        migrations.AddIndex(
            model_name='incomingpayment',
            index=migrations.Index(fields=['bank', 'is_processed'], name='incoming_pa_bank_is_pr_9a8c7d_idx'),
        ),
    ]

