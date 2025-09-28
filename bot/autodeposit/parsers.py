#!/usr/bin/env python3
"""
Parsers for bank email notifications used in auto-deposit flow.
Supports Demirbank and basic patterns for Optima, MBank, MegaPay, Bakai.
"""
import re
from typing import Optional, Tuple

AMOUNT_RE = re.compile(r"на\s+сумму\s+([0-9]+(?:[\.,][0-9]{1,2})?)\s*(KGS|сом|сомов)?", re.IGNORECASE)
DATETIME_RE = re.compile(r"(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})")


def parse_demirbank_email(text: str) -> Optional[Tuple[float, str]]:
    """
    Parse a Demirbank QR payment email body.
    Returns (amount, iso_datetime) or None if not recognized.

    Example body snippet (ru):
    "Вам поступил перевод с помощью QR-платежа на сумму 100.53 KGS от 22.09.2025 22:13:24."
    """
    if not text:
        return None

    m_amount = AMOUNT_RE.search(text)
    if not m_amount:
        return None

    amount_str = m_amount.group(1).replace(',', '.')
    try:
        amount = float(amount_str)
    except ValueError:
        return None

    m_dt = DATETIME_RE.search(text)
    iso_dt = None
    if m_dt:
        d, t = m_dt.groups()
        # 22.09.2025 22:13:24 -> 2025-09-22T22:13:24
        dd, mm, yyyy = d.split('.')
        iso_dt = f"{yyyy}-{mm}-{dd}T{t}"

    return amount, (iso_dt or "")


# ===== Generic simple patterns for other banks =====
def _parse_generic_amount_dt(text: str) -> Optional[Tuple[float, str]]:
    if not text:
        return None
    m_amount = AMOUNT_RE.search(text)
    if not m_amount:
        # fallback: any number prior to (сом|KGS)
        m_amount = re.search(r"([0-9]+(?:[\.,][0-9]{1,2})?)\s*(KGS|сом|сомов)", text, re.I)
        if not m_amount:
            return None
    amount_str = m_amount.group(1).replace(',', '.')
    try:
        amount = float(amount_str)
    except ValueError:
        return None
    m_dt = DATETIME_RE.search(text)
    iso_dt = None
    if m_dt:
        d, t = m_dt.groups()
        dd, mm, yyyy = d.split('.')
        iso_dt = f"{yyyy}-{mm}-{dd}T{t}"
    return amount, (iso_dt or "")


def parse_optima_email(text: str) -> Optional[Tuple[float, str]]:
    return _parse_generic_amount_dt(text)


def parse_mbank_email(text: str) -> Optional[Tuple[float, str]]:
    return _parse_generic_amount_dt(text)


def parse_megapay_email(text: str) -> Optional[Tuple[float, str]]:
    return _parse_generic_amount_dt(text)


def parse_bakai_email(text: str) -> Optional[Tuple[float, str]]:
    return _parse_generic_amount_dt(text)
