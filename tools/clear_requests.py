#!/usr/bin/env python3
"""
Safely clear rows from the `requests` table in the local SQLite DB used by the bot/site.

This DOES NOT drop or recreate any tables. It only executes DELETE queries
with optional filters. A confirmation is required unless --force is specified.

Usage examples (PowerShell):
  # Dry run (show what would be deleted)
  python tools/clear_requests.py --dry-run

  # Delete ONLY deposits in any status (with confirmation)
  python tools/clear_requests.py --type deposit

  # Delete only pending requests (both deposit/withdraw)
  python tools/clear_requests.py --status pending

  # Delete everything (with confirmation)
  python tools/clear_requests.py --all

  # Force without prompt
  python tools/clear_requests.py --all --force

Optional: you can specify DB path explicitly with --db.
By default the script tries the same path that the bot uses.
"""
import argparse
import os
import sqlite3
import sys
from pathlib import Path
from typing import Optional

DEFAULT_DB_FALLBACK = str((Path(__file__).resolve().parents[1] / 'universal_bot.db'))


def _bot_db_path() -> str:
    # Try to import Database to read actual path
    try:
        sys.path.append(str(Path(__file__).resolve().parents[1] / 'bot'))
        from database import Database  # type: ignore
        db = Database()
        p = getattr(db, 'db_path', None) or ''
        if p:
            return p
    except Exception:
        pass
    # Fallbacks
    cand = Path(__file__).resolve().parents[1] / 'bot' / 'universal_bot.db'
    if cand.exists():
        return str(cand)
    return DEFAULT_DB_FALLBACK


def _confirm(prompt: str) -> bool:
    try:
        ans = input(f"{prompt} [y/N]: ").strip().lower()
        return ans in ('y', 'yes')
    except KeyboardInterrupt:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', type=str, default=None, help='Path to SQLite DB (defaults to bot DB)')
    ap.add_argument('--type', dest='rtype', choices=['deposit', 'withdraw'], help='Filter by request_type')
    ap.add_argument('--status', choices=['pending', 'completed', 'awaiting_manual', 'rejected'], help='Filter by status')
    ap.add_argument('--id-gte', dest='id_gte', type=int, default=None, help='Delete rows with id >= N')
    ap.add_argument('--id-lte', dest='id_lte', type=int, default=None, help='Delete rows with id <= N')
    ap.add_argument('--all', action='store_true', help='Delete ALL rows (dangerous)')
    ap.add_argument('--dry-run', action='store_true', help='Show what would be deleted, do not delete')
    ap.add_argument('--force', action='store_true', help='Do not ask for confirmation')
    args = ap.parse_args()

    db_path = args.db or _bot_db_path()
    if not os.path.exists(db_path):
        print(f"DB not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Ensure the table exists
    cur.execute("""
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
    """)

    # Build WHERE clause
    where = []
    params = []
    if not args.all:
        # Only delete matching filters; if no filters given, refuse to delete all implicitly
        if not (args.rtype or args.status or args.id_gte is not None or args.id_lte is not None):
            print("No filters provided. Use --all to delete everything or specify --type/--status/--id-gte/--id-lte.")
            conn.close()
            sys.exit(2)
    if args.rtype:
        where.append("request_type = ?")
        params.append(args.rtype)
    if args.status:
        where.append("status = ?")
        params.append(args.status)
    if args.id_gte is not None:
        where.append("id >= ?")
        params.append(args.id_gte)
    if args.id_lte is not None:
        where.append("id <= ?")
        params.append(args.id_lte)

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    # Count rows to be deleted
    cur.execute(f"SELECT COUNT(*) FROM requests{where_sql}", params)
    count = cur.fetchone()[0]
    print(f"DB: {db_path}")
    print(f"Would delete rows from requests: {count}")

    if count == 0:
        print("Nothing to delete.")
        conn.close()
        return

    if args.dry_run:
        # Show first few examples
        cur.execute(f"SELECT id, user_id, amount, request_type, status, created_at FROM requests{where_sql} ORDER BY id DESC LIMIT 10", params)
        for row in cur.fetchall():
            print(dict(row))
        print("Dry-run only, no changes made.")
        conn.close()
        return

    if not args.force:
        if not _confirm("Proceed with DELETE?"):
            print("Aborted.")
            conn.close()
            return

    # Delete rows
    cur.execute(f"DELETE FROM requests{where_sql}", params)
    conn.commit()
    print(f"Deleted rows: {cur.rowcount}")
    conn.close()


if __name__ == '__main__':
    main()
