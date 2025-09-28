import sqlite3
from typing import Dict
from django.core.management.base import BaseCommand
from django.conf import settings

TEST_USERNAMES = (
    'maria_user', 'alexey_user', 'dmitry_user', 'anna_user', 'test', 'testuser', 'test_user'
)

SQL_CREATE_TMP = """
DROP TABLE IF EXISTS __tmp_test_users;
CREATE TEMP TABLE __tmp_test_users (user_id INTEGER PRIMARY KEY);
"""

SQL_FILL_TMP = """
INSERT OR IGNORE INTO __tmp_test_users(user_id)
SELECT user_id FROM users
WHERE username LIKE 'test%'
   OR username LIKE 'user_%'
   OR username LIKE '%_user'
   OR username IN ({placeholders})
"""

PREVIEW_QUERIES = {
    'deposit_requests': "SELECT COUNT(*) FROM deposit_requests WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'withdrawals':      "SELECT COUNT(*) FROM withdrawals      WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'transactions':     "SELECT COUNT(*) FROM transactions     WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'users':            "SELECT COUNT(*) FROM users            WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
}

# Дополнительные превью по username внутри самих заявок (если в users нет записей)
PREVIEW_USERNAME_QUERIES = {
    'deposit_requests_usernames': "SELECT COUNT(*) FROM deposit_requests WHERE username LIKE 'test%' OR username LIKE 'user_%' OR username LIKE '%_user'",
}

DELETE_QUERIES = {
    'deposit_requests': "DELETE FROM deposit_requests WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'withdrawals':      "DELETE FROM withdrawals      WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'transactions':     "DELETE FROM transactions     WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
    'users':            "DELETE FROM users            WHERE user_id IN (SELECT user_id FROM __tmp_test_users)",
}

# Прямое удаление по username в заявках (когда users не содержит таких user_id)
DELETE_USERNAME_QUERIES = {
    'deposit_requests_usernames': "DELETE FROM deposit_requests WHERE username LIKE 'test%' OR username LIKE 'user_%' OR username LIKE '%_user'",
}


def prepare_tmp(cur: sqlite3.Cursor) -> None:
    cur.executescript(SQL_CREATE_TMP)
    placeholders = ','.join(['?'] * len(TEST_USERNAMES))
    cur.execute(SQL_FILL_TMP.format(placeholders=placeholders), TEST_USERNAMES)


def preview(cur: sqlite3.Cursor) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for name, sql in PREVIEW_QUERIES.items():
        try:
            cur.execute(sql)
            out[name] = cur.fetchone()[0]
        except sqlite3.Error:
            out[name] = 0
    # username-based counts
    for name, sql in PREVIEW_USERNAME_QUERIES.items():
        try:
            cur.execute(sql)
            out[name] = cur.fetchone()[0]
        except sqlite3.Error:
            out[name] = 0
    return out


def delete(cur: sqlite3.Cursor) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for name, sql in DELETE_QUERIES.items():
        try:
            cur.execute(sql)
            out[name] = cur.rowcount
        except sqlite3.Error:
            out[name] = 0
    # Удаляем по username в самих заявках
    for name, sql in DELETE_USERNAME_QUERIES.items():
        try:
            cur.execute(sql)
            out[name] = cur.rowcount
        except sqlite3.Error:
            out[name] = 0
    return out


class Command(BaseCommand):
    help = "Cleanup test/demo data from bot DB (deposit_requests/withdrawals/transactions/users)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true', dest='dry_run',
            help='Preview counts only, do not delete.'
        )
        parser.add_argument(
            '--nuke-requests', action='store_true', dest='nuke_requests',
            help='Delete ALL rows from deposit_requests, withdrawals, transactions (use with caution).'
        )

    def handle(self, *args, **options):
        db_path = str(settings.BOT_DATABASE_PATH)
        self.stdout.write(self.style.NOTICE(f"Using DB: {db_path}"))
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        try:
            if options.get('nuke_requests', False):
                # Полная очистка заявок
                preview_counts = {}
                for name in ('deposit_requests','withdrawals','transactions'):
                    try:
                        cur.execute(f'SELECT COUNT(*) FROM {name}')
                        preview_counts[name] = cur.fetchone()[0]
                    except sqlite3.Error:
                        preview_counts[name] = 0
                self.stdout.write(self.style.WARNING(f"Preview (nuke): {preview_counts}"))
                if options.get('dry_run', False):
                    self.stdout.write(self.style.SUCCESS("Dry-run complete (nuke). Nothing deleted."))
                    return
                nuked = {}
                for name in ('deposit_requests','withdrawals','transactions'):
                    try:
                        cur.execute(f'DELETE FROM {name}')
                        nuked[name] = cur.rowcount
                    except sqlite3.Error:
                        nuked[name] = 0
                conn.commit()
                self.stdout.write(self.style.SUCCESS(f"Nuked: {nuked}"))
            else:
                # Точечная очистка по username/user_id
                prepare_tmp(cur)
                counts = preview(cur)
                self.stdout.write(self.style.WARNING(f"Preview: {counts}"))
                if options.get('dry_run', False):
                    self.stdout.write(self.style.SUCCESS("Dry-run complete. Nothing deleted."))
                    return
                deleted = delete(cur)
                conn.commit()
                self.stdout.write(self.style.SUCCESS(f"Deleted: {deleted}"))
        finally:
            conn.close()
