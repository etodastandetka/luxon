#!/bin/bash

# Автоматическая настройка сервера для luxservice.online и xendro.pro
# Выполните: chmod +x setup_server.sh && ./setup_server.sh

set -e  # Остановить при любой ошибке

echo "🚀 Начинаю настройку сервера..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка, что мы root
if [ "$EUID" -ne 0 ]; then
    error "Пожалуйста, запустите скрипт от имени root: sudo ./setup_server.sh"
    exit 1
fi

log "Обновление кода из GitHub..."
cd /var/www/luxservice
git pull origin main

log "Настройка Django..."
cd django_admin
source .venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
deactivate
cd ..

log "Создание временной конфигурации Nginx (без SSL для xendro.pro)..."
cat > /etc/nginx/sites-available/combined << 'EOF'
# Редирект с HTTP на HTTPS для luxservice.online
server {
    listen 80;
    server_name luxservice.online www.luxservice.online;
    return 301 https://$server_name$request_uri;
}

# Клиентский сайт luxservice.online (Next.js)
server {
    listen 443 ssl http2;
    server_name luxservice.online www.luxservice.online;
    
    ssl_certificate /etc/letsencrypt/live/luxservice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/luxservice.online/privkey.pem;
    
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

# Временная конфигурация для xendro.pro (HTTP только)
server {
    listen 80;
    server_name xendro.pro www.xendro.pro;
    
    location /static/ {
        alias /var/www/luxservice/django_admin/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

log "Активация конфигурации Nginx..."
ln -sf /etc/nginx/sites-available/combined /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Получение SSL сертификата для xendro.pro..."
certbot --nginx -d xendro.pro -d www.xendro.pro --non-interactive --agree-tos --email etodastandetka@gmail.com

log "Обновление конфигурации Nginx с SSL для xendro.pro..."
cat > /etc/nginx/sites-available/combined << 'EOF'
# Редирект с HTTP на HTTPS для luxservice.online
server {
    listen 80;
    server_name luxservice.online www.luxservice.online;
    return 301 https://$server_name$request_uri;
}

# Клиентский сайт luxservice.online (Next.js)
server {
    listen 443 ssl http2;
    server_name luxservice.online www.luxservice.online;
    
    ssl_certificate /etc/letsencrypt/live/luxservice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/luxservice.online/privkey.pem;
    
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

# Редирект с HTTP на HTTPS для xendro.pro
server {
    listen 80;
    server_name xendro.pro www.xendro.pro;
    return 301 https://$server_name$request_uri;
}

# Админ-панель xendro.pro (Django) с SSL
server {
    listen 443 ssl http2;
    server_name xendro.pro www.xendro.pro;
    
    ssl_certificate /etc/letsencrypt/live/xendro.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xendro.pro/privkey.pem;
    
    location /static/ {
        alias /var/www/luxservice/django_admin/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

log "Перезагрузка Nginx с обновленной конфигурацией..."
nginx -t
systemctl reload nginx

log "Запуск всех сервисов через PM2..."
pm2 start ecosystem.config.js
pm2 save

log "Проверка статуса сервисов..."
pm2 status

log "Проверка работы сайтов..."
echo "Проверяю luxservice.online..."
curl -I https://luxservice.online 2>/dev/null | head -1 || warn "luxservice.online недоступен"

echo "Проверяю xendro.pro..."
curl -I https://xendro.pro 2>/dev/null | head -1 || warn "xendro.pro недоступен"

echo ""
echo "🎉 Настройка завершена!"
echo "📋 Статус:"
echo "  • Клиентский сайт: https://luxservice.online"
echo "  • Админ-панель: https://xendro.pro"
echo "  • Telegram бот: работает в фоне"
echo ""
echo "🔧 Полезные команды:"
echo "  • pm2 status - статус сервисов"
echo "  • pm2 logs - просмотр логов"
echo "  • pm2 restart all - перезапуск всех сервисов"
echo ""
