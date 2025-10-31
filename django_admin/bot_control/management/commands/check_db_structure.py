"""
Команда для проверки структуры базы данных
Проверяет наличие всех необходимых колонок в таблицах BotSettings и QRHash
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Проверяет структуру базы данных и показывает недостающие колонки'

    def handle(self, *args, **options):
        self.stdout.write('Проверка структуры базы данных...\n')
        
        cursor = connection.cursor()
        
        # Проверяем BotSettings
        self.stdout.write('\n=== Проверка таблицы bot_control_botsettings ===')
        try:
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM pragma_table_info('bot_control_botsettings')")
            else:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'bot_control_botsettings'
                """)
            existing_columns = [row[0] for row in cursor.fetchall()]
            self.stdout.write(f'Существующие колонки: {", ".join(existing_columns)}')
            
            required_columns = ['key', 'value', 'description']
            missing_columns = [col for col in required_columns if col not in existing_columns]
            
            if missing_columns:
                self.stdout.write(
                    self.style.WARNING(
                        f'Недостающие колонки: {", ".join(missing_columns)}\n'
                        'Примените миграцию 0023_fix_missing_fields для исправления.'
                    )
                )
            else:
                self.stdout.write(self.style.SUCCESS('Все необходимые колонки присутствуют'))
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Ошибка при проверке bot_control_botsettings: {e}')
            )
        
        # Проверяем QRHash
        self.stdout.write('\n=== Проверка таблицы bot_control_qrhash ===')
        try:
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM pragma_table_info('bot_control_qrhash')")
            else:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'bot_control_qrhash'
                """)
            existing_columns = [row[0] for row in cursor.fetchall()]
            self.stdout.write(f'Существующие колонки: {", ".join(existing_columns)}')
            
            required_columns = ['is_used', 'is_main', 'account_name', 'gmail_email']
            missing_columns = [col for col in required_columns if col not in existing_columns]
            
            if missing_columns:
                self.stdout.write(
                    self.style.WARNING(
                        f'Недостающие колонки: {", ".join(missing_columns)}\n'
                        'Примените миграцию 0023_fix_missing_fields для исправления.'
                    )
                )
            else:
                self.stdout.write(self.style.SUCCESS('Все необходимые колонки присутствуют'))
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Ошибка при проверке bot_control_qrhash: {e}')
            )
        
        self.stdout.write('\n' + '='*50)
        self.stdout.write('Проверка завершена.')
        self.stdout.write('\nДля применения исправлений выполните:')
        self.stdout.write('  python manage.py migrate bot_control')

