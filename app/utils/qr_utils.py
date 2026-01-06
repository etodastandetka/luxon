from typing import Optional
import os
import hashlib
from decimal import Decimal, ROUND_HALF_UP
import re

BASE_QR_HASH = (
    "00020101021232990015qr.demirbank.kg0108ib_andro1016118000035393208912021213021211328454d5b3ee5d47c7b61c0a0b07bb939a"
    "5204482953034175405100535909DEMIRBANK6304283f"
)

# Если True, принудительно используем статический QR: 010211 (как у конкурента)
FORCE_STATIC_QR_TYPE = False
REMOVE_TAG_28_IN_32 = False

# Алгоритм контрольной суммы по умолчанию согласно документации: SHA256-last-4.
# Возможные значения: 'sha256', 'sha256_plus_63', 'sha256_plus_6304', 'crc16'
CHECKSUM_METHOD = 'sha256'

def fix_demirbank_qr_structure(qr_hash: str, new_amount: float) -> str:
    """Генерирует DemirBank QR hash согласно образцу. Контрольная сумма берётся из calculate_checksum()."""
    
    # Сумма как целое число тыйынов (200.77 -> 20077) через Decimal (чтобы не ловить ошибки float),
    # паддируем до 5 символов (например 100.53 -> 10053 -> '10053', 10.05 -> 1005 -> '01005')
    amount_cents = int((Decimal(str(new_amount)) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    amount_str = str(amount_cents).rjust(5, '0')
    amount_len_str = str(len(amount_str)).zfill(2)
    
    # Правильная TLV структура согласно образцу
    # 00 - Payload Format Indicator (фиксированное поле)
    payload_format = "000201"
    
    # 01 - Point of Initiation Method (динамический QR)  
    point_of_initiation = "010212"
    
    # 32 - Merchant Account Information (из проверенного образца)
    merchant_account_value = (
        "0015qr.demirbank.kg"
        "0108ib_andro"
        "10161180000353932089"
        "11092021113021"
        "120212"
        "130212"
        "28454d5b3ee5d47c7b61c0a0b07bb939a"
    )
    # Проверка максимальной длины подTLV-блока (LL не может превышать 99)
    if len(merchant_account_value) > 99:
        raise ValueError("Длина вложенного блока поля 32 превышает 99 символов")
    merchant_account_len = str(len(merchant_account_value)).zfill(2)
    merchant_account = "32" + merchant_account_len + merchant_account_value
    
    # 52 - Merchant Category Code (в образце используется 52 длиной 04 со значением 4829)
    currency_field = "52044829"
    
    # 53 - Transaction Currency (в образце 5303417)
    country_field = "5303417"
    
    # 54 - Transaction Amount (TLV)
    amount_field = f"54{amount_len_str}{amount_str}"
    
    # 59 - Merchant Name (TLV)
    merchant_display_field = "5909DEMIRBANK"
    
    # Собираем все TLV поля в правильном порядке
    qr_data = (
        payload_format +
        point_of_initiation +
        merchant_account +
        currency_field +
        country_field +
        amount_field +
        merchant_display_field
    )
    
    # Контрольная сумма по выбранному методу
    checksum = calculate_checksum(qr_data, method=CHECKSUM_METHOD)
    
    # Финальный QR: данные + '6304' + контрольная сумма (последние 4 символа SHA256)
    final_qr = qr_data + "6304" + checksum
    
    return final_qr

def _calculate_emv_crc16_last4(payload_without_63: str) -> str:
    """EMV CRC16-CCITT (FALSE) по строке payload + '6304' (тег и длина включены),
    затем возвращаются последние 4 hex (нижний регистр)."""
    # Алгоритм CRC-16/CCITT-FALSE: poly=0x1021, init=0xFFFF, refin=False, refout=False, xorout=0x0000
    data = (payload_without_63 + '6304').encode('utf-8')
    crc = 0xFFFF
    poly = 0x1021
    for b in data:
        crc ^= (b << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) & 0xFFFF) ^ poly
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04x}"

def _calculate_sha256_last4(payload_without_63: str) -> str:
    """SHA256 по строке payload (ТОЛЬКО данные до тега 63, без добавления '63'/'6304'),
    затем последние 4 символа hex, нижний регистр (как описано в документации)."""
    h = hashlib.sha256(payload_without_63.encode('utf-8')).hexdigest()
    return h[-4:].lower()

def _calculate_sha256_last4_plus_63(payload_without_63: str) -> str:
    h = hashlib.sha256((payload_without_63 + '63').encode('utf-8')).hexdigest()
    return h[-4:].lower()

def _calculate_sha256_last4_plus_6304(payload_without_63: str) -> str:
    h = hashlib.sha256((payload_without_63 + '6304').encode('utf-8')).hexdigest()
    return h[-4:].lower()

