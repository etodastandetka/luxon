# Команды для сборки и запуска проектов

## 📦 Админ-панель (admin_nextjs)

### Установка зависимостей
```bash
cd admin_nextjs
npm install
```

### Настройка базы данных
```bash
# Генерация Prisma Client
npm run db:generate

# Применение изменений схемы к БД (для продакшена)
npm run db:push

# Или создание миграций (для разработки)
npm run db:migrate
```

### Разработка
```bash
# Запуск dev-сервера на порту 3001
npm run dev
```

### Сборка для продакшена
```bash
# Сборка проекта
npm run build

# Запуск production сервера на порту 3001
npm start
```

### Дополнительные команды
```bash
# Создание администратора
npm run create-admin

# Запуск email watcher
npm run watcher

# Проверка email watcher (одноразово)
npm run watcher:check

# Открытие Prisma Studio для просмотра БД
npm run db:studio

# Линтинг кода
npm run lint
```

---

## 🌐 Клиентский сайт (bot2/mini_app_site)

### Установка зависимостей
```bash
cd bot2/mini_app_site
npm install
```

### Разработка
```bash
# Запуск dev-сервера на порту 3000
npm run dev
```

### Сборка для продакшена
```bash
# Сборка проекта
npm run build

# Запуск production сервера
npm start

# Или запуск на порту 3030
npm run start:prod
```

---

## 🚀 Быстрые команды для сборки всех проектов

### Сборка админки
```bash
cd admin_nextjs && npm install && npm run build && cd ../..
```

### Сборка клиентского сайта
```bash
cd bot2/mini_app_site && npm install && npm run build && cd ../..
```

### Сборка всего (админка + клиент)
```bash
# Админка
cd admin_nextjs
npm install
npm run build
cd ../..

# Клиент
cd bot2/mini_app_site
npm install
npm run build
cd ../..
```

---

## 🔄 Обновление проекта на сервере

### 1. Обновление кода
```bash
cd /var/www/luxon  # или ваш путь к проекту
git pull origin main
```

### 2. Обновление админки
```bash
cd admin_nextjs
npm install
npm run db:generate
npm run db:push
npm run build
cd ../..
```

### 3. Обновление клиентского сайта
```bash
cd bot2/mini_app_site
npm install
npm run build
cd ../..
```

### 4. Перезапуск через PM2
```bash
# Перезапуск всех процессов
pm2 restart all

# Или конкретные процессы
pm2 restart luxon-admin-nextjs
pm2 restart luxon-client-nextjs  # если есть такой процесс
```

---

## 📝 Переменные окружения

### Админка (admin_nextjs/.env)
```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
JWT_SECRET="your-secret-key"
BOT_TOKEN="your-telegram-bot-token"
NODE_ENV="production"
```

### Клиентский сайт (bot2/mini_app_site/.env)
```env
NODE_ENV="production"
```

---

## 🛠️ PM2 Команды

### Управление процессами
```bash
# Просмотр всех процессов
pm2 list

# Просмотр логов
pm2 logs

# Просмотр логов конкретного процесса
pm2 logs luxon-admin-nextjs

# Перезапуск
pm2 restart all
pm2 restart luxon-admin-nextjs

# Остановка
pm2 stop all
pm2 stop luxon-admin-nextjs

# Удаление
pm2 delete luxon-admin-nextjs

# Сохранение конфигурации
pm2 save

# Автозапуск при перезагрузке сервера
pm2 startup
```

---

## 🔍 Проверка статуса

### Проверка портов
```bash
# Проверка порта 3001 (админка)
netstat -tulpn | grep 3001

# Проверка порта 3000/3030 (клиент)
netstat -tulpn | grep 3000
netstat -tulpn | grep 3030
```

### Проверка процессов Node.js
```bash
ps aux | grep node
```

---

## ⚠️ Частые проблемы

### Проблема: Ошибка при сборке
```bash
# Очистка кеша и переустановка
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Проблема: Prisma не видит изменения схемы
```bash
cd admin_nextjs
npm run db:generate
npm run db:push
```

### Проблема: Порт занят
```bash
# Найти процесс на порту
lsof -i :3001
# Убить процесс
kill -9 <PID>
```

