#!/usr/bin/env python3
"""
Drop legacy backup tables created by cleanup_legacy_tables.py.

This script ONLY drops tables whose names match:
  - deposit_requests_backup_*
  - withdrawals_backup_*
  - transactions_backup_*

It DOES NOT touch the active VIEWs with the same base names.
It DOES NOT drop the unified 'requests' table.

Run (dry run by default):
  python scripts/drop_legacy_backups.py

To actually drop tables, pass --yes:
  python scripts/drop_legacy_backups.py --yes
"""
import re
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(r"c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db")

PATTERNS = [
    re.compile(r"^deposit_requests_backup_\d{8}_\d{6}$"),
    re.compile(r"^withdrawals_backup_\d{8}_\d{6}$"),
    re.compile(r"^transactions_backup_\d{8}_\d{6}$"),
]


def list_backup_tables(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    names = [r[0] for r in cur.fetchall()]
    backups = []
    for n in names:
        if any(p.match(n) for p in PATTERNS):
            backups.append(n)
    return sorted(backups)


def main():
    do_drop = "--yes" in sys.argv
    if not DB_PATH.exists():
        print(f"DB not found: {DB_PATH}")
        return
    conn = sqlite3.connect(str(DB_PATH))
    try:
        backups = list_backup_tables(conn)
        if not backups:
            print("No legacy backup tables found. Nothing to do.")
            return
        print("Found legacy backup tables:")
        for n in backups:
            print("  -", n)
        if not do_drop:
            print("\nDry run. To drop these tables, run with --yes")
            return
        cur = conn.cursor()
        for n in backups:
            cur.execute(f"DROP TABLE IF EXISTS {n}")
            print("Dropped:", n)
        conn.commit()
        print("\nDone.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
