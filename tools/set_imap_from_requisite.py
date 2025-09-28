#!/usr/bin/env python3
"""
Set IMAP settings in bot_settings using data from the active requisite in universal_bot.db.
- autodeposit_enabled = 1
- autodeposit_imap = (default: imap.timeweb.ru, overridable)
- autodeposit_email = (from active requisite, or --email)
- autodeposit_password = (from active requisite, or --password)
- autodeposit_folder = (default: INBOX, overridable)

Usage:
  python set_imap_from_requisite.py [--host imap.timeweb.ru] [--folder INBOX] [--email EMAIL] [--password PASS]

You can override DB path with env UNIVERSAL_BOT_DB.
"""
import os
import sqlite3
import argparse

DEFAULT_DB_PATH = r"c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db"
DB_PATH = os.environ.get("UNIVERSAL_BOT_DB", DEFAULT_DB_PATH)

def upsert(cur, key: str, value: str):
    cur.execute(
        """
        INSERT INTO bot_settings(key, value) VALUES(?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """,
        (key, value)
    )

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='imap.timeweb.ru', help='IMAP host, default: imap.timeweb.ru')
parser.add_argument('--folder', default='INBOX', help='Mailbox folder, default: INBOX')
parser.add_argument('--email', default=None, help='Override email (otherwise taken from active requisite)')
parser.add_argument('--password', default=None, help='Override password (otherwise taken from active requisite)')
args = parser.parse_args()

print(f"Using DB: {DB_PATH}")

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Ensure tables
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """
)
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

email = args.email
password = args.password
if email is None or password is None:
    cur.execute('SELECT email, password FROM requisites WHERE is_active=1 LIMIT 1')
    row = cur.fetchone()
    if row:
        email = email or (row[0] or '').strip() or None
        password = password or (row[1] or '').strip() or None

if not email or not password:
    con.close()
    raise SystemExit("Active requisite with email/password not found, and no overrides provided. Aborting.")

# Write settings
upsert(cur, 'autodeposit_enabled', '1')
upsert(cur, 'autodeposit_imap', args.host)
upsert(cur, 'autodeposit_email', email)
upsert(cur, 'autodeposit_password', password)
upsert(cur, 'autodeposit_folder', args.folder)

con.commit()
con.close()

print("IMAP settings saved to bot_settings ✅")
