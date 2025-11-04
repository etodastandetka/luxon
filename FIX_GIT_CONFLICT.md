# Инструкция по разрешению конфликта Git на сервере

На сервере выполните следующие команды:

```bash
cd /var/www/luxon

# 1. Проверить статус и найти файлы с конфликтом
git status

# 2. Если конфликт в admin_nextjs/package-lock.json, примем нашу версию
git checkout --ours admin_nextjs/package-lock.json
git add admin_nextjs/package-lock.json

# 3. Или если нужно принять их версию:
# git checkout --theirs admin_nextjs/package-lock.json
# git add admin_nextjs/package-lock.json

# 4. Закончить слияние
git merge --continue

# 5. Или если merge не был начат, просто забросить изменения
# git reset --hard HEAD

# 6. Получить обновления
git pull

# 7. Перейти в директорию клиентского сайта
cd bot2/mini_app_site

# 8. Очистить кэш
rm -rf .next
rm -rf node_modules/.cache

# 9. Пересобрать проект
npm run build

# 10. Перезапустить приложение (если используется PM2)
pm2 restart luxon-mini-app
```

Альтернативный вариант (более простой) - сбросить все локальные изменения:

```bash
cd /var/www/luxon

# Сбросить все локальные изменения и получить версию с GitHub
git reset --hard origin/main
git pull

cd bot2/mini_app_site
rm -rf .next
rm -rf node_modules/.cache
npm run build

# Перезапустить приложение
pm2 restart luxon-mini-app
```

