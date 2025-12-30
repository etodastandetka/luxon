# 🚨 БЫСТРОЕ ИСПРАВЛЕНИЕ ОШИБКИ БОТА

## Ошибка
```
The column requests.source does not exist in the current database
```

## Решение (выполните на сервере)

```bash
# 1. Добавить колонку в БД
psql $DATABASE_URL -c "ALTER TABLE requests ADD COLUMN IF NOT EXISTS source VARCHAR(20);"

# 2. Обновить код
cd /var/www/luxon
git pull origin main

# 3. Перегенерировать Prisma клиент
cd admin_nextjs
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

**ВАЖНО:** Сначала выполните SQL команду для добавления колонки, иначе бот будет продолжать падать с ошибкой!

