#!/usr/bin/env python3
"""
Resync historical requests from local SQLite to the website API.

- Reads from bot SQLite DB (same location as Database.db_path, or fallback to bot/universal_bot.db)
- Sends/updates each record to the Django endpoint with proper fields so deposits show green when completed

Usage (PowerShell):
  $env:DJANGO_ADMIN_URL = "http://localhost:8081"
  python tools/resync_website_history.py

Optional args:
  --limit  N         process at most N records
  --status STATUS    only records with this status (pending|completed|awaiting_manual|rejected)
  --type   TYPE      only records with this request_type (deposit|withdraw)

Safety:
- Script is idempotent: it always POSTs the current state; server should upsert or update by its own logic.
- If your server requires auth, set env DJANGO_ADMIN_TOKEN and it will send header Authorization: Token <token>
"""
import argparse
import os
import sqlite3
import sys
from pathlib import Path
import time
import json
from typing import Optional, Tuple, Dict, Any

import requests

DEFAULT_DB_FALLBACK = str((Path(__file__).resolve().parents[1] / 'bot' / 'universal_bot.db'))


def _bot_db_path() -> str:
    # Try to import Database to read actual path
    try:
        sys.path.append(str(Path(__file__).resolve().parents[1] / 'bot'))
        from database import Database  # type: ignore
        db = Database()
        return getattr(db, 'db_path')
    except Exception:
        return DEFAULT_DB_FALLBACK


def iter_requests(db_path: str, only_status: Optional[str], only_type: Optional[str], limit: Optional[int]):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    # Ensure columns exist even on older DBs
    for ddl in [
        "ALTER TABLE requests ADD COLUMN admin_chat_id INTEGER",
        "ALTER TABLE requests ADD COLUMN admin_message_id INTEGER",
        "ALTER TABLE requests ADD COLUMN auto_completed INTEGER DEFAULT 0",
        "ALTER TABLE requests ADD COLUMN bank_received INTEGER DEFAULT 0",
        "ALTER TABLE requests ADD COLUMN bank_received_at TIMESTAMP",
    ]:
        try:
            cur.execute(ddl)
        except Exception:
            pass
    conn.commit()

    where = ["request_type IS NOT NULL"]
    params = []
    if only_status:
        where.append("status = ?")
        params.append(only_status)
    if only_type:
        where.append("request_type = ?")
        params.append(only_type)

    sql = (
        "SELECT id, user_id, username, first_name, bookmaker, account_id, amount, request_type, status, "
        "photo_file_id, photo_file_url, created_at, updated_at, processed_at "
        "FROM requests WHERE " + " AND ".join(where) + " ORDER BY created_at ASC"
    )
    if limit and limit > 0:
        sql += f" LIMIT {int(limit)}"

    for row in cur.execute(sql, params):
        yield {
            'id': row[0],
            'user_id': row[1],
            'username': row[2] or '',
            'first_name': row[3] or '',
            'bookmaker': row[4] or '',
            'account_id': str(row[5]) if row[5] is not None else '',
            'amount': float(row[6] or 0),
            'request_type': row[7] or 'deposit',
            'status': row[8] or 'pending',
            'receipt_photo': row[9] or '',
            'receipt_photo_url': row[10] or '',
            'created_at': row[11],
            'updated_at': row[12],
            'processed_at': row[13],
        }


def send_to_site(item: dict, base_url: str, token: Optional[str]) -> Tuple[int, str]:
    url = f"{base_url.rstrip('/')}/bot/api/bot/deposit-request/"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Token {token}"

    payload = {
        'user_id': item['user_id'],
        'username': item['username'],
        'first_name': item['first_name'],
        'bookmaker': item['bookmaker'],
        'amount': item['amount'],
        'account_id': item['account_id'],
        'receipt_photo': item['receipt_photo'],
        'receipt_photo_url': item['receipt_photo_url'],
        'status': item['status'],
        'request_type': item['request_type'],
        # extra hints for correct classification on site
        'type': 'deposit' if item['request_type'] == 'deposit' else 'withdraw',
        'direction': 'in' if item['request_type'] == 'deposit' else 'out',
        'is_deposit': item['request_type'] == 'deposit',
    }
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
    return resp.status_code, resp.text


def update_status(item: dict, base_url: str, token: Optional[str]) -> Tuple[int, str]:
    """Call /api/bot/update-status/ to update status in the SQLite requests table the site reads from."""
    url = f"{base_url.rstrip('/')}/bot/api/bot/update-status/"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Token {token}"
    payload = {
        'request_id': item['id'],
        'status': item['status'],
        'request_type': item['request_type'],
    }
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
    return resp.status_code, resp.text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--status', type=str, default=None)
    parser.add_argument('--type', dest='rtype', type=str, default=None, choices=['deposit', 'withdraw'])
    parser.add_argument('--base-url', dest='base_url', type=str, default=None, help='Override DJANGO_ADMIN_URL env')
    parser.add_argument('--update-status', action='store_true', help='Also call update-status API to sync the requests table used by the site UI')
    args = parser.parse_args()

    base_url = args.base_url or os.getenv('DJANGO_ADMIN_URL', 'http://127.0.0.1:8000')
    token = os.getenv('DJANGO_ADMIN_TOKEN')
    db_path = _bot_db_path()

    print(f"Resync to {base_url}; DB: {db_path}")

    total = 0
    ok = 0
    failed = 0

    try:
        for item in iter_requests(db_path, args.status, args.rtype, args.limit):
            total += 1
            code, text = send_to_site(item, base_url, token)
            if code in (200, 201):
                ok += 1
                print(f"OK create #{item['id']} -> {code}")
            else:
                failed += 1
                print(f"FAIL create #{item['id']} -> {code} {text[:200]}")

            if args.update_status:
                code2, text2 = update_status(item, base_url, token)
                if 200 <= code2 < 300:
                    print(f"OK update #{item['id']} -> {code2}")
                else:
                    print(f"FAIL update #{item['id']} -> {code2} {text2[:200]}")
            # be gentle
            time.sleep(0.05)
    except KeyboardInterrupt:
        print("Interrupted")

    print(f"Done. Total: {total}, OK: {ok}, Failed: {failed}")


if __name__ == '__main__':
    main()
