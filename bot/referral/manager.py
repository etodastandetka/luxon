#!/usr/bin/env python3
"""
Referral system manager
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import os
import sys
# Ensure imports work when running this file directly: `python referral/manager.py`
# Adds bot/ (parent dir) to sys.path so `from database import Database` resolves
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)
from database import Database

logger = logging.getLogger(__name__)

class ReferralManager:
    """Manager for referral system"""
    
    def __init__(self, db: Database):
        self.db = db
        self.commission_rate = 0.02  # 2%
        self.min_deposit_for_commission = 100  # Minimum deposit for commission
        self.max_daily_commissions = 1000  # Protection against abuse
        self.max_monthly_commissions = 5000  # Monthly limit
        self.commission_history = []  # In-memory history for performance
    
    def create_referral(self, referrer_id: int, referred_id: int) -> bool:
        """Create new referral relationship"""
        try:
            # Check if referral already exists
            if self.db.get_referral_by_referred_id(referred_id):
                logger.warning(f"User {referred_id} already has a referrer")
                return False
            
            # Create referral
            self.db.create_referral(referrer_id, referred_id)
            logger.info(f"✅ Referral created: {referrer_id} -> {referred_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error creating referral: {e}")
            return False
    
    def process_deposit_commission(self, user_id: int, amount: float, bookmaker: str) -> bool:
        """Process commission for referrer when user makes deposit"""
        try:
            # Get referrer for this user
            referrer_id = self.db.get_referrer_id(user_id)
            if not referrer_id:
                logger.info(f"User {user_id} has no referrer")
                return False
            
            # Check minimum deposit amount
            if amount < self.min_deposit_for_commission:
                logger.info(f"Deposit {amount} below minimum for commission")
                return False
            
            # Check daily commission limit
            if self._exceeded_daily_limit(referrer_id):
                logger.warning(f"Daily commission limit exceeded for referrer {referrer_id}")
                return False
            
            # Check monthly commission limit
            if self._exceeded_monthly_limit(referrer_id):
                logger.warning(f"Monthly commission limit exceeded for referrer {referrer_id}")
                return False
            
            # Check for suspicious activity
            if self._is_suspicious_activity(user_id, referrer_id, amount):
                logger.warning(f"Suspicious activity detected: user {user_id}, referrer {referrer_id}")
                return False
            
            # Calculate commission
            commission_amount = amount * self.commission_rate
            
            # Save commission
            commission_id = self.db.save_referral_commission(
                referrer_id=referrer_id,
                referred_id=user_id,
                amount=amount,
                commission_amount=commission_amount,
                bookmaker=bookmaker
            )
            
            # Add to history
            self._add_to_history(commission_id, referrer_id, user_id, amount, commission_amount, bookmaker)
            
            logger.info(f"✅ Commission {commission_amount} saved for referrer {referrer_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error processing commission: {e}")
            return False
    
    def get_referral_stats(self, user_id: int) -> Dict[str, Any]:
        """Get referral statistics for user"""
        try:
            referrals = self.db.get_referral_list(user_id)
            total_earnings = self.db.get_referral_earnings(user_id)
            pending_earnings = self.db.get_pending_referral_earnings(user_id)
            
            return {
                'referrals_count': len(referrals),
                'total_earnings': total_earnings,
                'pending_earnings': pending_earnings,
                'referrals': referrals[:10]  # Top 10 referrals
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting referral stats: {e}")
            return {
                'referrals_count': 0,
                'total_earnings': 0,
                'pending_earnings': 0,
                'referrals': []
            }
    
    def get_referral_top(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get top referrers by earnings"""
        try:
            return self.db.get_referral_top(limit)
        except Exception as e:
            logger.error(f"❌ Error getting referral top: {e}")
            return []
    
    def get_monthly_top(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get monthly top referrers"""
        try:
            # Get current month
            now = datetime.now()
            month_start = datetime(now.year, now.month, 1)
            month_end = month_start + timedelta(days=32)
            month_end = datetime(month_end.year, month_end.month, 1) - timedelta(days=1)
            
            return self.db.get_referral_top_by_period(month_start, month_end, limit)
            
        except Exception as e:
            logger.error(f"❌ Error getting monthly top: {e}")
            return []
    
    def generate_referral_link(self, user_id: int, bot_username: str) -> str:
        """Generate referral link for user"""
        return f"https://t.me/{bot_username}?start=ref{user_id}"
    
    def is_valid_referral_code(self, code: str) -> bool:
        """Check if referral code is valid"""
        if not code.startswith('ref'):
            return False
        
        try:
            user_id = int(code[3:])
            return user_id > 0
        except ValueError:
            return False
    
    def get_user_id_from_code(self, code: str) -> Optional[int]:
        """Extract user ID from referral code"""
        if not self.is_valid_referral_code(code):
            return None
        
        try:
            return int(code[3:])
        except ValueError:
            return None
    
    def can_user_be_referred(self, user_id: int) -> bool:
        """Check if user can be referred (not already referred)"""
        try:
            existing_referral = self.db.get_referral_by_referred_id(user_id)
            return existing_referral is None
        except Exception as e:
            logger.error(f"❌ Error checking if user can be referred: {e}")
            return False
    
    def _exceeded_daily_limit(self, referrer_id: int) -> bool:
        """Check if daily commission limit exceeded"""
        try:
            from datetime import datetime, timedelta
            today = datetime.now().date()
            daily_commissions = self.db.get_referral_earnings_by_period(
                referrer_id, today, today + timedelta(days=1)
            )
            return daily_commissions > self.max_daily_commissions
        except Exception as e:
            logger.error(f"❌ Error checking daily limit: {e}")
            return False
    
    def _exceeded_monthly_limit(self, referrer_id: int) -> bool:
        """Check if monthly commission limit exceeded"""
        try:
            from datetime import datetime
            now = datetime.now()
            month_start = datetime(now.year, now.month, 1)
            month_end = month_start + timedelta(days=32)
            month_end = datetime(month_end.year, month_end.month, 1) - timedelta(days=1)
            
            monthly_commissions = self.db.get_referral_earnings_by_period(
                referrer_id, month_start, month_end
            )
            return monthly_commissions > self.max_monthly_commissions
        except Exception as e:
            logger.error(f"❌ Error checking monthly limit: {e}")
            return False
    
    def _is_suspicious_activity(self, user_id: int, referrer_id: int, amount: float) -> bool:
        """Check for suspicious referral activity"""
        try:
            # Check if user is referring themselves
            if user_id == referrer_id:
                return True
            
            # Check if referrer has too many referrals in short time
            recent_referrals = self.db.get_recent_referrals_count(referrer_id, hours=24)
            if recent_referrals > 10:  # More than 10 referrals in 24 hours
                return True
            
            # Check if amount is suspiciously high
            if amount > 50000:  # Very high deposit
                return True
            
            # Check if user and referrer are from same IP (if available)
            # This would require additional tracking in the future
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Error checking suspicious activity: {e}")
            return False
    
    def _add_to_history(self, commission_id: int, referrer_id: int, referred_id: int, 
                        amount: float, commission_amount: float, bookmaker: str):
        """Add commission to in-memory history"""
        try:
            from datetime import datetime
            history_entry = {
                'id': commission_id,
                'referrer_id': referrer_id,
                'referred_id': referred_id,
                'amount': amount,
                'commission_amount': commission_amount,
                'bookmaker': bookmaker,
                'timestamp': datetime.now(),
                'status': 'pending'
            }
            
            self.commission_history.append(history_entry)
            
            # Keep only last 1000 entries for memory management
            if len(self.commission_history) > 1000:
                self.commission_history = self.commission_history[-1000:]
                
        except Exception as e:
            logger.error(f"❌ Error adding to history: {e}")
    
    def get_commission_history(self, referrer_id: int, limit: int = 50) -> list:
        """Get commission history for referrer"""
        try:
            # Get from database for persistence
            return self.db.get_referral_commission_history(referrer_id, limit)
        except Exception as e:
            logger.error(f"❌ Error getting commission history: {e}")
            return []
    
    def get_referral_analytics(self, referrer_id: int) -> Dict[str, Any]:
        """Get detailed referral analytics"""
        try:
            from datetime import datetime, timedelta
            
            now = datetime.now()
            today = now.date()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)
            
            analytics = {
                'total_referrals': self.db.get_referral_count(referrer_id),
                'total_earnings': self.db.get_referral_earnings(referrer_id),
                'pending_earnings': self.db.get_pending_referral_earnings(referrer_id),
                'today_earnings': self.db.get_referral_earnings_by_period(referrer_id, today, today + timedelta(days=1)),
                'week_earnings': self.db.get_referral_earnings_by_period(referrer_id, week_ago, now),
                'month_earnings': self.db.get_referral_earnings_by_period(referrer_id, month_ago, now),
                'avg_commission': self.db.get_average_commission(referrer_id),
                'top_referrals': self.db.get_top_referrals_by_earnings(referrer_id, limit=5)
            }
            
            return analytics
            
        except Exception as e:
            logger.error(f"❌ Error getting referral analytics: {e}")
            return {}

if __name__ == "__main__":
    # Lightweight sanity check to ensure DB import works when running directly
    logging.basicConfig(level=logging.INFO)
    try:
        db = Database()
        mgr = ReferralManager(db)
        print("ReferralManager is ready. Users in DB:", end=" ")
        try:
            import sqlite3
            conn = sqlite3.connect(db.db_path)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users")
            print(cur.fetchone()[0])
            conn.close()
        except Exception:
            print("unknown")
    except Exception as e:
        print("Failed to initialize ReferralManager:", e)
