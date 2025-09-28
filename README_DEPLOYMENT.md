# 🚀 Развертывание проекта на сервере

Подробная инструкция по развертыванию трех проектов:
- **Telegram бот** (Python/aiogram)
- **Django админ-панель** (Python/Django)
- **Referral сайт** (Next.js/React)

## 📋 Содержание
1. [Подготовка сервера](#подготовка-сервера)
2. [Установка зависимостей](#установка-зависимостей)
3. [Настройка проектов](#настройка-проектов)
4. [Конфигурация Nginx](#конфигурация-nginx)
5. [Настройка PM2](#настройка-pm2)
6. [SSL сертификаты](#ssl-сертификаты)
7. [Развертывание](#развертывание)
8. [Мониторинг и логи](#мониторинг-и-логи)

---

## 🖥️ Подготовка сервера

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка необходимых пакетов
```bash
sudo apt install -y curl wget git build-essential software-properties-common
```

---

## 📦 Установка зависимостей

### 1. Node.js (для Next.js сайта)
```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии
node --version
npm --version
```

### 2. Python 3.11+ (для бота и Django)
```bash
# Установка Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Создание символической ссылки
sudo ln -sf /usr/bin/python3.11 /usr/bin/python3
sudo ln -sf /usr/bin/python3.11 /usr/bin/python

# Установка pip для Python 3.11
curl https://bootstrap.pypa.io/get-pip.py | sudo python3.11
```

### 3. PM2 (менеджер процессов)
```bash
sudo npm install -g pm2

# Настройка автозапуска PM2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 4. Nginx
```bash
sudo apt install -y nginx

# Запуск и автозапуск
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. SQLite3 (для баз данных)
```bash
sudo apt install -y sqlite3
```

---

## ⚙️ Настройка проектов

### 1. Создание структуры директорий
```bash
# Создаем директорию для проектов
sudo mkdir -p /var/www/luxservice
sudo chown $USER:$USER /var/www/luxservice
cd /var/www/luxservice

# Клонируем репозиторий (замените на ваш URL)
git clone https://github.com/your-username/bets.git .
```

### 2. Настройка Telegram бота

```bash
cd /var/www/luxservice/bot

# Создание виртуального окружения
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Создание конфигурационного файла
nano config.py
```

**Содержимое `bot/config.py`:**
```python
#!/usr/bin/env python3
"""
Конфигурация универсального бота
"""

# Токен бота (замените на ваш)
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"

# Букмекеры (настройте под ваши API)
BOOKMAKERS = {
    "1xbet": {
        "name": "1XBET",
        "emoji": "🎰",
        "deposit_group_id": -4790118427,
        "withdraw_group_id": -4959080180,
        "api_config": {
            "hash": "your_1xbet_hash",
            "cashierpass": "your_cashierpass",
            "login": "your_login",
            "cashdeskid": "your_cashdeskid"
        }
    },
    # ... остальные букмекеры
}

# Реферальная система
REFERRAL_COMMISSION = 0.02
REFERRAL_MIN_DEPOSIT = 100

# Веб-сайт
WEB_TOP_URL = "https://luxservice.online"

# База данных
DATABASE_PATH = "/var/www/luxservice/universal_bot.db"
```

### 3. Настройка Django админ-панели

```bash
cd /var/www/luxservice/django_admin

# Создание виртуального окружения
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Настройка Django
nano admin_panel/settings.py
```

**Обновленные настройки в `admin_panel/settings.py`:**
```python
import os
from pathlib import Path

# ... остальные импорты

# Безопасность для продакшена
DEBUG = False
ALLOWED_HOSTS = ['admin.luxservice.online', '46.149.69.231', 'luxservice.online']

# Настройки базы данных
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/var/www/luxservice/django_admin/admin.sqlite3',
    }
}

# Статические файлы
STATIC_ROOT = '/var/www/luxservice/django_admin/staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Путь к базе бота
BOT_DATABASE_PATH = '/var/www/luxservice/universal_bot.db'

# Секретный ключ (сгенерируйте новый!)
SECRET_KEY = 'your-very-secret-key-here'

# Безопасность
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
```

```bash
# Миграции Django
python manage.py makemigrations
python manage.py migrate

# Создание суперпользователя
python manage.py createsuperuser

# Сбор статических файлов
python manage.py collectstatic --noinput
```

### 4. Настройка Next.js сайта

```bash
cd /var/www/luxservice/referral_site

# Установка зависимостей
npm install

# Создание production build
npm run build

# Создание файла конфигурации
nano next.config.js
```

**Обновленный `next.config.js`:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
```

---

## 🌐 Конфигурация Nginx

### 1. Основная конфигурация Nginx
```bash
sudo nano /etc/nginx/sites-available/bets
```

**Содержимое конфигурации:**
```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name luxservice.online www.luxservice.online admin.luxservice.online;
    return 301 https://$server_name$request_uri;
}

# Основной сайт (Next.js)
server {
    listen 443 ssl http2;
    server_name luxservice.online www.luxservice.online;
    
    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/luxservice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/luxservice.online/privkey.pem;
    
    # Статические файлы Next.js
    location / {
        proxy_pass http://localhost:3000;
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

# Django админ-панель
server {
    listen 443 ssl http2;
    server_name admin.luxservice.online;
    
    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/admin.luxservice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.luxservice.online/privkey.pem;
    
    # Статические файлы Django
    location /static/ {
        alias /var/www/luxservice/django_admin/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Django приложение
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API endpoints (опционально)
server {
    listen 443 ssl http2;
    server_name api.luxservice.online;
    
    ssl_certificate /etc/letsencrypt/live/api.luxservice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.luxservice.online/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Активация конфигурации
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/bets /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

---

## 🔧 Настройка PM2

### 1. Конфигурационный файл PM2
```bash
nano /var/www/luxservice/ecosystem.config.js
```

**Содержимое `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      cwd: '/var/www/luxservice/bot',
      script: 'main.py',
      interpreter: '/var/www/luxservice/bot/venv/bin/python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PYTHONPATH: '/var/www/luxservice/bot'
      },
      error_file: '/var/log/pm2/bot-error.log',
      out_file: '/var/log/pm2/bot-out.log',
      log_file: '/var/log/pm2/bot-combined.log',
      time: true
    },
    {
      name: 'django-admin',
      cwd: '/var/www/luxservice/django_admin',
      script: 'manage.py',
      args: 'runserver 0.0.0.0:8000',
      interpreter: '/var/www/luxservice/django_admin/venv/bin/python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        DJANGO_SETTINGS_MODULE: 'admin_panel.settings'
      },
      error_file: '/var/log/pm2/django-error.log',
      out_file: '/var/log/pm2/django-out.log',
      log_file: '/var/log/pm2/django-combined.log',
      time: true
    },
    {
      name: 'referral-site',
      cwd: '/var/www/luxservice/referral_site',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/next-error.log',
      out_file: '/var/log/pm2/next-out.log',
      log_file: '/var/log/pm2/next-combined.log',
      time: true
    }
  ]
};
```

### 2. Создание директории для логов
```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2
```

---

## 🌐 Настройка DNS записей

### Настройка доменов в DNS панели
Перед получением SSL сертификатов убедитесь, что DNS записи настроены правильно:

**Для luxservice.online (клиентский сайт):**
```
A     luxservice.online      → 46.149.69.231
CNAME www.luxservice.online  → luxservice.online
```

**Для xendro.pro (админка):**
```
A     xendro.pro      → 46.149.69.231
CNAME www.xendro.pro  → xendro.pro
```

**Проверка DNS записей:**
```bash
# Проверка основных записей
nslookup luxservice.online
nslookup xendro.pro

# Или через dig
dig luxservice.online
dig xendro.pro
```

---

## 🔒 SSL сертификаты

### Установка Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Получение SSL сертификатов
```bash
# Для клиентского сайта
sudo certbot --nginx -d luxservice.online -d www.luxservice.online

# Для админ-панели
sudo certbot --nginx -d xendro.pro -d www.xendro.pro
```

### Автоматическое обновление сертификатов
```bash
# Добавление в crontab
sudo crontab -e

# Добавить строку:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🚀 Развертывание

### 1. Запуск всех сервисов через PM2
```bash
cd /var/www/luxservice

# Запуск всех приложений
pm2 start ecosystem.config.js

# Сохранение конфигурации PM2
pm2 save

# Проверка статуса
pm2 status
pm2 logs
```

### 🎯 Быстрые команды для luxservice.online

**Основные команды для вашего сервера:**
```bash
# Переход в директорию проекта
cd /var/www/luxservice

# Проверка статуса всех сервисов
pm2 status

# Просмотр логов
pm2 logs

# Перезапуск всех сервисов
pm2 restart all

# Перезапуск конкретного сервиса
pm2 restart telegram-bot
pm2 restart django-admin
pm2 restart referral-site

# Проверка работы сайтов
curl -I https://luxservice.online
curl -I https://admin.luxservice.online

# Проверка портов
sudo netstat -tlnp | grep -E ':(3000|8000|80|443)'
```

### 2. Проверка работы сервисов
```bash
# Проверка портов
sudo netstat -tlnp | grep -E ':(3000|8000|80|443)'

# Проверка логов
pm2 logs telegram-bot
pm2 logs django-admin
pm2 logs referral-site
```

### 3. Настройка файрвола (если используется UFW)
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

---

## 📊 Мониторинг и логи

### 1. PM2 мониторинг
```bash
# Веб-интерфейс PM2 (опционально)
pm2 install pm2-server-monit

# Просмотр логов в реальном времени
pm2 logs --lines 100

# Перезапуск сервисов
pm2 restart all
pm2 restart telegram-bot
```

### 2. Системные логи
```bash
# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
sudo journalctl -u nginx -f
```

### 3. Мониторинг ресурсов
```bash
# Установка htop для мониторинга
sudo apt install -y htop

# Просмотр использования ресурсов
htop
pm2 monit
```

---

## 🔄 Обновление и поддержка

### Скрипт для обновления
```bash
nano /var/www/bets/update.sh
```

**Содержимое `update.sh`:**
```bash
#!/bin/bash

echo "🔄 Обновление проектов..."

# Переход в директорию проекта
cd /var/www/luxservice

# Обновление кода
git pull origin main

# Обновление бота
cd bot
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Обновление Django
cd ../django_admin
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Обновление Next.js
cd ../referral_site
npm install
npm run build

# Перезапуск сервисов
cd ..
pm2 restart all

echo "✅ Обновление завершено!"
```

```bash
chmod +x update.sh
```

### Автоматические бэкапы
```bash
nano /var/www/bets/backup.sh
```

**Содержимое `backup.sh`:**
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/luxservice"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап баз данных
cp /var/www/luxservice/universal_bot.db $BACKUP_DIR/universal_bot_$DATE.db
cp /var/www/luxservice/django_admin/admin.sqlite3 $BACKUP_DIR/admin_$DATE.sqlite3

# Бэкап конфигураций
tar -czf $BACKUP_DIR/configs_$DATE.tar.gz /var/www/luxservice/bot/config.py /etc/nginx/sites-available/luxservice

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Бэкап создан: $BACKUP_DIR"
```

---

## ⚠️ Важные замечания

### Безопасность
1. **Смените все пароли и токены** на уникальные
2. **Настройте регулярные бэкапы**
3. **Обновляйте систему** регулярно
4. **Мониторьте логи** на предмет ошибок

### Производительность
1. **Настройте кэширование** в Nginx
2. **Оптимизируйте базы данных**
3. **Мониторьте использование ресурсов**

### Домены
Используемые домены:
- `luxservice.online` → клиентский сайт (Next.js)
- `xendro.pro` → админ-панель (Django)
- IP сервера: `46.149.69.231`

---

## 🆘 Устранение неполадок

### Частые проблемы

**1. PM2 не запускается**
```bash
pm2 kill
pm2 start ecosystem.config.js
```

**2. Nginx ошибки**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**3. Проблемы с правами доступа**
```bash
sudo chown -R $USER:$USER /var/www/luxservice
chmod -R 755 /var/www/luxservice
```

**4. Ошибки Python зависимостей**
```bash
cd /var/www/luxservice/bot
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs`
2. Проверьте статус сервисов: `pm2 status`
3. Проверьте конфигурацию Nginx: `sudo nginx -t`
4. Проверьте доступность портов: `sudo netstat -tlnp`

---

**🎉 Поздравляем! Ваши проекты развернуты и готовы к работе!**
