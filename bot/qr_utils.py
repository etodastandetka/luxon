from typing import Optional
import os

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
    import hashlib
    
    # Сумма как целое число тыйынов (200.77 -> 20077) через Decimal (чтобы не ловить ошибки float),
    # паддируем до 5 символов (например 100.53 -> 10053 -> '10053', 10.05 -> 1005 -> '01005')
    from decimal import Decimal, ROUND_HALF_UP
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


# ===== Дополнительные утилиты, используемые в хендлерах =====

def get_wallet_qr_hash_from_db():
    """Возвращает активный кошелёк из admin_bot.db: {id,name,qr_hash,bank_code,recipient_name,amount} или None"""
    try:
        import sqlite3
        conn = sqlite3.connect('admin_bot.db')
        cursor = conn.cursor()
        cursor.execute('''
        SELECT id, name, qr_hash, bank_code, recipient_name, amount
        FROM wallets 
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
        ''')
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                'id': row[0],
                'name': row[1],
                'qr_hash': row[2],
                'bank_code': row[3],
                'recipient_name': row[4],
                'amount': row[5]
            }
        # Фолбэк: используем предоставленный базовый QR, если активного кошелька нет
        return {
            'id': None,
            'name': 'Default DemirBank',
            'qr_hash': BASE_QR_HASH,
            'bank_code': 'DEMIRBANK',
            'recipient_name': 'DEMIRBANK',
            'amount': None
        }
    except Exception:
        # На любой ошибке также возвращаем фолбэк
        return {
            'id': None,
            'name': 'Default DemirBank',
            'qr_hash': BASE_QR_HASH,
            'bank_code': 'DEMIRBANK',
            'recipient_name': 'DEMIRBANK',
            'amount': None
        }

def build_payment_links(amount: float):
    """Высокоуровневый хелпер: возвращает (qr_hash, bank_links) по фиксированному шаблону.
    - Берёт активный реквизит из БД (16 цифр)
    - Гарантирует сумму с копейками
    - Строит QR по build_demirbank_qr_by_template
    - Возвращает словарь ссылок get_bank_links_by_type
    """
    req = get_active_requisite_from_db()
    if not req:
        raise RuntimeError("Active requisite not configured")
    amt = enforce_amount_with_kopecks(float(amount))
    qr = build_demirbank_qr_by_template(requisite=req, amount=amt, static_qr=True)
    links = get_bank_links_by_type(qr, 'DEMIRBANK')
    return qr, links


# ===== Хранение реквизитов в bot/universal_bot.db =====
def _bot_db_path() -> str:
    """Единый путь к универсальной БД бота (root).
    1) BOT_DATABASE_PATH из окружения
    2) <project_root>/universal_bot.db (где project_root — родитель каталога bot)
    """
    # 1) ENV override
    p = os.getenv('BOT_DATABASE_PATH')
    if p:
        return p
    # 2) project-root fallback
    try:
        from pathlib import Path
        project_root = Path(__file__).resolve().parents[1]
        return str(project_root / 'universal_bot.db')
    except Exception:
        # последний шанс: relative рядом с bot/
        return 'universal_bot.db'

def ensure_requisites_table():
    import sqlite3
    conn = sqlite3.connect(_bot_db_path())
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS requisites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0,
            name TEXT,
            email TEXT,
            password TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Уникальный активный
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_requisites_active ON requisites (is_active) WHERE is_active = 1')
    # Добавим недостающие колонки при обновлении
    try:
        cur.execute('PRAGMA table_info(requisites)')
        cols = {row[1] for row in cur.fetchall()}
        if 'name' not in cols:
            cur.execute('ALTER TABLE requisites ADD COLUMN name TEXT')
        if 'email' not in cols:
            cur.execute('ALTER TABLE requisites ADD COLUMN email TEXT')
        if 'password' not in cols:
            cur.execute('ALTER TABLE requisites ADD COLUMN password TEXT')
    except Exception:
        pass
    conn.commit()
    conn.close()

def get_active_requisite_from_db() -> Optional[str]:
    """Возвращает активный реквизит (строка) из таблицы requisites в bot/universal_bot.db."""
    try:
        ensure_requisites_table()
        import sqlite3
        conn = sqlite3.connect(_bot_db_path())
        cur = conn.cursor()
        cur.execute('SELECT value FROM requisites WHERE is_active = 1 LIMIT 1')
        row = cur.fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None

