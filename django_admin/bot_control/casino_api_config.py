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
        'hash': 'f788cc308d9de930b292873b2cf79526da363cb24a85883575426cc7f3c4553d',
        'cashierpass': '3nKS3!b7',
        'login': 'burgoevk',
        'cashdeskid': 1415842
    }
}

# ===== Mostbet Cash API =====
MOSTBET_CONFIG = {
    'api_key': 'api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d',
    'secret': 'Kana312',
    'cashpoint_id': '131864'  # Пробуем числовой cashpoint_id без буквы
}

# ===== 1WIN API =====
ONEWIN_CONFIG = {
    'api_key': 'f69190bced227b4d2ee16f614c64f777d1414435570efb430a6008242da0244c',
    'login': 'burgoev06@gmail.com',
    'password': 'Pp^w4w#X4D',
    'cashdesk_id': 6572
}
