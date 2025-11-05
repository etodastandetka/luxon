# Исправление ошибки Prisma Client на сервере

Если при сборке возникает ошибка:
```
Type error: Property 'cryptoPayment' does not exist on type 'PrismaClient'
```

Это означает, что Prisma Client не был регенерирован после изменений в схеме.

## Решение:

```bash
cd /var/www/luxon/admin_nextjs

# 1. Обновить код из репозитория
git pull origin main

# 2. Сгенерировать Prisma Client
npm run db:generate
# или
npx prisma generate

# 3. Пересобрать проект
npm run build
```

## Альтернатива (если npm run db:generate не работает):

```bash
cd /var/www/luxon/admin_nextjs
rm -rf node_modules/.prisma
npx prisma generate
npm run build
```

## Применение изменений схемы к базе данных:

После генерации клиента нужно применить изменения к БД:

```bash
npm run db:push
```

Или создать миграцию:

```bash
npm run db:migrate
```

