# Руководство по развертыванию на новом сервере

## Новые домены
- **japar.click** - Админ-панель (Next.js)
- **luxon.dad** - Клиентский сайт (Next.js Mini App)

## Предварительные требования

1. Ubuntu/Debian сервер с root доступом
2. Домены должны указывать на IP сервера (A-записи)
3. Node.js 18+ и npm
4. PostgreSQL
5. Nginx
6. PM2 для управления процессами
7. Certbot для SSL сертификатов

## Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl git build-essential nginx postgresql postgresql-contrib certbot python3-certbot-nginx

# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Проверка версий
node -v
npm -v
postgresql --version
nginx -v
```

## Шаг 2: Клонирование репозитория

```bash
# Создаем директорию для проекта
sudo mkdir -p /var/www/luxon
sudo chown -R $USER:$USER /var/www/luxon

# Клонируем репозиторий
cd /var/www/luxon
git clone <ваш-git-репозиторий> .

# Или если уже есть репозиторий
git pull origin main
```

## Шаг 3: Настройка PostgreSQL

```bash
# Переходим в PostgreSQL
sudo -u postgres psql

# Создаем базу данных и пользователя
CREATE DATABASE luxon_admin;
CREATE USER luxon_user WITH ENCRYPTED PASSWORD 'ваш_надежный_пароль';
GRANT ALL PRIVILEGES ON DATABASE luxon_admin TO luxon_user;
\q
```

## Шаг 4: Настройка админ-панели (japar.click)

```bash
cd /var/www/luxon/admin_nextjs

# Установка зависимостей
npm install

# Создание .env файла
cp .env.example .env  # Если есть пример
# Или создайте вручную:
nano .env
```

### Содержимое .env для админки:

```env
# База данных
DATABASE_URL="postgresql://luxon_user:ваш_надежный_пароль@localhost:5432/luxon_admin?schema=public"

# JWT секрет (сгенерируйте случайную строку)
JWT_SECRET="ваш_очень_длинный_случайный_секретный_ключ_минимум_32_символа"

# Окружение
NODE_ENV="production"

# Публичный URL админки
NEXT_PUBLIC_API_URL="https://japar.click"

# Telegram Bot Token (если используется)
BOT_TOKEN="ваш_бот_токен"

# MobCash API (если используется)
MOBCASH_LOGIN="ваш_логин"
MOBCASH_PASSWORD="ваш_пароль"
MOBCASH_CASHDESK_ID="ваш_cashdesk_id"
MOBCASH_DEFAULT_LAT=42.845778
MOBCASH_DEFAULT_LON=74.568778
# MOBCASH_BEARER_TOKEN="ory_at_..." (опционально)
# MOBCASH_USER_ID="..." (опционально)
# MOBCASH_SESSION_ID="..." (опционально)

# Telegram Group Chat ID (если используется)
TELEGRAM_GROUP_CHAT_ID="ваш_групповой_чат_id"
```

```bash
# Генерация Prisma Client
npm run db:generate

# Применение схемы базы данных
npm run db:push

# Создание первого администратора
ADMIN_USERNAME=admin ADMIN_PASSWORD=ваш_пароль ADMIN_EMAIL=admin@luxon.com npm run create-admin

# Сборка проекта
npm run build
```

## Шаг 5: Настройка клиентского сайта (luxon.dad)

```bash
cd /var/www/luxon/bot2/mini_app_site

# Установка зависимостей
npm install

# Создание .env файла
nano .env
```

### Содержимое .env для клиентского сайта:

```env
# Окружение
NODE_ENV="production"

# URL админки (локальный, так как на одном сервере)
ADMIN_API_URL="http://127.0.0.1:3001"

