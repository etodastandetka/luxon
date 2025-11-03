"""
Конфигурация API казино
Данные берутся из bot/config.py
"""

# ===== Cashdesk API (1xbet и melbet) =====
CASHDESK_CONFIG = {
    '1xbet': {
        'hash': 'f7ff9a23821a0dd19276392f80d43fd2e481986bebb7418fef11e03bba038101',
        'cashierpass': 'i3EBqvV1hB',
        'login': 'kurbanaevb',
        'cashdeskid': 1343871
    },
    'melbet': {
        'hash': '5c6459e67bde6c8ace972e2a4d7e1f83d05e2b68c0741474b0fa57e46a19bda1',
        'cashierpass': 'ScgOQgUzZs',
        'login': 'bakhtark',
        'cashdeskid': 1350588
    }
}

# ===== Mostbet Cash API =====
MOSTBET_CONFIG = {
    'api_key': 'api-key:0522f4fb-0a18-4ec2-8e27-428643602db4',
    'secret': 'Eldiyar.07',
    'cashpoint_id': 'C92905'
}

# ===== 1WIN API =====
ONEWIN_CONFIG = {
    'api_key': '0ad11eda9f40c2e05c34dc81c24ebe7f53eabe606c6cc5e553cfe66cd7fa9c8e'
}
