#!/usr/bin/env python3
"""
Merge multiple scattered universal_bot.db files into a single root DB.

Target (the only final DB):
  c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db

Sources to merge from (existing duplicates, if any):
  - c:\\Users\\etoda\\Desktop\\bets\\django_admin\\universal_bot.db
  - c:\\Users\\etoda\\Desktop\\bets\\bot\\universal_bot.db
  - c:\\Users\\etoda\\Desktop\\bets\\bot\\referral\\universal_bot.db

Strategy
- Ensure target schema is initialized using the bot Database initializer where possible
- For each known table, copy rows from source to target
- If schemas differ, only copy the intersection of columns
- Use INSERT OR IGNORE or UPSERT to avoid duplicates where there is a PRIMARY KEY/UNIQUE

Run:
  python scripts/merge_universal_db.py
"""
import os
import sqlite3
from pathlib import Path

ROOT = Path(r"c:\\Users\\etoda\\Desktop\\bets")
TARGET = ROOT / "universal_bot.db"
SOURCES = [
    ROOT / "django_admin" / "universal_bot.db",
    ROOT / "bot" / "universal_bot.db",
    ROOT / "bot" / "referral" / "universal_bot.db",
]

KNOWN_TABLES = [
    # Core
    "users",
    "user_data",
    "referrals",
    "referral_earnings",
    "transactions",
    # Unified requests model used by admin dashboards
    "requests",
    # Legacy
    "withdrawals",
    "monthly_payments",
    "top_payments",
    # Settings and service tables
    "bot_settings",
    # Requisites (QR, email/pass storage)
    "requisites",
]


def ensure_target_schema(conn: sqlite3.Connection) -> None:
    """Create minimal target schema if missing (subset compatible with your bot/database.py)."""
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON")
    # Users
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            language TEXT DEFAULT 'ru',
            selected_bookmaker TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # user_data
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            data_type TEXT,
            data_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            UNIQUE(user_id, data_type)
        )
        """
    )
    # referrals
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referred_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users (user_id) ON DELETE CASCADE,
            FOREIGN KEY (referred_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # referral_earnings
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS referral_earnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referred_id INTEGER,
            amount REAL,
            commission_amount REAL,
            bookmaker TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users (user_id) ON DELETE CASCADE,
            FOREIGN KEY (referred_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # transactions
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bookmaker TEXT,
            trans_type TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # requests (unified)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            first_name TEXT,
            bookmaker TEXT,
            account_id TEXT,
            amount REAL,
            request_type TEXT,
            status TEXT DEFAULT 'pending',
            auto_completed INTEGER DEFAULT 0,
            photo_file_id TEXT,
            photo_file_url TEXT,
            admin_chat_id INTEGER,
            admin_message_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # withdrawals (legacy)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bookmaker TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            bank_code TEXT,
            withdraw_code TEXT,
            photo_file_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # monthly_payments
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS monthly_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            position INTEGER,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # top_payments
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS top_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            position INTEGER,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        """
    )
    # bot_settings
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS bot_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # requisites
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS requisites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0,
            name TEXT,
            email TEXT,
            password TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # Unique active requisite
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_requisites_active ON requisites (is_active) WHERE is_active = 1"
    )
    # Unique for user_data
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_unique ON user_data(user_id, data_type)"
    )
    conn.commit()


def table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def copy_table(src: sqlite3.Connection, dst: sqlite3.Connection, table: str) -> int:
    """Copy rows from src.table to dst.table using column intersection.
    Returns number of inserted rows.
    """
    dst_cur = dst.cursor()
    src_cur = src.cursor()
    # Ensure target table exists
    ensure_target_schema(dst)
    # Check tables exist in src
    src_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    if not src_cur.fetchone():
        return 0

    src_cols = table_columns(src, table)
    dst_cols = table_columns(dst, table)
    cols = [c for c in src_cols if c in dst_cols]
    if not cols:
        return 0
    cols_csv = ",".join(cols)
    placeholders = ",".join([":" + c for c in cols])

    inserted = 0
    src_cur.execute(f"SELECT {cols_csv} FROM {table}")
    rows = src_cur.fetchall()
    for row in rows:
        params = {cols[i]: row[i] for i in range(len(cols))}
        try:
            dst_cur.execute(
                f"INSERT OR IGNORE INTO {table} ({cols_csv}) VALUES ({placeholders})",
                params,
            )
            inserted += dst_cur.rowcount if dst_cur.rowcount is not None else 0
        except Exception:
            # Fallback: try without IGNORE (may still fail if duplicates)
            try:
                dst_cur.execute(
                    f"INSERT INTO {table} ({cols_csv}) VALUES ({placeholders})",
                    params,
                )
                inserted += dst_cur.rowcount if dst_cur.rowcount is not None else 0
            except Exception:
                pass
    dst.commit()
    return inserted


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    # Create/open target
    tconn = sqlite3.connect(str(TARGET))
    ensure_target_schema(tconn)

    total_inserted = {}
    for src_path in SOURCES:
        if not src_path.exists():
            continue
        print(f"Merging from: {src_path}")
        sconn = sqlite3.connect(str(src_path))
        try:
            for tbl in KNOWN_TABLES:
                n = copy_table(sconn, tconn, tbl)
                total_inserted[tbl] = total_inserted.get(tbl, 0) + n
        finally:
            sconn.close()

    tconn.close()
    print("\nMerge complete. Rows inserted by table:")
    for k, v in total_inserted.items():
        print(f"  {k}: {v}")
    print("\nTarget DB:", TARGET)
    print("You can now remove the duplicate DB files from bot/ and django_admin/ if no longer needed.")


if __name__ == "__main__":
    main()
