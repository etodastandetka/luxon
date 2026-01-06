# Инструкция по настройке сервера LUXON

## Вариант 1: Копирование и выполнение скрипта на сервере (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Скопируйте скрипт на сервер

В PowerShell выполните:
```powershell
# Перейдите в папку проекта
cd C:\Users\User\Desktop\LUXON

# Скопируйте скрипт на сервер
scp setup_server_on_remote.sh root@147.45.99.111:/tmp/
```

При запросе пароля введите: `madSvQb*v*2rPU`

### Шаг 2: Подключитесь к серверу

```powershell
ssh root@147.45.99.111
```

Пароль: `madSvQb*v*2rPU`

### Шаг 3: Выполните скрипт на сервере

```bash
chmod +x /tmp/setup_server_on_remote.sh
bash /tmp/setup_server_on_remote.sh
```

## Вариант 2: Пошаговое выполнение команд

### Шаг 1: Подключитесь к серверу

```powershell
ssh root@147.45.99.111
```

Пароль: `madSvQb*v*2rPU`

### Шаг 2: Выполните команды на сервере

Скопируйте содержимое файла `setup_server_on_remote.sh` и выполните команды по очереди на сервере.

## После установки

### Настройка переменных окружения

1. **Клиентский сайт** (`/var/www/luxon/app/.env.local`):
```env
NEXT_PUBLIC_ADMIN_API_URL=https://pipiska.net
NEXT_PUBLIC_CLIENT_URL=https://lux-on.org
```

2. **Админка** (`/var/www/luxon/admin_nextjs/.env`):
```env
NODE_ENV=production
ADMIN_PUBLIC_URL=https://pipiska.net
MINI_APP_URL=https://lux-on.org
ADMIN_INTERNAL_URL=http://127.0.0.1:3001
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# ... другие переменные из ENV_CONFIG.md
```

3. **Бот** (`/var/www/luxon/bot/.env`):
```env
BOT_TOKEN=your_bot_token
# ... другие переменные
```

### Настройка DNS

Настройте A записи в DNS для доменов:
- `lux-on.org` -> `147.45.99.111`
- `www.lux-on.org` -> `147.45.99.111`
- `pipiska.net` -> `147.45.99.111`
- `www.pipiska.net` -> `147.45.99.111`

### Получение SSL сертификатов

После настройки DNS (подождите 5-10 минут для распространения):

```bash
# Для lux-on.org
certbot --nginx -d lux-on.org -d www.lux-on.org --non-interactive --agree-tos --email admin@lux-on.org --redirect

# Для pipiska.net
certbot --nginx -d pipiska.net -d www.pipiska.net --non-interactive --agree-tos --email admin@pipiska.net --redirect
```

### Проверка статуса

```bash
# Статус PM2 процессов
pm2 status

# Статус nginx
systemctl status nginx

# Логи
pm2 logs
tail -f /var/log/nginx/error.log
```

### Перезапуск сервисов

```bash
# Перезапуск PM2
pm2 restart all

# Перезапуск nginx
systemctl restart nginx
```

## Устранение проблем

### Если порты заняты:
```bash
# Проверка портов
netstat -tulpn | grep -E '3001|3030'

# Остановка процессов
pm2 stop all
```

### Если nginx не запускается:
```bash
# Проверка конфигурации
nginx -t

# Просмотр ошибок
tail -f /var/log/nginx/error.log
```

### Если сборка не работает:
```bash
# Очистка кеша
cd /var/www/luxon/app
rm -rf .next node_modules
npm install
npm run build
```

