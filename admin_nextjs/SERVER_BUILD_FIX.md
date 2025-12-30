# Исправление ошибки сборки и базы данных на сервере

Если на сервере возникают ошибки:
1. **Ошибка сборки**: `Type error: Object literal may only specify known properties, and 'source' does not exist in type 'RequestCreateInput'`
2. **Ошибка в боте**: `The column requests.source does not exist in the current database`

## КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ (выполните в первую очередь!)

### Шаг 1: Добавить колонку в базу данных

```bash
# Подключитесь к базе данных PostgreSQL
psql -U your_user -d your_database

# Или используйте переменную окружения
psql $DATABASE_URL

# Выполните SQL миграцию
\i /var/www/luxon/admin_nextjs/prisma/migrations/add_source_column.sql

# Или выполните SQL напрямую:
ALTER TABLE requests ADD COLUMN IF NOT EXISTS source VARCHAR(20);
\q
```

### Шаг 2: Обновить код и пересобрать

```bash
# 1. Обновить код
cd /var/www/luxon
git pull origin main

# 2. Перегенерировать Prisma клиент
cd admin_nextjs
npx prisma generate

# 3. Пересобрать проект
npm run build

# 4. Перезапустить PM2
pm2 restart luxon-admin
```

## Альтернативный способ (используя Prisma db push)

Если у вас есть доступ к базе данных через Prisma:

```bash
cd /var/www/luxon/admin_nextjs
npx prisma db push
npx prisma generate
npm run build
pm2 restart luxon-admin
```

## Или используйте скрипт

```bash
cd /var/www/luxon
git pull origin main
cd admin_nextjs
chmod +x fix-build-server.sh
./fix-build-server.sh
```

## Причина ошибки

Prisma клиент на сервере не был обновлен после добавления поля `source` в схему базы данных. Команда `npx prisma generate` обновит типы TypeScript.

