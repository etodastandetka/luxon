# Инструкция по установке и запуску Email Watcher на сервере

## 1. Установка зависимостей

Перейдите в папку `admin_nextjs` и установите все зависимости:

```bash
cd /var/www/luxon/admin_nextjs
npm install
```

Это установит все необходимые библиотеки, включая:
- `imap` - для подключения к IMAP серверу
- `mailparser` - для парсинга email писем
- `tsx` - для запуска TypeScript файлов

## 2. Настройка базы данных

### Вариант 1: Использовать готовый SQL скрипт (рекомендуется)

Выполните SQL скрипт:

```bash
cd /var/www/luxon/admin_nextjs
psql -d default_db -f scripts/setup-watcher.sql
```

Или через `psql` напрямую:

```bash
psql -d default_db
```

Затем выполните содержимое файла `scripts/setup-watcher.sql`.

### Вариант 2: Использовать Prisma миграции

```bash
cd /var/www/luxon/admin_nextjs
npx prisma db push
```

Затем выполните SQL для вставки настроек:

```sql
INSERT INTO bot_settings (key, value, created_at, updated_at)
VALUES 
    ('autodeposit_enabled', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('autodeposit_imap', 'imap.timeweb.ru', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('autodeposit_folder', 'INBOX', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('autodeposit_bank', 'DEMIRBANK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('autodeposit_interval_sec', '60', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;
```

**Важно:** Email и пароль берутся из активного реквизита (`BotRequisite` с `isActive = true`).
Убедитесь, что в активном реквизите указаны:
- `email` - адрес почты
- `password` - пароль от почты

## 3. Проверка работы (одна проверка)

Перед постоянным запуском проверьте, что все работает:

```bash
cd /var/www/luxon/admin_nextjs
npm run watcher:check
```

Если все настроено правильно, вы увидите логи о проверке писем.

## 4. Запуск через PM2 (рекомендуется)

Для постоянной работы ватчера используйте PM2:

```bash
cd /var/www/luxon/admin_nextjs

# Запустить ватчер
pm2 start npm --name "luxon-email-watcher" -- run watcher

# Сохранить конфигурацию PM2
pm2 save

# Настроить автозапуск при перезагрузке сервера
pm2 startup
```

## 5. Управление ватчером

```bash
# Посмотреть статус
pm2 status

# Посмотреть логи
pm2 logs luxon-email-watcher

# Остановить
pm2 stop luxon-email-watcher

# Перезапустить
pm2 restart luxon-email-watcher

# Удалить из PM2
pm2 delete luxon-email-watcher
```

## 6. Проверка логов

```bash
# Логи в реальном времени
pm2 logs luxon-email-watcher --lines 100

# Только ошибки
pm2 logs luxon-email-watcher --err

# Только информация
pm2 logs luxon-email-watcher --out
```

## 7. Альтернативный способ (через ecosystem.config.js)

Создайте файл `ecosystem.config.js` в папке `admin_nextjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'luxon-email-watcher',
      script: 'npm',
      args: 'run watcher',
      cwd: '/var/www/luxon/admin_nextjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/watcher-error.log',
      out_file: './logs/watcher-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}
```

Запуск:
```bash
cd /var/www/luxon/admin_nextjs
pm2 start ecosystem.config.js
pm2 save
```

## 8. Проверка работы

После запуска проверьте логи:

```bash
pm2 logs luxon-email-watcher
```

Вы должны видеть сообщения типа:
- `✅ Watcher started successfully`
- `📧 Checking for new emails...`
- `✅ IncomingPayment saved: ID ...`
- `🔍 Found matching request: ...`

## Устранение проблем

### Ошибка "Cannot find module 'imap'"
```bash
cd /var/www/luxon/admin_nextjs
npm install imap mailparser tsx
```

### Ошибка подключения к IMAP
- Проверьте правильность email и пароля в активном реквизите
- Убедитесь, что IMAP включен для вашего почтового ящика
- Для Timeweb используйте: `imap.timeweb.ru:993` с SSL

### Watcher не обрабатывает письма
- Проверьте, что `autodeposit_enabled = '1'` в базе данных
- Убедитесь, что в почтовом ящике есть непрочитанные письма
- Проверьте логи на наличие ошибок

