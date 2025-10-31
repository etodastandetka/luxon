"""
Команда для миграции данных из SQLite (universal_bot.db) в PostgreSQL через Django модели
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from bot_control.models import (
    BotUser, BotUserData, BotReferral, BotReferralEarning, BotTransaction,
    BotSetting, BotRequisite, BotReferralTop, BotTopPayment, BotMonthlyPayment, Request
)
import sqlite3
from decimal import Decimal
from datetime import datetime
from dateutil import parser as date_parser


class Command(BaseCommand):
    help = 'Миграция данных из SQLite (universal_bot.db) в PostgreSQL'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Показать что будет мигрировано без выполнения',
        )
        parser.add_argument(
            '--sqlite-path',
            type=str,
            default=None,
            help='Путь к SQLite файлу (по умолчанию BOT_DATABASE_PATH)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        sqlite_path = options['sqlite_path'] or getattr(settings, 'BOT_DATABASE_PATH', None)
        
        if not sqlite_path:
            self.stdout.write(
                self.style.ERROR('BOT_DATABASE_PATH не настроен. Укажите --sqlite-path')
            )
            return
        
        import os
        if not os.path.exists(sqlite_path):
            self.stdout.write(
                self.style.ERROR(f'SQLite файл не найден: {sqlite_path}')
            )
            return
        
        self.stdout.write(f'Миграция из {sqlite_path} в PostgreSQL...')
        if dry_run:
            self.stdout.write(self.style.WARNING('РЕЖИМ ПРОВЕРКИ (dry-run) - изменения не будут сохранены'))
        
        try:
            conn = sqlite3.connect(sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Миграция users
            self.stdout.write('\n=== Миграция users ===')
            cursor.execute('SELECT COUNT(*) FROM users')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено пользователей: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM users')
                for row in cursor.fetchall():
                    user_id = row['user_id']
                    if not BotUser.objects.filter(user_id=user_id).exists():
                        BotUser.objects.create(
                            user_id=user_id,
                            username=row.get('username'),
                            first_name=row.get('first_name'),
                            last_name=row.get('last_name'),
                            language=row.get('language', 'ru'),
                            selected_bookmaker=row.get('selected_bookmaker'),
                            created_at=self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        )
                        migrated += 1
                self.stdout.write(self.style.SUCCESS(f'Мигрировано пользователей: {migrated}'))
            
            # Миграция user_data
            self.stdout.write('\n=== Миграция user_data ===')
            cursor.execute('SELECT COUNT(*) FROM user_data')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено записей: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM user_data')
                for row in cursor.fetchall():
                    try:
                        user = BotUser.objects.get(user_id=row['user_id'])
                        BotUserData.objects.get_or_create(
                            user=user,
                            data_type=row['data_type'],
                            defaults={
                                'data_value': row.get('data_value'),
                                'created_at': self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                            }
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь {row["user_id"]} не найден, пропускаем user_data'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано записей: {migrated}'))
            
            # Миграция referrals
            self.stdout.write('\n=== Миграция referrals ===')
            cursor.execute('SELECT COUNT(*) FROM referrals')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено связей: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM referrals')
                for row in cursor.fetchall():
                    try:
                        referrer = BotUser.objects.get(user_id=row['referrer_id'])
                        referred = BotUser.objects.get(user_id=row['referred_id'])
                        BotReferral.objects.get_or_create(
                            referrer=referrer,
                            referred=referred,
                            defaults={
                                'created_at': self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                            }
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь не найден для referral {row["id"]}'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано связей: {migrated}'))
            
            # Миграция referral_earnings
            self.stdout.write('\n=== Миграция referral_earnings ===')
            cursor.execute('SELECT COUNT(*) FROM referral_earnings')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено заработков: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM referral_earnings')
                for row in cursor.fetchall():
                    try:
                        referrer = BotUser.objects.get(user_id=row['referrer_id'])
                        referred = BotUser.objects.get(user_id=row['referred_id'])
                        BotReferralEarning.objects.create(
                            referrer=referrer,
                            referred=referred,
                            amount=Decimal(str(row.get('amount', 0))),
                            commission_amount=Decimal(str(row.get('commission_amount', 0))),
                            bookmaker=row.get('bookmaker'),
                            status=row.get('status', 'pending'),
                            created_at=self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь не найден для earning {row["id"]}'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано заработков: {migrated}'))
            
            # Миграция transactions
            self.stdout.write('\n=== Миграция transactions ===')
            cursor.execute('SELECT COUNT(*) FROM transactions')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено транзакций: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM transactions')
                for row in cursor.fetchall():
                    try:
                        user = BotUser.objects.get(user_id=row['user_id'])
                        BotTransaction.objects.create(
                            user=user,
                            bookmaker=row.get('bookmaker'),
                            trans_type=row.get('trans_type'),
                            amount=Decimal(str(row.get('amount', 0))),
                            status=row.get('status', 'pending'),
                            created_at=self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь {row["user_id"]} не найден для транзакции'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано транзакций: {migrated}'))
            
            # Миграция bot_settings
            self.stdout.write('\n=== Миграция bot_settings ===')
            cursor.execute('SELECT COUNT(*) FROM bot_settings')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено настроек: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM bot_settings')
                for row in cursor.fetchall():
                    BotSetting.objects.update_or_create(
                        key=row['key'],
                        defaults={
                            'value': row.get('value', ''),
                            'created_at': self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                            'updated_at': self._parse_datetime(row.get('updated_at')) if row.get('updated_at') else datetime.now(),
                        }
                    )
                    migrated += 1
                self.stdout.write(self.style.SUCCESS(f'Мигрировано настроек: {migrated}'))
            
            # Миграция requisites
            self.stdout.write('\n=== Миграция requisites ===')
            cursor.execute('SELECT COUNT(*) FROM requisites')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено реквизитов: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM requisites')
                for row in cursor.fetchall():
                    BotRequisite.objects.update_or_create(
                        id=row['id'],
                        defaults={
                            'value': row.get('value', ''),
                            'is_active': bool(row.get('is_active', 0)),
                            'name': row.get('name'),
                            'email': row.get('email'),
                            'password': row.get('password'),
                            'created_at': self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        }
                    )
                    migrated += 1
                self.stdout.write(self.style.SUCCESS(f'Мигрировано реквизитов: {migrated}'))
            
            # Миграция referral_top
            self.stdout.write('\n=== Миграция referral_top ===')
            cursor.execute('SELECT COUNT(*) FROM referral_top')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено записей: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM referral_top')
                for row in cursor.fetchall():
                    try:
                        user = BotUser.objects.get(user_id=row['user_id'])
                        BotReferralTop.objects.update_or_create(
                            user=user,
                            defaults={
                                'total_earnings': Decimal(str(row.get('total_earnings', 0))),
                                'total_referrals': row.get('total_referrals', 0),
                                'last_updated': self._parse_datetime(row.get('last_updated')) if row.get('last_updated') else datetime.now(),
                            }
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь {row["user_id"]} не найден для referral_top'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано записей: {migrated}'))
            
            # Миграция top_payments
            self.stdout.write('\n=== Миграция top_payments ===')
            cursor.execute('SELECT COUNT(*) FROM top_payments')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено выплат: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM top_payments')
                for row in cursor.fetchall():
                    try:
                        user = BotUser.objects.get(user_id=row['user_id'])
                        BotTopPayment.objects.create(
                            user=user,
                            position=row.get('position', 0),
                            amount=Decimal(str(row.get('amount', 0))),
                            status=row.get('status', 'pending'),
                            created_at=self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь {row["user_id"]} не найден для top_payment'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано выплат: {migrated}'))
            
            # Миграция monthly_payments
            self.stdout.write('\n=== Миграция monthly_payments ===')
            cursor.execute('SELECT COUNT(*) FROM monthly_payments')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено выплат: {count}')
            
            if not dry_run:
                migrated = 0
                cursor.execute('SELECT * FROM monthly_payments')
                for row in cursor.fetchall():
                    try:
                        user = BotUser.objects.get(user_id=row['user_id'])
                        BotMonthlyPayment.objects.create(
                            user=user,
                            position=row.get('position', 0),
                            amount=Decimal(str(row.get('amount', 0))),
                            status=row.get('status', 'pending'),
                            created_at=self._parse_datetime(row.get('created_at')) if row.get('created_at') else datetime.now(),
                        )
                        migrated += 1
                    except BotUser.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Пользователь {row["user_id"]} не найден для monthly_payment'))
                self.stdout.write(self.style.SUCCESS(f'Мигрировано выплат: {migrated}'))
            
            # Миграция requests (если они не были уже мигрированы в Request модель)
            self.stdout.write('\n=== Миграция requests (проверка) ===')
            cursor.execute('SELECT COUNT(*) FROM requests')
            count = cursor.fetchone()[0]
            self.stdout.write(f'Найдено заявок: {count}')
            
            if not dry_run:
                # Проверяем, сколько уже есть в Request
                existing_count = Request.objects.count()
                self.stdout.write(f'Уже в Request модели: {existing_count}')
                
                if existing_count < count:
                    self.stdout.write(self.style.WARNING(
                        f'В SQLite больше заявок ({count}) чем в Request ({existing_count}). '
                        'Возможно нужно мигрировать вручную.'
                    ))
            
            conn.close()
            
            self.stdout.write('\n' + '='*50)
            if dry_run:
                self.stdout.write(self.style.SUCCESS('Проверка завершена. Для миграции запустите без --dry-run'))
            else:
                self.stdout.write(self.style.SUCCESS('Миграция завершена!'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Ошибка миграции: {e}'))
            import traceback
            self.stdout.write(traceback.format_exc())
    
    def _parse_datetime(self, dt_str):
        """Парсинг datetime из различных форматов SQLite"""
        if not dt_str:
            return datetime.now()
        try:
            # Пробуем стандартный формат ISO
            return datetime.fromisoformat(str(dt_str).replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            try:
                # Используем dateutil для универсального парсинга
                return date_parser.parse(str(dt_str))
            except Exception:
                # Если ничего не получилось, возвращаем текущее время
                return datetime.now()

