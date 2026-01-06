#!/bin/bash
# Исправление установки PM2 и Nginx

echo "🔧 Исправление установки..."

# Установка PM2 через npm
echo "Установка PM2 через npm..."
npm install -g pm2

# Проверка установки nginx
if ! command -v nginx &> /dev/null; then
    echo "Установка nginx..."
    apt-get install -y nginx
fi

# Установка certbot
if ! command -v certbot &> /dev/null; then
    echo "Установка certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Проверка
echo ""
echo "Проверка установки:"
node -v
npm -v
pm2 -v
nginx -v
certbot --version

echo ""
echo "✅ Готово! Теперь можно выполнить setup_server_on_remote.sh заново"

