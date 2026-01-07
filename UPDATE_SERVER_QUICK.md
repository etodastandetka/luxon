# Быстрое обновление клиентского приложения на сервере

## Проблема
При выполнении `git pull` на сервере возникает ошибка:
```
error: The following untracked working tree files would be overwritten by merge:
app/app/api/auth/telegram/route.ts
app/app/api/bot-settings/route.ts
...
```

Это происходит потому, что на сервере есть неотслеживаемые файлы в `app/app/`, которые конфликтуют с новыми изменениями из git.

## Решение

### Вариант 1: Использовать скрипт (рекомендуется)

```bash
cd /var/www/luxon
chmod +x UPDATE_SERVER_APP.sh
./UPDATE_SERVER_APP.sh
```

### Вариант 2: Выполнить команды вручную

```bash
cd /var/www/luxon/app

# Удалить неотслеживаемые файлы в app/app/
rm -rf app/app

# Обновить код из git
git fetch origin
git reset --hard origin/main

# Очистить кэш и пересобрать
rm -rf .next
npm install
npm run build

# Перезапустить приложение
pm2 restart ecosystem.config.js
```

### Вариант 3: Безопасное удаление через git

```bash
cd /var/www/luxon/app

# Посмотреть какие файлы будут удалены
git clean -n -d app/

# Удалить неотслеживаемые файлы
git clean -fd app/

# Обновить код
git pull origin main

# Пересобрать
rm -rf .next
npm install
npm run build
pm2 restart ecosystem.config.js
```

## После обновления

1. Проверьте статус PM2:
   ```bash
   pm2 status
   pm2 logs
   ```

2. Проверьте работу сайта в браузере

3. Если есть ошибки, проверьте логи:
   ```bash
   pm2 logs app
   tail -f /var/log/nginx/error.log
   ```

