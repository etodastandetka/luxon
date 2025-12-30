# Исправление ошибки сборки на сервере

Если на сервере возникает ошибка:
```
Type error: Object literal may only specify known properties, and 'source' does not exist in type 'RequestCreateInput'
```

## Быстрое исправление

Выполните на сервере в директории `/var/www/luxon/admin_nextjs`:

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

