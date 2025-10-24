#!/usr/bin/env python3
"""
Auto-deposit watcher: monitors a mailbox via IMAP for bank payment notifications
and auto-confirms matching deposit requests.

Configuration (bot_settings table or environment variables):
- autodeposit_enabled: '1' or '0'
- autodeposit_imap: IMAP hostname (e.g., 'imap.timeweb.ru' or 'mail.timeweb.ru')
- autodeposit_email: mailbox login
- autodeposit_password: mailbox password
- autodeposit_folder: mailbox folder to check (default: 'INBOX')
- autodeposit_bank: 'DEMIRBANK' (supported now)
- autodeposit_interval_sec: polling seconds (default: 60)
"""
import asyncio
import imaplib
import email
import os
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from .parsers import parse_demirbank_email, parse_optima_email, parse_mbank_email, parse_megapay_email, parse_bakai_email

logger = logging.getLogger(__name__)


class AutoDepositWatcher:
    def __init__(self, db_path: str, bot=None, loop=None):
        self.db_path = db_path
        self.bot = bot
        self.loop = loop
        self._task = None
        self._stop_event = asyncio.Event()

    async def start(self):
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AutoDepositWatcher started")

    async def stop(self):
        if self._task:
            self._stop_event.set()
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except asyncio.TimeoutError:
                logger.warning("AutoDepositWatcher stop timeout")
            self._task = None
        logger.info("AutoDepositWatcher stopped")

    async def _run_loop(self):
        """Main monitoring loop"""
        while not self._stop_event.is_set():
            try:
                await self._check_emails()
            except Exception as e:
                logger.error(f"Error in email check: {e}")
            
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._get_interval())
            except asyncio.TimeoutError:
                pass

    def _get_interval(self) -> int:
        """Get polling interval from settings"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM bot_settings WHERE key = 'autodeposit_interval_sec'")
            row = cursor.fetchone()
            conn.close()
            return int(row[0]) if row else 60
        except:
            return 60

    def _get_settings(self) -> dict:
        """Get autodeposit settings from database"""
        settings = {}
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            keys = [
                'autodeposit_enabled',
                'autodeposit_imap',
                'autodeposit_email',
                'autodeposit_password',
                'autodeposit_folder',
                'autodeposit_bank'
            ]
            
            for key in keys:
                cursor.execute("SELECT value FROM bot_settings WHERE key = ?", (key,))
                row = cursor.fetchone()
                settings[key] = row[0] if row else None
            
            conn.close()
        except Exception as e:
            logger.error(f"Error getting settings: {e}")
        
        return settings

    async def _check_emails(self):
        """Check for new payment emails"""
        settings = self._get_settings()
        
        if not settings.get('autodeposit_enabled') == '1':
            return
        
        if not all(settings.get(k) for k in ['autodeposit_imap', 'autodeposit_email', 'autodeposit_password']):
            logger.warning("AutoDeposit settings incomplete")
            return
        
        try:
            # Connect to IMAP
            mail = imaplib.IMAP4_SSL(settings['autodeposit_imap'])
            mail.login(settings['autodeposit_email'], settings['autodeposit_password'])
            
            folder = settings.get('autodeposit_folder', 'INBOX')
            mail.select(folder)
            
            # Search for unread emails from today
            today = datetime.now().strftime('%d-%b-%Y')
            search_criteria = f'(UNSEEN SINCE "{today}")'
            
            status, messages = mail.search(None, search_criteria)
            
            if status == 'OK' and messages[0]:
                email_ids = messages[0].split()
                
                for email_id in email_ids:
                    await self._process_email(mail, email_id, settings)
            
            mail.close()
            mail.logout()
            
        except Exception as e:
            logger.error(f"IMAP error: {e}")

    async def _process_email(self, mail, email_id, settings):
        """Process a single email"""
        try:
            status, msg_data = mail.fetch(email_id, '(RFC822)')
            
            if status != 'OK':
                return
            
            email_message = email.message_from_bytes(msg_data[0][1])
            
            # Get email content
            subject = email_message.get('Subject', '')
            sender = email_message.get('From', '')
            
            # Get body text
            body = self._extract_text_content(email_message)
            
            # Parse based on bank
            bank = settings.get('autodeposit_bank', 'DEMIRBANK')
            amount, datetime_str = self._parse_email_by_bank(body, bank)
            
            if amount and datetime_str:
                await self._process_payment(amount, datetime_str, subject, sender)
            
        except Exception as e:
            logger.error(f"Error processing email {email_id}: {e}")

    def _extract_text_content(self, email_message) -> str:
        """Extract text content from email message"""
        body = ""
        
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    break
        else:
            body = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
        
        return body

    def _parse_email_by_bank(self, body: str, bank: str) -> Tuple[Optional[float], Optional[str]]:
        """Parse email based on bank type"""
        bank = bank.upper()
        
        if bank == 'DEMIRBANK':
            return parse_demirbank_email(body)
        elif bank == 'OPTIMA':
            return parse_optima_email(body)
        elif bank == 'MBANK':
            return parse_mbank_email(body)
        elif bank == 'MEGAPAY':
            return parse_megapay_email(body)
        elif bank == 'BAKAI':
            return parse_bakai_email(body)
        else:
            logger.warning(f"Unknown bank: {bank}")
            return None, None

    async def _process_payment(self, amount: float, datetime_str: str, subject: str, sender: str):
        """Process a payment notification"""
        try:
            # Find matching deposit request
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Look for pending deposit requests with matching amount
            cursor.execute("""
                SELECT id, user_id, bookmaker, player_id, amount, bank, payment_url
                FROM deposit_requests 
                WHERE status = 'pending' 
                AND ABS(amount - ?) < 0.01
                ORDER BY created_at DESC
                LIMIT 1
            """, (amount,))
            
            row = cursor.fetchone()
            
            if row:
                request_id, user_id, bookmaker, player_id, req_amount, bank, payment_url = row
                
                # Update status to completed
                cursor.execute("""
                    UPDATE deposit_requests 
                    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (request_id,))
                
                # Log the auto-confirmation
                cursor.execute("""
                    INSERT INTO autodeposit_logs (request_id, amount, email_subject, email_sender, processed_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (request_id, amount, subject, sender))
                
                conn.commit()
                conn.close()
                
                logger.info(f"Auto-confirmed deposit request {request_id} for {amount} сом")
                
                # Notify user if bot is available
                if self.bot:
                    try:
                        await self.bot.send_message(
                            user_id, 
                            f"✅ Ваше пополнение на {amount} сом подтверждено автоматически!"
                        )
                    except Exception as e:
                        logger.error(f"Error notifying user {user_id}: {e}")
            else:
                logger.warning(f"No matching deposit request found for amount {amount}")
                conn.close()
                
        except Exception as e:
            logger.error(f"Error processing payment: {e}")

    def create_tables(self):
        """Create necessary database tables"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create autodeposit_logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS autodeposit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id INTEGER,
                    amount REAL,
                    email_subject TEXT,
                    email_sender TEXT,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (request_id) REFERENCES deposit_requests (id)
                )
            """)
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error creating tables: {e}")


# Global instance
_watcher = None

async def start_autodeposit(db_path: str, bot=None):
    """Start the autodeposit watcher"""
    global _watcher
    
    if _watcher:
        await _watcher.stop()
    
    _watcher = AutoDepositWatcher(db_path, bot)
    _watcher.create_tables()
    await _watcher.start()

async def stop_autodeposit():
    """Stop the autodeposit watcher"""
    global _watcher
    
    if _watcher:
        await _watcher.stop()
        _watcher = None

