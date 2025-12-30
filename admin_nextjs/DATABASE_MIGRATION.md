# Миграция базы данных: Добавление колонки source

## Проблема

Ошибка в боте: `The column requests.source does not exist in the current database`

## Решение через Prisma (рекомендуется)

### Способ 1: Prisma Migrate (для продакшена)

```bash
cd /var/www/luxon/admin_nextjs
npx prisma migrate deploy
```

Это применит все непримененные миграции из папки `prisma/migrations/`.

### Способ 2: Prisma db push (быстрый способ)

```bash
cd /var/www/luxon/admin_nextjs
npx prisma db push
```

Это автоматически синхронизирует схему Prisma с базой данных без создания файлов миграций.

### Способ 3: Через psql (если Prisma не работает)

```bash
# Подключитесь к базе данных
psql $DATABASE_URL

# Выполните SQL команду
ALTER TABLE requests ADD COLUMN IF NOT EXISTS source VARCHAR(20);

# Выйдите из psql
\q
```

## Способ 3: Прямой SQL запрос

Если у вас есть доступ к базе данных через другой инструмент, выполните:

```sql
ALTER TABLE requests ADD COLUMN IF NOT EXISTS source VARCHAR(20);
```

## После миграции

1. Перегенерируйте Prisma клиент:
```bash
npx prisma generate
```

2. Пересоберите проект:
```bash
npm run build
```

3. Перезапустите PM2:
```bash
pm2 restart luxon-admin
```

## Проверка

Проверьте, что колонка добавлена:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'requests' AND column_name = 'source';
```

Должна вернуться одна строка с информацией о колонке.