def set_active_requisite_to_db(value: str) -> bool:
    """Ставит переданный реквизит активным (создаёт запись при необходимости)."""
    try:
        ensure_requisites_table()
        import sqlite3
        conn = sqlite3.connect(_bot_db_path())
        cur = conn.cursor()
        # Снять активность со всех
        cur.execute('UPDATE requisites SET is_active = 0 WHERE is_active = 1')
        # Найти существующий
        cur.execute('SELECT id FROM requisites WHERE value = ? LIMIT 1', (value,))
        row = cur.fetchone()
        if row:
            cur.execute('UPDATE requisites SET is_active = 1 WHERE id = ?', (row[0],))
        else:
            cur.execute('INSERT INTO requisites (value, is_active) VALUES (?, 1)', (value,))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


# ===== Построение QR по шаблону DemirBank (как вы описали) =====
def build_demirbank_qr_by_template(*, requisite: str, amount: float, static_qr: bool = True) -> str:
    """Строит QR строго по вашему шаблону.
    ВАЖНО: параметр requisite — это ПОЛНОЕ значение для под‑тега 10 длиной 16 символов (только цифры).
    Никаких префиксов мы не добавляем — вставляем как есть (tag 10 length=16).
    Сумма (тег 54) — 5 цифр (тыйыны) с паддингом, длина всегда '05'.
    Контрольная сумма: SHA256-last-4 (нижний регистр), добавляется как 6304xxxx.
    """
    from decimal import Decimal, ROUND_HALF_UP

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


# ===== Работа с реквизитом в под‑теге 10 внутри поля 32 =====
def _strip_checksum(full_qr: str) -> str:
    """Убирает завершающее поле 63 (6304XXXX) из QR-строки, если оно есть."""
    import re
    s = re.sub(r"6304[0-9A-Fa-f]{4}$", "", str(full_qr).strip())
    s = re.sub(r"63[0-9A-Fa-f]{4}$", "", s)
    return s

def _find_field32_range(payload_wo_63: str):
    """Возвращает (start_index, end_index, value_start, value_end) для поля 32 в TLV-строке без 63.
    Если не найдено — None.
    """
    import re
    m = re.search(r"32(\d{2})", payload_wo_63)
    if not m:
        return None
    idx = m.start()
    ll = int(m.group(1))
    v_start = idx + 4
    v_end = v_start + ll
    if v_end > len(payload_wo_63):
        return None
    return (idx, v_end, v_start, v_end)

def get_requisite_from_qr(qr_hash: str) -> Optional[str]:
    """Достаёт реквизит из под‑тега 10 внутри поля 32.
    Возвращает строку или None, если не найдено.
    """
    try:
        import re
        payload = _strip_checksum(qr_hash)
        pos = _find_field32_range(payload)
        if not pos:
            return None
        _, _, v_start, v_end = pos
        v32 = payload[v_start:v_end]
        # Ищем под‑тег 10
        m10 = re.search(r"10(\d{2})([0-9A-Za-z]+)", v32)
        if not m10:
            return None
        ll = int(m10.group(1))
        val = m10.group(2)
        # Ограничиваемся реальной длиной
        val = val[:ll]
        return val
    except Exception:
        return None

def set_requisite_in_qr(qr_hash: str, new_requisite: str) -> str:
    """Заменяет (или добавляет) значение под‑тега 10 внутри поля 32 и пересчитывает длину 32 и контрольную сумму.
    Требования к реквизиту (рекомендуемые): начинается на '11', заканчивается на '89', длина 14 цифр.
    Эти требования не навязываются жёстко — выполняется вставка как есть.
    """
    import re
    payload = _strip_checksum(qr_hash)
    loc = _find_field32_range(payload)
    if not loc:
        # Если поля 32 нет, ничего не делаем
        return qr_hash
    idx32_start, idx32_end, v_start, v_end = loc
    v32 = payload[v_start:v_end]

    # Меняем/вставляем под‑тег 10
    m10 = re.search(r"10(\d{2})([0-9A-Za-z]+)", v32)
    repl_val = new_requisite
    new10 = f"10{len(repl_val):02d}{repl_val}"
    if m10:
        # Заменяем существующее значение
        old_ll = int(m10.group(1))
        old_val = m10.group(2)[:old_ll]
        start10 = m10.start()
        end10 = start10 + 4 + old_ll
        v32_new = v32[:start10] + new10 + v32[end10:]
    else:
        # Вставляем сразу после первых под‑тегов (после 00/01, если они есть)
        # Попробуем найти место после домена '0015qr.demirbank.kg'
        ins_pos = 0
        m00 = re.search(r"00(\d{2})", v32)
        if m00:
            l0 = int(m00.group(1))
            ins_pos = m00.start() + 4 + l0
        m01 = re.search(r"01(\d{2})", v32)
        if m01 and (m01.start() + 4 + int(m01.group(1))) > ins_pos:
            ins_pos = m01.start() + 4 + int(m01.group(1))
        v32_new = v32[:ins_pos] + new10 + v32[ins_pos:]

    # Пересчитываем длину поля 32
    new_len = len(v32_new)
    if new_len > 99:
        # Невалидно для TLV; вернём исходное
        return qr_hash
    payload_new = payload[:idx32_start] + f"32{new_len:02d}" + v32_new + payload[idx32_end:]

    # Пересчитать checksum тем же методом, что и у исходного QR
    method = detect_checksum_method(qr_hash)
    cs = calculate_checksum(payload_new, method=method)
    return payload_new + "6304" + cs

