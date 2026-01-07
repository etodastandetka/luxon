# ✅ ПРАВИЛЬНЫЕ ПУТИ НА СЕРВЕРЕ

## Согласно конфигурации PM2 (ecosystem.config.js):

### Админка (Next.js):
- **Путь:** `/var/www/luxon/admin_nextjs`
- **PM2 процесс:** `luxon-admin`
- **Порт:** 3001
- **Команда обновления:**
  ```bash
  cd /var/www/luxon/admin_nextjs
  git pull
  npm install
  npm run db:generate
  npm run build
  pm2 restart luxon-admin
  ```

### Мини-приложение (Next.js):
- **Путь:** `/var/www/luxon/app` ⚠️ **НЕ `/var/www/luxon/app/app`!**
- **PM2 процесс:** `luxon-mini-app`
- **Порт:** 3030
- **Команда обновления:**
  ```bash
  cd /var/www/luxon/app
  git pull
  npm install
  npm run build
  pm2 restart luxon-mini-app
  ```

### Бот (Python):
- **Путь:** `/var/www/luxon/bot`
- **PM2 процессы:** `luxon-bot`, `operator_bot`
- **Команда обновления:**
  ```bash
  cd /var/www/luxon/bot
  git pull
  pip install -r requirements.txt
  pm2 restart luxon-bot operator_bot
  ```

### Email Watcher:
- **Путь:** `/var/www/luxon/admin_nextjs`
- **PM2 процесс:** `luxon-email-watcher`
- **Команда обновления:**
  ```bash
  cd /var/www/luxon/admin_nextjs
  git pull
  npm install
  pm2 restart luxon-email-watcher
  ```

## Корневой репозиторий:
- **Путь:** `/var/www/luxon`
- **Содержит:** все проекты (admin_nextjs, app, bot, и т.д.)

## ❌ НЕПРАВИЛЬНЫЕ ПУТИ (которые были в старых скриптах):
- ❌ `/var/www/ls/admin_nextjs` → ✅ `/var/www/luxon/admin_nextjs`
- ❌ `/var/www/luxon/app/app` → ✅ `/var/www/luxon/app`

## Проверка правильности путей:

```bash
# Проверить конфигурацию PM2
pm2 show luxon-admin | grep cwd
pm2 show luxon-mini-app | grep cwd
pm2 show luxon-bot | grep cwd

# Должно показать:
# cwd: /var/www/luxon/admin_nextjs
# cwd: /var/www/luxon/app
# cwd: /var/www/luxon/bot
```