def calculate_checksum(payload_without_63: str, method: str = 'sha256') -> str:
    method = (method or 'sha256').lower()
    if method == 'crc16':
        return _calculate_emv_crc16_last4(payload_without_63)
    if method == 'sha256_plus_63':
        return _calculate_sha256_last4_plus_63(payload_without_63)
    if method == 'sha256_plus_6304':
        return _calculate_sha256_last4_plus_6304(payload_without_63)
    # По умолчанию — sha256
    return _calculate_sha256_last4(payload_without_63)

def detect_checksum_method(full_qr_with_63: str) -> str:
    """Определяет, каким методом посчитана контрольная сумма в исходном QR: sha256 или crc16.
    Возвращает 'sha256' или 'crc16'. Если определить не удалось, возвращает значение CHECKSUM_METHOD.
    """
    try:
        # Ожидаем окончание на '6304' + 4 hex
        if '6304' not in full_qr_with_63:
            return CHECKSUM_METHOD
        parts = full_qr_with_63.rsplit('6304', 1)
        if len(parts) != 2:
            return CHECKSUM_METHOD
        payload = parts[0]
        last4 = parts[1][:4].lower()
        if _calculate_sha256_last4(payload) == last4:
            return 'sha256'
        if _calculate_sha256_last4_plus_63(payload) == last4:
            return 'sha256_plus_63'
        if _calculate_sha256_last4_plus_6304(payload) == last4:
            return 'sha256_plus_6304'
        if _calculate_emv_crc16_last4(payload) == last4:
            return 'crc16'
        return CHECKSUM_METHOD
    except Exception:
        return CHECKSUM_METHOD

