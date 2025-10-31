from django.db import migrations, models


def add_status_detail_if_needed(apps, schema_editor):
    """Добавляем поле status_detail только если его нет"""
    with schema_editor.connection.cursor() as cursor:
        # Сначала проверяем существование таблицы
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='bot_control_request'
            """)
        else:
            # Для PostgreSQL
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'bot_control_request'
            """)
        
        table_exists = cursor.fetchone() is not None
        
        # Если таблицы нет, пропускаем (она будет создана другой миграцией)
        if not table_exists:
            return
        
        # Проверяем существование колонки
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(bot_control_request)")
            columns = [row[1] for row in cursor.fetchall()]
            column_exists = 'status_detail' in columns
        else:
            # Для PostgreSQL
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'bot_control_request' 
                AND column_name = 'status_detail'
            """)
            column_exists = cursor.fetchone() is not None
    
    # Если колонка уже существует, пропускаем
    if column_exists:
        return
    
    # Добавляем колонку через SQL
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute("""
                ALTER TABLE bot_control_request 
                ADD COLUMN status_detail VARCHAR(50)
            """)
        else:
            # PostgreSQL
            cursor.execute("""
                ALTER TABLE bot_control_request 
                ADD COLUMN status_detail VARCHAR(50)
            """)


def reverse_migration(apps, schema_editor):
    """Обратная миграция"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0021_incoming_payment'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Добавляем поле только в состоянии Django
                migrations.AddField(
                    model_name='request',
                    name='status_detail',
                    field=models.CharField(max_length=50, blank=True, null=True),
                ),
            ],
            database_operations=[
                # Добавляем колонку условно только через RunPython
                migrations.RunPython(
                    add_status_detail_if_needed,
                    reverse_migration,
                ),
            ],
        ),
    ]