def update_qr_amount_and_requisite(qr_hash: str, *, amount: Optional[float] = None, requisite: Optional[str] = None) -> str:
    """Комбинированное обновление: сумма (тег 54) и реквизит (под‑тег 10 в 32) с пересчётом длины 32 и контрольной суммы.
    Любой из параметров может быть None — тогда он не изменяется.
    """
    updated = qr_hash
    if requisite is not None:
        updated = set_requisite_in_qr(updated, requisite)
    if amount is not None:
        updated = update_amount_in_qr_hash_proper(updated, amount)
    return updated


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
    import hashlib
    h = hashlib.sha256(payload_without_63.encode('utf-8')).hexdigest()
    return h[-4:].lower()

def _calculate_sha256_last4_plus_63(payload_without_63: str) -> str:
    import hashlib
    h = hashlib.sha256((payload_without_63 + '63').encode('utf-8')).hexdigest()
    return h[-4:].lower()

def _calculate_sha256_last4_plus_6304(payload_without_63: str) -> str:
    import hashlib
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
    import re

    try:
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

        from decimal import Decimal, ROUND_HALF_UP
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


def enforce_amount_with_kopecks(amount: float) -> float:
    """Гарантировать, что сумма имеет копейки.
    Если пользователь ввёл целое значение, добавляем СЛУЧАЙНЫЕ копейки (1..99).
    Иначе оставляем исходные копейки. Округляем до 2 знаков (HALF_UP).
    """
    from decimal import Decimal, ROUND_HALF_UP
    import random
    d = Decimal(str(amount))
    d = d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    # Проверяем наличие копеек
    if d == d.quantize(Decimal('1'), rounding=ROUND_HALF_UP):
        # Случайные копейки 1..99, чтобы суммы были уникальнее для авто-матчинга
        cents = random.randint(1, 99)
        d = (d + Decimal(cents) / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return float(d)


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


def generate_simple_qr(amount: float) -> str:
    """Простой генератор DemirBank QR: динамический (010212), корректный 32 как подTLV,
    контрольная сумма — по выбранному методу (по умолчанию SHA256-last-4), нижний регистр."""
    import hashlib
    from decimal import Decimal, ROUND_HALF_UP
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


# ===== Нормализация произвольного QR-хэша =====
def normalize_qr_hash(base_qr: str, *, force_static: bool = FORCE_STATIC_QR_TYPE, remove_tag_28: bool = True) -> str:
    """Приводит произвольный QR-хэш к валидной форме: опционально делает 010211, удаляет под-тег 28 в 32, пересчитывает 32 LL и 63.
    Ничего лишнего не меняет.
    """
    import re

    # 1) Снять 63
    payload = re.sub(r"6304[0-9A-Fa-f]{4}$", "", base_qr)
    payload = re.sub(r"63[0-9A-Fa-f]{4}$", "", payload)

    # 2) Тип 01
    if force_static:
        payload = re.sub(r"010212", "010211", payload, count=1)

    # 3) Очистка 28 внутри 32 + пересчёт LL
    if remove_tag_28:
        m32 = re.search(r"32(\\d{2})", payload)
        if m32:
            try:
                idx = m32.start()
                val_len = int(m32.group(1))
                val_start = idx + 4
                val_end = val_start + val_len
                if val_end <= len(payload):
                    v32 = payload[val_start:val_end]
                    cleaned = re.sub(r"28\\d{2}[0-9A-Za-z]+", "", v32)
                    if cleaned != v32:
                        ll = f"{len(cleaned):02d}"
                        payload = payload[:idx] + "32" + ll + cleaned + payload[val_end:]
            except Exception:
                pass

    # 4) Пересчитать checksum
    cs = _recalculate_sha256_last4(payload)
    return payload + "6304" + cs


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