def update_amount_in_qr_hash_proper(qr_hash: str, new_amount: float) -> str:
    """Обновляет поле 54 (сумма) и пересчитывает контрольную сумму (SHA256-last-4, верхний регистр).
    Ищем ПОСЛЕДНЕЕ вхождение тега 54, чтобы исключить ложные совпадения внутри вложенных данных.
    При FORCE_STATIC_QR_TYPE=True меняем 010212 на 010211 (тег 01: статический).
    """

    def _normalize_qr_input(s: str) -> str:
        """Нормализация входа: убираем переводы строк и табы, триммим края, но СОХРАНЯЕМ обычные пробелы внутри TLV (важно для 59)."""
        s = str(s).strip()
        return s.replace("\n", "").replace("\r", "").replace("\t", "")

    try:
        # 0) Нормализация без удаления внутренних пробелов
        qr_hash = _normalize_qr_input(qr_hash)
        # Снять существующую контрольную сумму в конце
        qr_wo_checksum = re.sub(r"6304[0-9A-Fa-f]{4}$", "", qr_hash)
        qr_wo_checksum = re.sub(r"63[0-9A-Fa-f]{4}$", "", qr_wo_checksum)

        # (Опционально) статический QR
        if FORCE_STATIC_QR_TYPE:
            qr_wo_checksum = re.sub(r"010212", "010211", qr_wo_checksum, count=1)

        # (Опционально) удалить под-тег 28 внутри 32 и пересчитать LL
        if REMOVE_TAG_28_IN_32:
            m32 = re.search(r"32(\d{2})", qr_wo_checksum)
            if m32:
                try:
                    idx = m32.start()
                    len_str = m32.group(1)
                    val_len = int(len_str)
                    val_start = idx + 4
                    val_end = val_start + val_len
                    if val_end <= len(qr_wo_checksum):
                        val_32 = qr_wo_checksum[val_start:val_end]
                        cleaned_val_32 = re.sub(r"28\d{2}[0-9A-Za-z]+", "", val_32)
                        if cleaned_val_32 != val_32:
                            new_len_str = f"{len(cleaned_val_32):02d}"
                            qr_wo_checksum = (
                                qr_wo_checksum[:idx] +
                                "32" + new_len_str + cleaned_val_32 +
                                qr_wo_checksum[val_end:]
                            )
                except Exception:
                    pass

        # Найдём ПОСЛЕДНЕЕ поле 54 через finditer, чтобы не задеть данные внутри 32
        matches = list(re.finditer(r"54(\d{2})(\d+)", qr_wo_checksum))
        if not matches:
            return qr_hash
        m54 = matches[-1]
        pos = m54.start()
        old_len = int(m54.group(1))
        val_start = pos + 4
        val_end = val_start + old_len
        if val_end > len(qr_wo_checksum):
            return qr_hash

        amount_cents = int((Decimal(str(new_amount)) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        # Паддируем до 5 символов, чтобы соответствовать примерам (1005 -> 01005)
        amount_str = str(amount_cents).rjust(5, '0')
        new_len_str = f"{len(amount_str):02d}"

        updated = (
            qr_wo_checksum[:pos] +
            "54" + new_len_str + amount_str +
            qr_wo_checksum[val_end:]
        )

        # Определяем метод по исходному хэшу и пересчитываем контрольную сумму тем же способом
        method = detect_checksum_method(qr_hash)
        cs = calculate_checksum(updated, method=method)
        return updated + "6304" + cs
    except Exception:
        return qr_hash

def build_demirbank_qr_by_template(*, requisite: str, amount: float, static_qr: bool = True) -> str:
    """Строит QR строго по вашему шаблону.
    ВАЖНО: параметр requisite — это ПОЛНОЕ значение для под‑тега 10 длиной 16 символов (только цифры).
    Никаких префиксов мы не добавляем — вставляем как есть (tag 10 length=16).
    Сумма (тег 54) — 5 цифр (тыйыны) с паддингом, длина всегда '05'.
    Контрольная сумма: SHA256-last-4 (нижний регистр), добавляется как 6304xxxx.
    """

    # 00
    payload_format = '000201'
    # 01
    point_of_initiation = '010211' if static_qr else '010212'

    # Подготовка 32 со всеми под‑тегами
    # 00 15 qr.demirbank.kg
    sub00 = '0015qr.demirbank.kg'
    # 01 04 7001 (как в описании)
    sub01 = '01047001'
    # 10 16 <полное значение 16 символов>
    req_val = str(requisite)
    # Жёсткая валидация формата: 16 цифр
    if not (len(req_val) == 16 and req_val.isdigit()):
        raise ValueError("requisite должен быть 16-значной строкой из цифр")
    sub10 = f"10{len(req_val):02d}{req_val}"
    # 12 02 11
    sub12 = '120211'
    # 13 02 12
    sub13 = '130212'
    v32 = sub00 + sub01 + sub10 + sub12 + sub13
    if len(v32) > 99:
        raise ValueError('Поле 32 превысило максимально допустимую длину 99')
    field32 = f"32{len(v32):02d}{v32}"

    # 52 Merchant Category Code (4829)
    field52 = '52044829'
    # 53 Currency (417)
    field53 = '5303417'
    # 54 Amount: сумма в тыйынах, паддинг до 5 символов
    amount_cents = int((Decimal(str(amount)) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    amount_str = str(amount_cents).rjust(5, '0')  # всегда 5 знаков
    field54 = f"54{len(amount_str):02d}{amount_str}"  # => 5405xxxxx
    # 59 DEMIRBANK
    field59 = '5909DEMIRBANK'

    payload_wo_63 = payload_format + point_of_initiation + field32 + field52 + field53 + field54 + field59
    # Контрольная сумма по SHA256-last-4
    cs = calculate_checksum(payload_wo_63, method='sha256')
    return payload_wo_63 + '6304' + cs

def generate_simple_qr(amount: float) -> str:
    """Простой генератор DemirBank QR: динамический (010212), корректный 32 как подTLV,
    контрольная сумма — по выбранному методу (по умолчанию SHA256-last-4), нижний регистр."""
    amount_cents = int((Decimal(str(amount)) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    # Паддируем до 5 символов (например 3500 -> 03500)
    amount_str = str(amount_cents).rjust(5, '0')
    amount_len_str = str(len(amount_str)).zfill(2)

    # Собираем корректный TLV 32 как вложенный набор тегов
    merchant_account_value = (
        "0015qr.demirbank.kg"
        "0108ib_andro"
        "10161180000353932089"
        "11092021113021"
        "120212"
        "130212"
        "28454d5b3ee5d47c7b61c0a0b07bb939a"
    )
    ma_len = str(len(merchant_account_value)).zfill(2)
    merchant_account = "32" + ma_len + merchant_account_value

    payload = (
        "000201"
        "010212"
        + merchant_account +
        "52044829"
        "5303417"
        f"54{amount_len_str}{amount_str}"
        "5909DEMIRBANK"
    )
    checksum = calculate_checksum(payload, method=CHECKSUM_METHOD)
    return payload + "6304" + checksum

def get_bank_links_by_type(qr_hash: str, bank_type: str) -> dict:
    """Возвращает набор ссылок для выбранного банка. Ничего не меняем в hash (включая тег 28)."""
    bank_type = (bank_type or '').upper()
    # На всякий случай уберем все пробелы/переводы строк из QR
    qr_hash = "".join(str(qr_hash).split())
    return {
        "DemirBank": f"https://retail.demirbank.kg/#{qr_hash}",
        "O! bank": f"https://api.dengi.o.kg/ru/qr/#{qr_hash}",
        "Компаньон": f"https://pay.payqr.kg/#{qr_hash}",
        "Balance.kg": f"https://balance.kg/#{qr_hash}",
        "Bakai": f"https://bakai24.app/#{qr_hash}",
        "MegaPay": f"https://megapay.kg/get#{qr_hash}",
        "MBank": f"https://app.mbank.kg/qr/#{qr_hash}"
    }

def create_payment_urls(qr_hash: str) -> dict:
    """Возвращает словарь быстрых ссылок для основных банков на основе переданного QR-хэша."""
    return {
        "DemirBank": f"https://retail.demirbank.kg/#{qr_hash}",
        "MegaPay": f"https://megapay.kg/get#{qr_hash}",
        "O! bank": f"https://api.dengi.o.kg/ru/qr/#{qr_hash}",
        "Компаньон": f"https://pay.payqr.kg/#{qr_hash}",
        "Balance.kg": f"https://balance.kg/#{qr_hash}",
        "Bakai": f"https://bakai24.app/#{qr_hash}",
        "MBank": f"https://app.mbank.kg/qr/#{qr_hash}",
    }

def build_qr_and_url(bank_code: str, *, amount: float, base_hash: str | None = None, requisite: str | None = None, static_qr: bool = True) -> dict:
    """
    Возвращает словарь { 'hash': <QR hash>, 'url': <app_url#hash> } для выбранного банка.

    Правила:
    - DEMIRBANK: если передан 16-значный requisite — собираем QR по шаблону `build_demirbank_qr_by_template()`.
      Иначе, если дан base_hash — обновляем только сумму (тег 54) и пересчитываем 63.
    - BAKAI / MBANK / OPTIMA: ожидаем `base_hash` из админки, меняем только 54 и 63.

    Контрольная сумма — тот же метод, что у исходного hash (detect_checksum_method), по умолчанию SHA256-last-4.
    Итоговая ссылка: <bank_app_url>#<hash>.
    """
    bank = (bank_code or '').strip().upper()
    if bank in ('DEMIR', 'DEMIRBANK'):
        if requisite and len(str(requisite)) == 16 and str(requisite).isdigit():
            qr = build_demirbank_qr_by_template(requisite=str(requisite), amount=amount, static_qr=static_qr)
        elif base_hash:
            qr = update_amount_in_qr_hash_proper(base_hash, amount)
        else:
            raise ValueError('Для DEMIRBANK укажи requisite (16 цифр) или base_hash')
        url = f"https://retail.demirbank.kg/#{qr}"
        return {'hash': qr, 'url': url}

    if bank in ('BAKAI', 'BAKAI24'):
        if not base_hash:
            raise ValueError('Для Bakai требуется base_hash из админки')
        qr = update_amount_in_qr_hash_proper(base_hash, amount)
        return {'hash': qr, 'url': f"https://bakai24.app/#{qr}"}

    if bank in ('MBANK',):
        if not base_hash:
            raise ValueError('Для MBank требуется base_hash из админки')
        qr = update_amount_in_qr_hash_proper(base_hash, amount)
        return {'hash': qr, 'url': f"https://app.mbank.kg/qr/#{qr}"}

    if bank in ('OPTIMA', 'OPTIMA BANK'):
        if not base_hash:
            raise ValueError('Для Optima требуется base_hash из админки')
        qr = update_amount_in_qr_hash_proper(base_hash, amount)
        # Уточни при необходимости домен/путь
        return {'hash': qr, 'url': f"https://optima.kg/qr/#{qr}"}

    # Фолбэк: возвращаем ссылки для известных, если есть
    if base_hash:
        qr = update_amount_in_qr_hash_proper(base_hash, amount)
        urls = get_bank_links_by_type(qr, bank)
        # Пытаемся взять точный ключ
        key_map = {
            'DEmirbank': 'DemirBank',
            'DEMirbank': 'DemirBank'
        }
        url = urls.get(key_map.get(bank, bank), next(iter(urls.values())))
        return {'hash': qr, 'url': url}
    raise ValueError(f'Неизвестный банк или отсутствуют данные для генерации: {bank_code}')

def enforce_amount_with_kopecks(amount: float) -> float:
    """Гарантировать, что сумма имеет копейки.
    Если пользователь ввёл целое значение, добавляем СЛУЧАЙНЫЕ копейки (1..99).
    Иначе оставляем исходные копейки. Округляем до 2 знаков (HALF_UP).
    """
    import random
    d = Decimal(str(amount))
    d = d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    # Проверяем наличие копеек
    if d == d.quantize(Decimal('1'), rounding=ROUND_HALF_UP):
        # Случайные копейки 1..99, чтобы суммы были уникальнее для авто-матчинга
        cents = random.randint(1, 99)
        d = (d + Decimal(cents) / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return float(d)





