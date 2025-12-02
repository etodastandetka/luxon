-- SQL скрипт для добавления индексов для ускорения запросов в /api/limits/stats
-- Выполните этот скрипт в вашей PostgreSQL базе данных

-- Индекс для быстрого поиска по типу заявки и статусу (для агрегации)
CREATE INDEX IF NOT EXISTS idx_requests_type_status ON requests(request_type, status);

-- Индекс для быстрого поиска по дате создания (для фильтрации по периоду)
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

-- Композитный индекс для запросов с фильтрацией по типу, статусу и дате (оптимизация для графика)
CREATE INDEX IF NOT EXISTS idx_requests_type_status_date ON requests(request_type, status, created_at DESC);

-- Индекс для поиска по bookmaker (для статистики по платформам)
-- Используем gin индекс для полнотекстового поиска или btree для ILIKE
CREATE INDEX IF NOT EXISTS idx_requests_bookmaker ON requests(bookmaker);

-- Композитный индекс для поиска по bookmaker с фильтрацией по типу и статусу
CREATE INDEX IF NOT EXISTS idx_requests_bookmaker_type_status ON requests(bookmaker, request_type, status);

-- Индекс для группировки по дате (для графика)
CREATE INDEX IF NOT EXISTS idx_requests_date_group ON requests(DATE(created_at), request_type, status);

-- Комментарии к индексам
COMMENT ON INDEX idx_requests_type_status IS 'Ускоряет агрегацию по типу заявки и статусу';
COMMENT ON INDEX idx_requests_created_at IS 'Ускоряет фильтрацию по дате создания';
COMMENT ON INDEX idx_requests_type_status_date IS 'Оптимизация для запросов графика с фильтрацией';
COMMENT ON INDEX idx_requests_bookmaker IS 'Ускоряет поиск по платформе (bookmaker)';
COMMENT ON INDEX idx_requests_bookmaker_type_status IS 'Ускоряет статистику по платформам';
COMMENT ON INDEX idx_requests_date_group IS 'Ускоряет группировку по дате для графика';

