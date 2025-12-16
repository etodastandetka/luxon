# Решение конфликта git с rebuild-server.sh

## Проблема
При выполнении `git pull origin main` возникает ошибка:
```
error: Your local changes to the following files would be overwritten by merge:
admin_nextjs/rebuild-server.sh
Please commit your changes or stash them before you merge.
```

## Решение

### Вариант 1: Сохранить локальные изменения (если они важны)
```bash
cd /var/www/luxon/admin_nextjs
git stash
git pull origin main
git stash pop  # Применить сохраненные изменения обратно
```

### Вариант 2: Отбросить локальные изменения (рекомендуется)
```bash
cd /var/www/luxon/admin_nextjs
git reset --hard HEAD
git pull origin main
```

### Вариант 3: Использовать обновленный скрипт (автоматически)
Обновленный скрипт `rebuild-server.sh` теперь автоматически обрабатывает конфликты:
```bash
cd /var/www/luxon/admin_nextjs
chmod +x rebuild-server.sh
./rebuild-server.sh
```

## После решения конфликта

1. Убедитесь, что файлы обновились:
```bash
git log --oneline -3
cat next.config.js | grep -A 5 "webpack"
```

2. Очистите все кеши:
```bash
rm -rf .next node_modules/.cache tsconfig.tsbuildinfo .swc .turbo
```

3. Пересоберите проект:
```bash
npm run build
```

4. Перезапустите PM2:
```bash
pm2 restart luxon-admin
```

