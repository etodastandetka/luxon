# Конфигурация доменов

Все домены и URL настраиваются через переменные окружения в файле `.env`.

## Переменные окружения

### Обязательные

- `MINI_APP_URL` - URL клиентского сайта (мини-приложения)
  - По умолчанию: `https://lux-on.org`
  
- `ADMIN_PUBLIC_URL` или `NEXT_PUBLIC_API_URL` - Публичный URL админки
  - По умолчанию: `https://pipiska.net`

### Опциональные

- `ADMIN_INTERNAL_URL` или `INTERNAL_API_URL` - Внутренний URL админки (для межсервисных вызовов)
  - По умолчанию: `http://127.0.0.1:3001` (production) или `http://localhost:3001` (development)

## Пример настройки

Создайте файл `.env` в директории `admin_nextjs/`:

```env
# Клиентский сайт
MINI_APP_URL="https://lux-on.org"

# Админка (публичный URL)
ADMIN_PUBLIC_URL="https://pipiska.net"
NEXT_PUBLIC_API_URL="https://pipiska.net"

# Админка (внутренний URL)
ADMIN_INTERNAL_URL="http://127.0.0.1:3001"
INTERNAL_API_URL="http://127.0.0.1:3001"
```

## Использование в коде

Все домены используются через централизованную конфигурацию в `config/domains.ts`:

```typescript
import { getMiniAppUrl, getAdminPublicUrl, getAdminInternalUrl } from '@/config/domains'

const miniAppUrl = getMiniAppUrl() // https://lux-on.org
const adminUrl = getAdminPublicUrl() // https://pipiska.net
```

## Изменение доменов

1. Обновите переменные окружения в `.env` файле
2. Перезапустите приложение
3. Домены автоматически применятся через конфигурацию

