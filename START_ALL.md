# Запуск всех сервисов LUXON

## Быстрый запуск:

```bash
cd /var/www/luxon
chmod +x START_ALL_SERVICES.sh
bash START_ALL_SERVICES.sh
```

## Или запустите вручную:

### 1. Клиентский сайт (порт 3030):

```bash
cd /var/www/luxon/app

# Если не собран - соберите
npm run build

# Запуск
pm2 start ecosystem.config.js
```

### 2. Админка (порт 3001):

```bash
cd /var/www/luxon/admin_nextjs

# Если не собрана - соберите
npm run build

# Запуск
pm2 start ecosystem.config.js
```

### 3. Бот:

```bash
cd /var/www/luxon/bot

# Активация виртуального окружения (если нужно)
source venv/bin/activate

# Запуск
pm2 start ecosystem.config.js
```

### 4. Сохранение конфигурации:

```bash
pm2 save
pm2 startup
```

## Проверка статуса:

```bash
pm2 status
```

Должны быть запущены:
- `luxon-mini-app` (клиентский сайт)
- `luxon-admin` (админка)
- `luxon-email-watcher` (email watcher)
- `luxon-bot` (основной бот)
- `operator_bot` (бот оператора)

## Логи:

```bash
# Все логи
pm2 logs

# Конкретный сервис
pm2 logs luxon-mini-app
pm2 logs luxon-admin
pm2 logs luxon-bot
```

## Перезапуск:

```bash
pm2 restart all
```

