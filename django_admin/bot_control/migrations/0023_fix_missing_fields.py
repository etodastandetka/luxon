# Generated manually to fix missing fields

from django.db import migrations, models


def add_missing_fields_forward(apps, schema_editor):
    """Добавляем недостающие поля, если они отсутствуют"""
    db = schema_editor.connection.alias
    
    # Проверяем и добавляем поля для BotSettings
    try:
        with schema_editor.connection.cursor() as cursor:
            # Для SQLite используем pragma_table_info
            if schema_editor.connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM pragma_table_info('bot_control_botsettings')")
                existing_columns = [row[0] for row in cursor.fetchall()]
                
                if 'key' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_botsettings ADD COLUMN key VARCHAR(100) DEFAULT ''")
                    # Создаем уникальный индекс после заполнения данными (если нужно)
                    
                if 'value' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_botsettings ADD COLUMN value TEXT DEFAULT ''")
                    
                if 'description' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_botsettings ADD COLUMN description TEXT DEFAULT NULL")
            else:
                # Для других БД используем информацию о схеме
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'bot_control_botsettings'
                """)
                existing_columns = [row[0] for row in cursor.fetchall()]
                
                if 'key' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'BotSettings'),
                        models.CharField(max_length=100, unique=True, default='', db_column='key')
                    )
                if 'value' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'BotSettings'),
                        models.TextField(default='', db_column='value')
                    )
                if 'description' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'BotSettings'),
                        models.TextField(blank=True, null=True, db_column='description')
                    )
    except Exception:
        # Если таблица не существует или ошибка - пропускаем
        pass
    
    # Проверяем и добавляем поля для QRHash
    try:
        with schema_editor.connection.cursor() as cursor:
            if schema_editor.connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM pragma_table_info('bot_control_qrhash')")
                existing_columns = [row[0] for row in cursor.fetchall()]
                
                if 'is_used' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_qrhash ADD COLUMN is_used BOOLEAN DEFAULT 0")
                    
                if 'is_main' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_qrhash ADD COLUMN is_main BOOLEAN DEFAULT 0")
                    
                if 'account_name' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_qrhash ADD COLUMN account_name VARCHAR(100) DEFAULT NULL")
                    
                if 'gmail_email' not in existing_columns:
                    cursor.execute("ALTER TABLE bot_control_qrhash ADD COLUMN gmail_email VARCHAR(254) DEFAULT NULL")
            else:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'bot_control_qrhash'
                """)
                existing_columns = [row[0] for row in cursor.fetchall()]
                
                if 'is_used' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'QRHash'),
                        models.BooleanField(default=False, db_column='is_used')
                    )
                if 'is_main' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'QRHash'),
                        models.BooleanField(default=False, db_column='is_main')
                    )
                if 'account_name' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'QRHash'),
                        models.CharField(max_length=100, blank=True, null=True, db_column='account_name')
                    )
                if 'gmail_email' not in existing_columns:
                    schema_editor.add_field(
                        apps.get_model('bot_control', 'QRHash'),
                        models.EmailField(blank=True, null=True, db_column='gmail_email')
                    )
    except Exception:
        # Если таблица не существует или ошибка - пропускаем
        pass


def add_missing_fields_reverse(apps, schema_editor):
    """Обратная миграция - удаляем добавленные поля"""
    # В обратную сторону мы не удаляем поля, т.к. это может сломать данные
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bot_control', '0022_add_status_detail_to_request'),
    ]

    operations = [
        migrations.RunPython(
            add_missing_fields_forward,
            add_missing_fields_reverse,
        ),
    ]

