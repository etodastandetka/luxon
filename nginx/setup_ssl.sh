#!/bin/bash
# Скрипт для установки SSL сертификатов через Let's Encrypt (certbot)

set -e

echo "🔒 Настройка SSL сертификатов для nginx"

# Определяем директорию скрипта и корневую директорию проекта
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
NGINX_CONFIG_DIR="$PROJECT_ROOT/nginx"

echo "📁 Директория проекта: $PROJECT_ROOT"
echo "📁 Директория конфигураций nginx: $NGINX_CONFIG_DIR"

# Проверяем, запущен ли скрипт от root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Скрипт должен быть запущен от root (используйте sudo)"
    exit 1
fi

# Устанавливаем certbot, если не установлен
if ! command -v certbot &> /dev/null; then
    echo "📦 Установка certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
else
    echo "✅ Certbot уже установлен"
fi

# Проверяем, что nginx установлен
if ! command -v nginx &> /dev/null; then
    echo "❌ nginx не установлен! Установите его сначала."
    exit 1
fi

# Создаем директорию для ACME challenge
mkdir -p /var/www/html/.well-known/acme-challenge

# Сначала создаем временные конфигурации без SSL для получения сертификатов
echo "📝 Создание временных конфигураций nginx..."

# Для lux-on.org
cat > /etc/nginx/sites-available/lux-on.org.temp << 'EOF'
server {
    listen 80;
    server_name lux-on.org www.lux-on.org;
    
    location / {
        return 200 "OK";
        add_header Content-Type text/plain;
    }
    
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }
}
EOF

# Для pipiska.net
cat > /etc/nginx/sites-available/pipiska.net.temp << 'EOF'
server {
    listen 80;
    server_name pipiska.net www.pipiska.net;
    
    location / {
        return 200 "OK";
        add_header Content-Type text/plain;
    }
    
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }
}
EOF

# Копируем основную конфигурацию (если её нет)
if [ ! -f /etc/nginx/sites-available/lux-on.org ]; then
    echo "📋 Копирование конфигурации lux-on.org..."
    cp "$NGINX_CONFIG_DIR/lux-on.org.conf" /etc/nginx/sites-available/lux-on.org
fi

if [ ! -f /etc/nginx/sites-available/pipiska.net ]; then
    echo "📋 Копирование конфигурации pipiska.net..."
    cp "$NGINX_CONFIG_DIR/pipiska.net.conf" /etc/nginx/sites-available/pipiska.net
fi

# Включаем сайты (если не включены)
if [ ! -L /etc/nginx/sites-enabled/lux-on.org ]; then
    ln -s /etc/nginx/sites-available/lux-on.org /etc/nginx/sites-enabled/
fi

if [ ! -L /etc/nginx/sites-enabled/pipiska.net ]; then
    ln -s /etc/nginx/sites-available/pipiska.net /etc/nginx/sites-enabled/
fi

# Проверяем конфигурацию nginx
echo "🔍 Проверка конфигурации nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации nginx! Исправьте её перед продолжением."
    exit 1
fi

# Перезапускаем nginx
echo "🔄 Перезапуск nginx..."
systemctl restart nginx

# Получаем SSL сертификаты
echo "🔐 Получение SSL сертификатов через certbot..."

# Для lux-on.org
echo "📜 Получение сертификата для lux-on.org..."
certbot certonly --nginx \
    -d lux-on.org \
    -d www.lux-on.org \
    --non-interactive \
    --agree-tos \
    --email admin@lux-on.org \
    --redirect || echo "⚠️ Не удалось получить сертификат для lux-on.org (возможно, уже получен или ошибка)"

# Для pipiska.net
echo "📜 Получение сертификата для pipiska.net..."
certbot certonly --nginx \
    -d pipiska.net \
    -d www.pipiska.net \
    --non-interactive \
    --agree-tos \
    --email admin@pipiska.net \
    --redirect || echo "⚠️ Не удалось получить сертификат для pipiska.net (возможно, уже получен или ошибка)"

# Применяем полные конфигурации с SSL
echo "📝 Применение конфигураций с SSL..."

# Копируем SSL конфигурации (после получения сертификатов)
if [ -f "$NGINX_CONFIG_DIR/lux-on.org.ssl.conf" ]; then
    cp "$NGINX_CONFIG_DIR/lux-on.org.ssl.conf" /etc/nginx/sites-available/lux-on.org
    echo "✅ Применена SSL конфигурация для lux-on.org"
else
    echo "⚠️ Файл $NGINX_CONFIG_DIR/lux-on.org.ssl.conf не найден, пропускаем..."
fi

if [ -f "$NGINX_CONFIG_DIR/pipiska.net.ssl.conf" ]; then
    cp "$NGINX_CONFIG_DIR/pipiska.net.ssl.conf" /etc/nginx/sites-available/pipiska.net
    echo "✅ Применена SSL конфигурация для pipiska.net"
else
    echo "⚠️ Файл $NGINX_CONFIG_DIR/pipiska.net.ssl.conf не найден, пропускаем..."
fi

# Проверяем конфигурацию
echo "🔍 Проверка конфигурации nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации nginx! Проверьте пути к сертификатам."
    exit 1
fi

# Перезапускаем nginx
echo "🔄 Перезапуск nginx с SSL..."
systemctl reload nginx

# Настраиваем автообновление сертификатов
echo "⏰ Настройка автообновления сертификатов..."
if ! grep -q "certbot renew" /etc/crontab; then
    echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'" >> /etc/crontab
fi

echo "✅ SSL сертификаты настроены!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте, что домены указывают на IP сервера"
echo "2. Убедитесь, что порты 80 и 443 открыты в firewall"
echo "3. Проверьте работу сайтов:"
echo "   - https://lux-on.org"
echo "   - https://pipiska.net"
echo ""
echo "🔍 Проверка статуса сертификатов:"
echo "   certbot certificates"

