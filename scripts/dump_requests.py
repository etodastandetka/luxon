#!/usr/bin/env python3
"""
Quick inspector for universal_bot.db requests table.
Usage:
  python scripts/dump_requests.py [--db PATH] [--limit N] [--where SQL]
Examples:
  python scripts/dump_requests.py --limit 20
  python scripts/dump_requests.py --where "request_type='withdraw' AND status='pending'"
"""
import argparse
import os
import sqlite3
from pathlib import Path
from typing import Iterable


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def get_default_db_path() -> Path:
    return get_repo_root() / 'universal_bot.db'


def main(argv: Iterable[str] = None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--db', help='Path to DB file', default=os.getenv('UNIVERSAL_DB_PATH'))
    p.add_argument('--limit', type=int, default=50)
    p.add_argument('--where', type=str, default="")
    args = p.parse_args(argv)

    db_path = Path(args.db) if args.db else get_default_db_path()
    if not db_path.exists():
        print(f"DB not found: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) FROM requests")
        total = cur.fetchone()[0]
        print(f"requests total: {total}")
    except Exception as e:
        print(f"requests table not found or error: {e}")
        conn.close()
        return

    where = f" WHERE {args.where}" if args.where else ""
    sql = f"""
        SELECT id, user_id, bookmaker, request_type, status, amount, bank, created_at
        FROM requests
        {where}
        ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
        LIMIT ?
    """
    cur.execute(sql, (args.limit,))
    rows = cur.fetchall()
    for r in rows:
        print(dict(r))

    conn.close()


if __name__ == '__main__':
    main()
