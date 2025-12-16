# 🚀 Правильное развертывание в продакшене

## ⚠️ Важно: НЕ используйте `npm start` в продакшене!

Для Next.js в продакшене нужно:
1. **Собрать** проект: `npm run build`
2. **Запустить production сервер**: `next start` (НЕ `npm start`!)

## ✅ Правильный процесс развертывания

### 1. Сборка проекта

```bash
# Админка
cd /var/www/luxon/admin_nextjs
npm install
npm run build

# Клиентский сайт
cd /var/www/luxon/bot2/mini_app_site
npm install
npm run build
```

### 2. Запуск через PM2 (правильный способ)

PM2 должен запускать **напрямую `next start`**, а не через npm:

```bash
# Админка
cd /var/www/luxon/admin_nextjs
pm2 start ecosystem.config.js

# Клиентский сайт
cd /var/www/luxon/bot2/mini_app_site
pm2 start ecosystem.config.js
```

### 3. Конфигурация PM2

**Правильная конфигурация** (уже в `ecosystem.config.js`):

```javascript
{
  name: 'luxon-admin',
  script: 'node_modules/.bin/next',  // ✅ Прямой запуск next
  args: 'start -p 3001',              // ✅ Production режим
  env: {
    NODE_ENV: 'production'           // ✅ Production окружение
  }
}
```

**Неправильная конфигурация** (НЕ используйте):

```javascript
{
  script: 'npm',                      // ❌ Через npm
  args: 'start',                      // ❌ Может запустить dev сервер
}
```

## 🔍 Проверка, что запущен production сервер

```bash
# Проверить процессы
pm2 list

# Проверить логи
pm2 logs luxon-admin

# Должно быть видно:
# "Ready on http://127.0.0.1:3001" (production)
# НЕ должно быть: "compiled successfully" (это dev режим)
```

## 📋 Разница между режимами

| Режим | Команда | Когда использовать |
|-------|---------|-------------------|
| **Development** | `npm run dev` или `next dev` | Локальная разработка |
| **Production** | `next start` (после `next build`) | Продакшен сервер |

## 🛠️ Обновление кода в продакшене

```bash
# 1. Обновить код
cd /var/www/luxon
git pull origin main

# 2. Пересобрать
cd admin_nextjs
npm install
npm run build

cd ../bot2/mini_app_site
npm install
npm run build

# 3. Перезапустить через PM2
pm2 restart luxon-admin
pm2 restart luxon-mini-app
```

## ⚡ Быстрое обновление (скрипт)

```bash
#!/bin/bash
cd /var/www/luxon

# Админка
cd admin_nextjs
git pull origin main
npm install
npm run build
pm2 restart luxon-admin

# Клиентский сайт
cd ../bot2/mini_app_site
git pull origin main
npm install
npm run build
pm2 restart luxon-mini-app

echo "✅ Обновление завершено!"
```

## 🐛 Проблемы и решения

### Проблема: Сайт работает медленно
**Решение**: Убедитесь, что запущен production сервер (`next start`), а не dev (`next dev`)

### Проблема: Изменения не применяются
**Решение**: Пересоберите проект (`npm run build`) перед перезапуском

### Проблема: Ошибка "Cannot find module"
**Решение**: Установите зависимости: `npm install`

## 📚 Дополнительная информация

- Next.js Production Deployment: https://nextjs.org/docs/deployment
- PM2 Documentation: https://pm2.keymetrics.io/docs/usage/quick-start/

