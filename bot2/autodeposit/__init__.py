#!/usr/bin/env python3
"""
Auto-deposit package for monitoring bank email notifications
and automatically confirming deposit requests.
"""

from .watcher import AutoDepositWatcher, start_autodeposit, stop_autodeposit
from .parsers import (
    parse_demirbank_email,
    parse_optima_email,
    parse_mbank_email,
    parse_megapay_email,
    parse_bakai_email,
    parse_email_by_bank
)

__all__ = [
    'AutoDepositWatcher',
    'start_autodeposit',
    'stop_autodeposit',
    'parse_demirbank_email',
    'parse_optima_email',
    'parse_mbank_email',
    'parse_megapay_email',
    'parse_bakai_email',
    'parse_email_by_bank'
]

