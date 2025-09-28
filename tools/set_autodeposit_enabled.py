#!/usr/bin/env python3
"""
Set autodeposit_enabled=1 in universal_bot.db (table bot_settings).
Safe to run multiple times. Creates the table if missing.
"""
import sqlite3
import os

# Default DB path (matches bot.qr_utils._bot_db_path)
DEFAULT_DB_PATH = r"c:\\Users\\etoda\\Desktop\\bets\\universal_bot.db"

DB_PATH = os.environ.get("UNIVERSAL_BOT_DB", DEFAULT_DB_PATH)

print(f"Using DB: {DB_PATH}")

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Ensure bot_settings table exists
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """
)

# Upsert autodeposit_enabled=1
cur.execute(
    """
    INSERT INTO bot_settings(key, value) VALUES('autodeposit_enabled','1')
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
    """
)

con.commit()
con.close()

print("autodeposit_enabled set to 1 ✅")
