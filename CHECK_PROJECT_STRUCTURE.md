# Проверка структуры проектов на сервере

## Текущая структура

На сервере есть две основные папки:
- `/var/www/ls` - используется для админки
- `/var/www/luxon` - используется для мини-приложения и других проектов

## Проверка структуры

Выполните на сервере:

```bash
# Проверка админки
echo "=== АДМИНКА ==="
cd /var/www/ls/admin_nextjs
pwd
git remote -v
ls -la | head -10

# Проверка мини-приложения
echo ""
echo "=== МИНИ-ПРИЛОЖЕНИЕ ==="
cd /var/www/luxon/app/app
pwd
git remote -v
ls -la | head -10

# Проверка корневого репозитория
echo ""
echo "=== КОРНЕВОЙ РЕПОЗИТОРИЙ ==="
cd /var/www/luxon
pwd
git remote -v
ls -la | head -10
```

## Правильная структура

### Админка (Next.js):
- **Путь:** `/var/www/ls/admin_nextjs`
- **PM2:** `luxon-admin`
- **Порт:** 3001
- **Команда обновления:**
  ```bash
  cd /var/www/ls/admin_nextjs
  git pull
  npm run build
  pm2 restart luxon-admin
  ```

### Мини-приложение (Next.js):
- **Путь:** `/var/www/luxon/app/app`
- **PM2:** `luxon-mini-app`
- **Порт:** (проверить в ecosystem.config.js)
- **Команда обновления:**
  ```bash
  cd /var/www/luxon/app/app
  git pull
  npm run build
  pm2 restart luxon-mini-app
  ```

### Корневой репозиторий:
- **Путь:** `/var/www/luxon` (или `/var/www/ls`)
- **Содержит:** все проекты (admin_nextjs, app, bot, и т.д.)
- **Команда обновления:**
  ```bash
  cd /var/www/luxon  # или /var/www/ls
  git pull
  ```

## Проблема с разными путями

Если на сервере есть:
- `/var/www/ls/admin_nextjs` - админка
- `/var/www/luxon/app/app` - мини-приложение

Это означает, что:
1. Либо это один репозиторий с разными путями на сервере
2. Либо это разные репозитории

## Решение

### Вариант 1: Единый репозиторий (рекомендуется)

Если все проекты в одном репозитории, используйте корневой путь:

```bash
# Обновление всего репозитория
cd /var/www/luxon  # или /var/www/ls (проверить, где основной репозиторий)
git pull

# Затем обновляем каждый проект отдельно
cd admin_nextjs && npm run build && cd ..
cd app/app && npm run build && cd ..
```

### Вариант 2: Разные репозитории

Если это разные репозитории, обновляйте каждый отдельно:

```bash
# Админка
cd /var/www/ls/admin_nextjs
git pull
npm run build
pm2 restart luxon-admin

# Мини-приложение
cd /var/www/luxon/app/app
git pull
npm run build
pm2 restart luxon-mini-app
```

## Скрипт для автоматического обновления

Используйте `UPDATE_ALL.sh` из корня репозитория:

```bash
cd /var/www/luxon  # или /var/www/ls
chmod +x UPDATE_ALL.sh
./UPDATE_ALL.sh
```

