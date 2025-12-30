# 🚨 БЫСТРОЕ ИСПРАВЛЕНИЕ ОШИБКИ БОТА

## Ошибка
```
The column requests.source does not exist in the current database
```

## Решение через Prisma (выполните на сервере)

```bash
# 1. Обновить код
cd /var/www/luxon
git pull origin main

# 2. Применить миграцию Prisma
cd admin_nextjs
npx prisma migrate deploy

# Или если migrate deploy не работает, используйте db push:
# npx prisma db push

# 3. Перегенерировать Prisma клиент
npx prisma generate

# 4. Пересобрать
npm run build

# 5. Перезапустить
pm2 restart luxon-admin
```

Или используйте автоматический скрипт:
```bash
cd /var/www/luxon
git pull origin main
cd admin_nextjs
chmod +x fix-build-server.sh
./fix-build-server.sh
```

**ВАЖНО:** Миграция Prisma автоматически добавит колонку `source` в таблицу `requests`.

