#!/usr/bin/env python3
"""
Cleanup legacy tables and unify reads to the single 'requests' table.
This script is SAFE: it does NOT delete data. It renames legacy tables to backups
and creates SQLite VIEWs with the same names that read from 'requests'.

Target DB: c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db

Legacy tables handled:
- deposit_requests
- withdrawals
- transactions

After running:
- Old code that still queries the legacy tables will continue to work via VIEWs.
- New code should use the unified 'requests' table directly.

Run:
  python scripts/cleanup_legacy_tables.py
"""
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(r"c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db")

LEGACY = [
    "deposit_requests",
    "withdrawals",
    "transactions",
]

def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None

def view_exists(conn: sqlite3.Connection, name: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='view' AND name=?", (name,))
    return cur.fetchone() is not None

def rename_to_backup(conn: sqlite3.Connection, name: str) -> str:
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup = f"{name}_backup_{ts}"
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE {name} RENAME TO {backup}")
    conn.commit()
    return backup

def create_view_for_legacy(conn: sqlite3.Connection, name: str) -> None:
    cur = conn.cursor()
    if name == 'deposit_requests':
        # Provide a compatible selection from 'requests' where request_type='deposit'
        cur.execute(
            """
            CREATE VIEW IF NOT EXISTS deposit_requests AS
            SELECT 
              id,
              user_id,
              bookmaker,
              amount,
              status,
              created_at
            FROM requests
            WHERE request_type = 'deposit'
            """
        )
    elif name == 'withdrawals':
        # Provide a compatible selection from 'requests' where request_type='withdraw'
        cur.execute(
            """
            CREATE VIEW IF NOT EXISTS withdrawals AS
            SELECT 
              id,
              user_id,
              bookmaker,
              amount,
              status,
              created_at,
              processed_at
            FROM requests
            WHERE request_type = 'withdraw'
            """
        )
    elif name == 'transactions':
        # Map requests to a transactions-like shape
        cur.execute(
            """
            CREATE VIEW IF NOT EXISTS transactions AS
            SELECT 
              id,
              user_id,
              bookmaker,
              CASE WHEN request_type='withdraw' THEN 'withdrawal' ELSE 'deposit' END AS trans_type,
              amount,
              status,
              created_at
            FROM requests
            """
        )
    else:
        return
    conn.commit()

def main():
    if not DB_PATH.exists():
        print(f"DB not found: {DB_PATH}")
        return
    conn = sqlite3.connect(str(DB_PATH))
    # Ensure 'requests' exists – if not, abort to avoid breaking legacy reads
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
    if not cur.fetchone():
        print("ERROR: 'requests' table not found. Aborting to keep legacy tables intact.")
        conn.close()
        return

    for name in LEGACY:
        try:
            # If there's already a VIEW with this name, skip
            if view_exists(conn, name):
                print(f"View already exists: {name} (skipped)")
                continue
            if table_exists(conn, name):
                backup = rename_to_backup(conn, name)
                print(f"Renamed table {name} -> {backup}")
            else:
                print(f"No table named {name} (skipped rename)")
            create_view_for_legacy(conn, name)
            print(f"Created VIEW: {name} -> reads from 'requests'")
        except Exception as e:
            print(f"Error handling {name}: {e}")
    conn.close()
    print("\nDone. Legacy tables are backed up and replaced by VIEWs to 'requests'.")
    print("You can now safely update code to use only 'requests' and later DROP the backups if unneeded.")

if __name__ == '__main__':
    main()
