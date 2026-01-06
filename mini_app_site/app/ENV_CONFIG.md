# Полная конфигурация через переменные окружения

Все настройки клиентского сайта можно изменить через переменные окружения в файле `.env.local`.

## Домены

```env
# URL админки API (для запросов к бэкенду)
NEXT_PUBLIC_ADMIN_API_URL="https://pipiska.net"

# URL клиентского сайта (опционально)
NEXT_PUBLIC_CLIENT_URL="https://lux-on.org"
```

## Сервер

```env
# Порт сервера
PORT=3000
CLIENT_PORT=3000

# Режим работы
NODE_ENV="production"

# Отладка
DEBUG="false"
```

## Депозиты

```env
# Таймаут депозита
DEPOSIT_TIMEOUT_SECONDS=300         # Время на оплату (5 минут)

# Минимальные и максимальные суммы
MIN_DEPOSIT_AMOUNT=35               # Минимальный депозит
MAX_DEPOSIT_AMOUNT=100000           # Максимальный депозит
```

## API

```env
# Таймауты и повторные попытки
API_TIMEOUT_MS=30000                # 30 секунд
API_RETRY_ATTEMPTS=3                # Количество попыток
API_RETRY_DELAY_MS=1000             # Задержка между попытками
```

## Файлы

```env
# Максимальный размер файла
MAX_FILE_SIZE_MB=10                 # 10 MB
MAX_FILE_SIZE_BYTES=10485760        # 10 MB в байтах

# Разрешенные типы файлов (через запятую)
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,image/webp"
```

## Таймеры

```env
# Интервал обновления данных
REFRESH_INTERVAL_MS=5000            # 5 секунд
```

## Пример полного .env.local файла

```env
# Домены
NEXT_PUBLIC_ADMIN_API_URL="https://pipiska.net"
NEXT_PUBLIC_CLIENT_URL="https://lux-on.org"

# Сервер
PORT=3000
NODE_ENV="production"

# Депозиты
DEPOSIT_TIMEOUT_SECONDS=300
MIN_DEPOSIT_AMOUNT=35
MAX_DEPOSIT_AMOUNT=100000

# API
API_TIMEOUT_MS=30000
API_RETRY_ATTEMPTS=3

# Файлы
MAX_FILE_SIZE_MB=10
```

## Использование

Все значения автоматически подхватываются из переменных окружения. Если переменная не задана, используются разумные значения по умолчанию.

**Важно:** В Next.js переменные окружения с префиксом `NEXT_PUBLIC_` доступны в браузере, поэтому они должны быть публичными.

Для изменения настроек:
1. Обновите `.env.local` файл
2. Перезапустите приложение (`npm run dev` или пересоберите)
3. Изменения применятся автоматически

