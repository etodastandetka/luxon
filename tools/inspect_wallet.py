#!/usr/bin/env python3
"""
Inspect wallet data stored in universal_bot.db
- requisites (id, value, is_active, name, email, password masked, created_at)
Optionally show counts in requests table.
"""
import sqlite3
import os
from datetime import datetime

DEFAULT_DB_PATH = r"c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db"
DB_PATH = os.environ.get("UNIVERSAL_BOT_DB", DEFAULT_DB_PATH)

print(f"Using DB: {DB_PATH}")

if not os.path.exists(DB_PATH):
    print("DB file does not exist")
    raise SystemExit(1)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Ensure requisites table exists (read-only create)
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

print("\n== Requisites ==")
cur.execute("SELECT id, value, COALESCE(is_active,0), COALESCE(name,''), COALESCE(email,''), COALESCE(password,''), COALESCE(created_at,'') FROM requisites ORDER BY id DESC")
rows = cur.fetchall()
if not rows:
    print("(empty)")
else:
    for rid, value, is_active, name, email, password, created_at in rows:
        masked_pwd = ("*" * len(password)) if password else ""
        print(f"- id={rid} active={bool(is_active)} value={value} name='{name}' email='{email}' password='{masked_pwd}' created_at='{created_at}'")

# Optional: show requests stats if table exists
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
if cur.fetchone():
    print("\n== Requests summary ==")
    for req_type in ("deposit", "withdraw"):
        cur.execute(
            """
            SELECT COUNT(*), COALESCE(SUM(amount),0)
            FROM requests
            WHERE request_type=?
            """,
            (req_type,)
        )
        cnt, s = cur.fetchone()
        print(f"{req_type}: count={cnt} sum={float(s):.2f}")
else:
    print("\n(no 'requests' table)")

con.close()
print("\nDone.")
