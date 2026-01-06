# Полная конфигурация через переменные окружения

Все настройки приложения можно изменить через переменные окружения в файле `.env`.

## Домены и URL

```env
# URL клиентского сайта (мини-приложения)
MINI_APP_URL="https://lux-on.org"

# URL админки (публичный)
ADMIN_PUBLIC_URL="https://pipiska.net"
NEXT_PUBLIC_API_URL="https://pipiska.net"

# URL админки (внутренний, для межсервисных вызовов)
ADMIN_INTERNAL_URL="http://127.0.0.1:3001"
INTERNAL_API_URL="http://127.0.0.1:3001"
```

## Сервер

```env
# Порт сервера
PORT=3001
ADMIN_PORT=3001

# Режим работы
NODE_ENV="production"

# Отладка
DEBUG="false"
```

## Безопасность и Rate Limiting

```env
# Rate limiting
RATE_LIMIT_WINDOW_MS=60000          # Окно времени (1 минута)
RATE_LIMIT_MAX_REQUESTS=60          # Максимум запросов
RATE_LIMIT_BLOCK_DURATION_MS=86400000  # Время блокировки (24 часа)
RATE_LIMIT_CLEANUP_INTERVAL_MS=300000  # Интервал очистки (5 минут)

# Размеры запросов
MAX_REQUEST_SIZE_MB=5               # Максимальный размер запроса (MB)
MAX_PARAM_LENGTH=1000               # Максимальная длина параметра
```

## База данных

```env
# Лимиты запросов
DEFAULT_PAGE_SIZE=10                # Размер страницы по умолчанию
MAX_PAGE_SIZE=100                   # Максимальный размер страницы
CHAT_MESSAGES_LIMIT=50              # Лимит сообщений в чате
TRANSACTION_HISTORY_LIMIT=50        # Лимит истории транзакций
```

## Автопополнение

```env
# Окно поиска заявок (в миллисекундах)
AUTO_DEPOSIT_SEARCH_WINDOW_MS=300000  # 5 минут

# Задержка уведомления о депозите
DELAYED_NOTIFICATION_MS=60000       # 1 минута

# Таймаут проверки автопополнения
AUTO_DEPOSIT_CHECK_TIMEOUT_MS=300000  # 5 минут
```

## Депозиты

```env
# Минимальные и максимальные суммы
MIN_DEPOSIT_AMOUNT=35               # Минимальный депозит (сом)
MIN_DEPOSIT_AMOUNT_1WIN=100         # Минимальный депозит для 1win (сом)
MAX_DEPOSIT_AMOUNT=100000           # Максимальный депозит (сом)

# Таймаут депозита
DEPOSIT_TIMEOUT_SECONDS=300         # Время на оплату (5 минут)
```

## Чат

```env
# Интервал обновления чата
CHAT_REFRESH_INTERVAL_MS=3000       # 3 секунды

# Лимит сообщений
CHAT_MESSAGES_LIMIT=50
```

## Файлы

```env
# Максимальный размер файла
MAX_FILE_SIZE_MB=10                 # 10 MB
MAX_FILE_SIZE_BYTES=10485760        # 10 MB в байтах

# Разрешенные типы файлов (через запятую)
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,image/webp,video/mp4"
```

## Реферальная система

```env
# Лимиты
TOP_PLAYERS_LIMIT=10                # Лимит топ игроков
LEADERBOARD_LIMIT=100               # Лимит лидерборда
```

## Таймеры и интервалы

```env
# Интервалы обновления
DASHBOARD_REFRESH_INTERVAL_MS=5000  # 5 секунд
REQUESTS_CHECK_INTERVAL_MS=3000     # 3 секунды
REFRESH_INTERVAL_MS=5000            # 5 секунд
```

## API

```env
# Таймауты и повторные попытки
EXTERNAL_API_TIMEOUT_MS=30000       # 30 секунд
API_RETRY_ATTEMPTS=3                # Количество попыток
API_RETRY_DELAY_MS=1000             # Задержка между попытками (1 секунда)
```

## База данных

```env
DATABASE_URL="postgresql://user:password@localhost:5432/luxon_admin?schema=public"
```

## Telegram Bot

```env
BOT_TOKEN="your-telegram-bot-token"
```

## JWT

```env
JWT_SECRET="your-secret-key-change-in-production"
```

## Пример полного .env файла

```env
# Домены
MINI_APP_URL="https://lux-on.org"
ADMIN_PUBLIC_URL="https://pipiska.net"
NEXT_PUBLIC_API_URL="https://pipiska.net"
ADMIN_INTERNAL_URL="http://127.0.0.1:3001"

# Сервер
PORT=3001
NODE_ENV="production"

# Безопасность
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000
MAX_REQUEST_SIZE_MB=5

# Депозиты
MIN_DEPOSIT_AMOUNT=35
MIN_DEPOSIT_AMOUNT_1WIN=100
MAX_DEPOSIT_AMOUNT=100000
DEPOSIT_TIMEOUT_SECONDS=300

# Автопополнение
AUTO_DEPOSIT_SEARCH_WINDOW_MS=300000
DELAYED_NOTIFICATION_MS=60000

# Чат
CHAT_REFRESH_INTERVAL_MS=3000
CHAT_MESSAGES_LIMIT=50

# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/luxon_admin"
BOT_TOKEN="your-bot-token"
JWT_SECRET="your-secret-key"
```

## Использование

Все значения автоматически подхватываются из переменных окружения. Если переменная не задана, используются разумные значения по умолчанию.

Для изменения настроек:
1. Обновите `.env` файл
2. Перезапустите приложение
3. Изменения применятся автоматически

