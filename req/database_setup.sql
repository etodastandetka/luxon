-- SQL скрипт для создания таблицы в PostgreSQL
-- База данных: postgresql://gen_user:dastan10dz@89.23.117.61:5432/default_db

-- Создание таблицы для хранения пополнений
CREATE TABLE IF NOT EXISTS payment_notifications (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KGS',
    card_number VARCHAR(50),
    account_number VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_bank_name ON payment_notifications(bank_name);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON payment_notifications(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_currency ON payment_notifications(currency);
CREATE INDEX IF NOT EXISTS idx_created_at ON payment_notifications(created_at DESC);

-- Комментарии к таблице
COMMENT ON TABLE payment_notifications IS 'Таблица для хранения данных о пополнениях из уведомлений банков';
COMMENT ON COLUMN payment_notifications.bank_name IS 'Название банка';
COMMENT ON COLUMN payment_notifications.package_name IS 'Package name приложения банка';
COMMENT ON COLUMN payment_notifications.amount IS 'Сумма пополнения';
COMMENT ON COLUMN payment_notifications.currency IS 'Валюта (KGS, USD, EUR, RUB)';
COMMENT ON COLUMN payment_notifications.card_number IS 'Номер карты (если указан)';
COMMENT ON COLUMN payment_notifications.account_number IS 'Номер счета (если указан)';
COMMENT ON COLUMN payment_notifications.transaction_date IS 'Дата транзакции из уведомления';
COMMENT ON COLUMN payment_notifications.raw_text IS 'Исходный текст уведомления';
COMMENT ON COLUMN payment_notifications.parsed_at IS 'Дата и время парсинга';
COMMENT ON COLUMN payment_notifications.created_at IS 'Дата создания записи в БД';