# Публичный URL админки (для клиентской части)
NEXT_PUBLIC_DJANGO_API_URL="https://japar.click"
```

```bash
# Сборка проекта
npm run build
```

## Шаг 6: Настройка Nginx

### Конфигурация для админки (japar.click)

```bash
sudo nano /etc/nginx/sites-available/japar.click
```

```nginx
server {
    listen 80;
    server_name japar.click www.japar.click;

    # Редирект на HTTPS будет настроен после получения сертификата
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Конфигурация для клиентского сайта (luxon.dad)

```bash
sudo nano /etc/nginx/sites-available/luxon.dad
```

```nginx
server {
    listen 80;
    server_name luxon.dad www.luxon.dad;

    # Редирект на HTTPS будет настроен после получения сертификата
    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активация конфигураций
sudo ln -s /etc/nginx/sites-available/japar.click /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/luxon.dad /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

## Шаг 7: Получение SSL сертификатов через Certbot

```bash
# Получение сертификата для админки
sudo certbot --nginx -d japar.click -d www.japar.click

# Получение сертификата для клиентского сайта
sudo certbot --nginx -d luxon.dad -d www.luxon.dad

# Автоматическое обновление сертификатов (уже настроено в cron)
sudo certbot renew --dry-run
```

После получения сертификатов Certbot автоматически обновит конфигурации Nginx для использования HTTPS.

## Шаг 8: Настройка PM2

### Создание конфигурации для админки

```bash
cd /var/www/luxon/admin_nextjs
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'luxon-admin',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/luxon-admin-error.log',
      out_file: '/var/log/pm2/luxon-admin-out.log',
      log_file: '/var/log/pm2/luxon-admin.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'luxon-email-watcher',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'npm',
      args: 'run watcher',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/luxon-watcher-error.log',
      out_file: '/var/log/pm2/luxon-watcher-out.log',
      log_file: '/var/log/pm2/luxon-watcher.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
```

### Создание конфигурации для клиентского сайта

```bash
cd /var/www/luxon/bot2/mini_app_site
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'luxon-mini-app',
      cwd: '/var/www/luxon/bot2/mini_app_site',
      script: 'node_modules/.bin/next',
      args: 'start -p 3030',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      error_file: '/var/log/pm2/luxon-mini-app-error.log',
      out_file: '/var/log/pm2/luxon-mini-app-out.log',
      log_file: '/var/log/pm2/luxon-mini-app.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
```

### Запуск приложений через PM2

```bash
# Запуск админки
cd /var/www/luxon/admin_nextjs
pm2 start ecosystem.config.js

# Запуск клиентского сайта
cd /var/www/luxon/bot2/mini_app_site
pm2 start ecosystem.config.js

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска при перезагрузке сервера
pm2 startup
# Выполните команду, которую выведет PM2
```

## Шаг 9: Обновление конфигураций с новыми доменами

После развертывания нужно обновить все упоминания старых доменов в коде. Используйте скрипт `update-domains.sh` для автоматического обновления.

## Шаг 10: Проверка работы

1. Проверьте админку: https://japar.click
2. Проверьте клиентский сайт: https://luxon.dad
3. Проверьте логи PM2: `pm2 logs`
4. Проверьте логи Nginx: `sudo tail -f /var/log/nginx/error.log`

## Полезные команды

```bash
# Просмотр статуса PM2
pm2 status
pm2 logs

# Перезапуск приложений
pm2 restart all
pm2 restart luxon-admin
pm2 restart luxon-mini-app

# Обновление кода
cd /var/www/luxon
git pull origin main
cd admin_nextjs && npm install && npm run build && pm2 restart luxon-admin
cd ../bot2/mini_app_site && npm install && npm run build && pm2 restart luxon-mini-app

# Проверка портов
sudo netstat -tlnp | grep -E '3001|3030'

# Проверка SSL сертификатов
sudo certbot certificates
```

## Безопасность

1. Настройте firewall:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. Регулярно обновляйте систему:
```bash
sudo apt update && sudo apt upgrade -y
```

3. Используйте сильные пароли для базы данных и JWT_SECRET

4. Настройте регулярные бэкапы базы данных

