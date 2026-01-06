#!/bin/bash
# Скрипт для выполнения на сервере для настройки LUXON
# Копируйте этот файл на сервер и выполняйте: bash setup_server_on_remote.sh

set -e

REPO_URL="https://github.com/etodastandetka/ls.git"
BASE_DIR="/var/www/luxon"

echo "🚀 Начинаем полную настройку сервера LUXON..."
echo ""

echo "1️⃣ Обновление системы..."
apt-get update && apt-get upgrade -y

echo ""
echo "2️⃣ Установка необходимых пакетов..."
apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv build-essential postgresql-client

echo ""
echo "3️⃣ Обновление Node.js до последней LTS версии..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo ""
echo "4️⃣ Установка PM2 глобально через npm..."
npm install -g pm2

echo ""
echo "5️⃣ Проверка версий..."
node -v
npm -v
python3 --version
pm2 -v

echo ""
echo "6️⃣ Создание структуры папок..."
mkdir -p $BASE_DIR
mkdir -p /var/log/nginx
mkdir -p /var/log/pm2
mkdir -p $BASE_DIR/tmp/receipt_uploads

echo ""
echo "7️⃣ Клонирование репозитория..."
if [ -d "$BASE_DIR/.git" ]; then
    echo "   Репозиторий уже существует, обновляю..."
    cd $BASE_DIR
    git pull
else
    echo "   Клонирую репозиторий..."
    cd /var/www
    git clone $REPO_URL luxon
fi

echo ""
echo "8️⃣ Создание конфигураций nginx..."

# Конфигурация для lux-on.org
cat > /etc/nginx/sites-available/lux-on.org << 'EOF'
server {
    listen 80;
    server_name lux-on.org www.lux-on.org;

    access_log /var/log/nginx/lux-on.org.access.log;
    error_log /var/log/nginx/lux-on.org.error.log;

    client_max_body_size 50M;

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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Конфигурация для pipiska.net
cat > /etc/nginx/sites-available/pipiska.net << 'EOF'
server {
    listen 80;
    server_name pipiska.net www.pipiska.net;

    access_log /var/log/nginx/pipiska.net.access.log;
    error_log /var/log/nginx/pipiska.net.error.log;

    client_max_body_size 50M;

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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Активация сайтов
ln -sf /etc/nginx/sites-available/lux-on.org /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/pipiska.net /etc/nginx/sites-enabled/

# Удаление default конфига если есть
rm -f /etc/nginx/sites-enabled/default

echo ""
echo "9️⃣ Проверка конфигурации nginx..."
nginx -t

echo ""
echo "🔟 Перезапуск nginx..."
systemctl restart nginx
systemctl enable nginx

echo ""
echo "1️⃣1️⃣ Установка зависимостей для клиентского сайта..."
cd $BASE_DIR/app
npm install

echo ""
echo "1️⃣2️⃣ Установка зависимостей для админки..."
cd $BASE_DIR/admin_nextjs
npm install

echo ""
echo "1️⃣3️⃣ Сборка клиентского сайта..."
cd $BASE_DIR/app
npm run build

echo ""
echo "1️⃣4️⃣ Сборка админки..."
cd $BASE_DIR/admin_nextjs
npm run build

echo ""
echo "1️⃣5️⃣ Настройка Python окружения для бота..."
cd $BASE_DIR/bot
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "1️⃣6️⃣ Настройка PM2..."

# Остановка существующих процессов
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Запуск клиентского сайта
cd $BASE_DIR/app
pm2 start ecosystem.config.js

# Запуск админки
cd $BASE_DIR/admin_nextjs
pm2 start ecosystem.config.js

# Запуск бота
cd $BASE_DIR/bot
pm2 start ecosystem.config.js

# Сохранение конфигурации PM2
pm2 save
pm2 startup

echo ""
echo "1️⃣7️⃣ Статус PM2 процессов..."
pm2 status

echo ""
echo "✅ Базовая настройка сервера завершена!"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Настройте переменные окружения:"
echo "   - $BASE_DIR/app/.env.local"
echo "   - $BASE_DIR/admin_nextjs/.env"
echo "   - $BASE_DIR/bot/.env"
echo ""
echo "2. Настройте DNS записи для доменов:"
echo "   - lux-on.org -> A запись -> $(curl -s ifconfig.me)"
echo "   - pipiska.net -> A запись -> $(curl -s ifconfig.me)"
echo ""
echo "3. После настройки DNS получите SSL сертификаты:"
echo "   certbot --nginx -d lux-on.org -d www.lux-on.org --non-interactive --agree-tos --email admin@lux-on.org --redirect"
echo "   certbot --nginx -d pipiska.net -d www.pipiska.net --non-interactive --agree-tos --email admin@pipiska.net --redirect"
echo ""
echo "4. Проверьте статус сервисов:"
echo "   pm2 status"
echo "   systemctl status nginx"
echo ""
echo "5. Для просмотра логов:"
echo "   pm2 logs"
echo "   tail -f /var/log/nginx/error.log"

