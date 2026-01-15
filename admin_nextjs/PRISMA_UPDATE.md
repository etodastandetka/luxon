# Обновление Prisma после изменений схемы

После добавления новой модели в `schema.prisma` необходимо:

1. **Сгенерировать Prisma клиент:**
```bash
cd /var/www/luxon/admin_nextjs
npx prisma generate
```

2. **Применить миграцию (если нужно):**
```bash
npx prisma migrate deploy
# или для разработки:
npx prisma db push
```

3. **Перезапустить админку:**
```bash
pm2 restart luxon-admin
```

## Автоматический скрипт

Можно использовать готовый скрипт:
```bash
cd /var/www/luxon/admin_nextjs
bash scripts/generate-prisma.sh
```

