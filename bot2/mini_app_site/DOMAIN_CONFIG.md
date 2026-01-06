# Конфигурация доменов

Все домены настраиваются через переменные окружения в файле `.env.local` или `.env`.

## Переменные окружения

### Обязательные

- `NEXT_PUBLIC_ADMIN_API_URL` - URL админки API (для запросов к бэкенду)
  - По умолчанию: `https://pipiska.net` (production) или `http://localhost:3001` (development)

### Опциональные

- `NEXT_PUBLIC_CLIENT_URL` - URL клиентского сайта
  - По умолчанию: автоматически определяется из `window.location.origin` или `https://lux-on.org`

## Пример настройки

Создайте файл `.env.local` в директории `bot2/mini_app_site/`:

```env
# URL админки API
NEXT_PUBLIC_ADMIN_API_URL="https://pipiska.net"

# URL клиентского сайта (опционально)
NEXT_PUBLIC_CLIENT_URL="https://lux-on.org"
```

## Использование в коде

Все домены используются через централизованную конфигурацию в `config/domains.ts`:

```typescript
import { getAdminApiUrl, getClientUrl } from '@/config/domains'

const apiUrl = getAdminApiUrl() // https://pipiska.net
const clientUrl = getClientUrl() // https://lux-on.org
```

## Изменение доменов

1. Обновите переменные окружения в `.env.local` файле
2. Перезапустите приложение (`npm run dev` или пересоберите)
3. Домены автоматически применятся через конфигурацию

**Важно:** В Next.js переменные окружения с префиксом `NEXT_PUBLIC_` доступны в браузере, поэтому они должны быть публичными.

