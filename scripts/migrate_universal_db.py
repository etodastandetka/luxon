#!/usr/bin/env python3
"""
Idempotent migration script for the universal bot database (universal_bot.db).
- Creates required tables if they don't exist
- Adds missing columns safely
- Creates useful indexes

Usage:
  python scripts/migrate_universal_db.py [--db PATH]

If --db is not provided, defaults to <repo_root>/universal_bot.db
You may also set UNIVERSAL_DB_PATH env var to override the path.
"""
import argparse
import os
import sqlite3
from pathlib import Path
from typing import Iterable


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def get_default_db_path() -> Path:
    # Django uses BASE_DIR.parent / 'universal_bot.db' (repo root)
    return get_repo_root() / 'universal_bot.db'


def table_has_column(cur: sqlite3.Cursor, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cur.fetchall()]
    return column in cols


def create_table_requests(cur: sqlite3.Cursor) -> None:
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            bookmaker TEXT,
            account_id TEXT,
            amount REAL NOT NULL DEFAULT 0,
            request_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            withdrawal_code TEXT,
            photo_file_id TEXT,
            photo_file_url TEXT,
            bank TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            processed_at TIMESTAMP
        )
        '''
    )

    # Ensure columns exist (safe ALTERs)
    add_if_missing = [
        ('username', 'TEXT'),
        ('first_name', 'TEXT'),
        ('last_name', 'TEXT'),
        ('bookmaker', 'TEXT'),
        ('account_id', 'TEXT'),
        ('amount', "REAL NOT NULL DEFAULT 0"),
        ('request_type', "TEXT NOT NULL"),
        ('status', "TEXT NOT NULL DEFAULT 'pending'"),
        ('withdrawal_code', 'TEXT'),
        ('photo_file_id', 'TEXT'),
        ('photo_file_url', 'TEXT'),
        ('bank', 'TEXT'),
        ('created_at', 'TIMESTAMP'),
        ('updated_at', 'TIMESTAMP'),
        ('processed_at', 'TIMESTAMP'),
    ]
    for col, typ in add_if_missing:
        if not table_has_column(cur, 'requests', col):
            cur.execute(f"ALTER TABLE requests ADD COLUMN {col} {typ}")

    # Indexes
    cur.execute("CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_requests_type_status ON requests(request_type, status)")


def create_table_users(cur: sqlite3.Cursor) -> None:
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            language TEXT
        )
        '''
    )
    for col, typ in [('language', 'TEXT')]:
        if not table_has_column(cur, 'users', col):
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {typ}")


def create_unique_indexes(cur: sqlite3.Cursor) -> None:
    # Example: unique index for user_data to avoid duplicates (like seen in logs)
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            bookmaker TEXT
        )
        '''
    )
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_unique
        ON user_data(user_id, key, COALESCE(bookmaker,''))
        """
    )


def run_migration(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    create_table_requests(cur)
    create_table_users(cur)
    create_unique_indexes(cur)

    conn.commit()
    conn.close()


def main(argv: Iterable[str] = None) -> None:
    parser = argparse.ArgumentParser(description='Migrate universal_bot.db schema')
    parser.add_argument('--db', dest='db', help='Path to SQLite DB file')
    args = parser.parse_args(argv)

    env_path = os.getenv('UNIVERSAL_DB_PATH')
    db_path = Path(args.db) if args.db else (Path(env_path) if env_path else get_default_db_path())

    print(f"Migrating database: {db_path}")
    run_migration(db_path)
    print("Migration completed successfully")


if __name__ == '__main__':
    main()
