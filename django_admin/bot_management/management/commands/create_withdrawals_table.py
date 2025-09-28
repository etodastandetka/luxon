from django.core.management.base import BaseCommand
import sqlite3
from django.conf import settings

class Command(BaseCommand):
    help = 'Creates the withdrawal_requests table in the database'

    def handle(self, *args, **options):
        db_path = settings.BOT_DATABASE_PATH
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Create withdrawal_requests table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS withdrawal_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    wallet_details TEXT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    comment TEXT,
                    transaction_hash TEXT
                )
            ''')
            
            # Create index for faster lookups
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_requests(user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status)')
            
            conn.commit()
            self.stdout.write(self.style.SUCCESS('Successfully created withdrawal_requests table'))
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error creating withdrawal_requests table: {str(e)}'))
        finally:
            if conn:
                conn.close()
