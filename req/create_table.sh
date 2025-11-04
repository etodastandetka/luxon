#!/bin/bash
# Один скрипт - всё делает сам

PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db <<EOF

CREATE TABLE IF NOT EXISTS payment_notifications (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KGS',
    card_number VARCHAR(50),
    account_number VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_name ON payment_notifications(bank_name);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON payment_notifications(transaction_date DESC);

SELECT 'Таблица payment_notifications создана успешно!' as status;

EOF

echo ""
echo "✅ Готово! Таблица создана!"

