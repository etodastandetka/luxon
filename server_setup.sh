#!/bin/bash
# Полный скрипт настройки сервера LUXON

set -e

SERVER_IP="147.45.99.111"
SERVER_USER="root"
SERVER_PASS="madSvQb*v*2rPU"
REPO_URL="https://github.com/etodastandetka/ls.git"
BASE_DIR="/var/www/luxon"

echo "🚀 Начинаем полную настройку сервера LUXON..."
echo ""

# Установка sshpass если не установлен
if ! command -v sshpass &> /dev/null; then
    echo "📦 Установка sshpass..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass 2>/dev/null || echo "Установите sshpass вручную: brew install hudochenkov/sshpass/sshpass"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y sshpass 2>/dev/null || sudo yum install -y sshpass 2>/dev/null || echo "Установите sshpass вручную"
    fi
fi

# Функция для выполнения команд на сервере
ssh_exec() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SERVER_USER@$SERVER_IP" "$1"
}

# Функция для копирования файлов
scp_copy() {
    sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$1" "$SERVER_USER@$SERVER_IP:$2"
}

echo "1️⃣ Обновление системы..."
ssh_exec "apt-get update && apt-get upgrade -y"

echo ""
echo "2️⃣ Установка необходимых пакетов..."
ssh_exec "apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv pm2 build-essential postgresql-client"

echo ""
echo "3️⃣ Обновление Node.js до последней LTS версии..."
ssh_exec "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"

echo ""
echo "4️⃣ Создание структуры папок..."
ssh_exec "mkdir -p $BASE_DIR && mkdir -p /var/log/nginx && mkdir -p /var/log/pm2 && mkdir -p $BASE_DIR/tmp/receipt_uploads"

echo ""
echo "5️⃣ Клонирование репозитория..."
ssh_exec "cd $BASE_DIR && if [ -d .git ]; then git pull; else git clone $REPO_URL .; fi"

echo ""
echo "6️⃣ Копирование конфигураций nginx..."
scp_copy "nginx/lux-on.org.conf" "/tmp/lux-on.org.conf"
scp_copy "nginx/pipiska.net.conf" "/tmp/pipiska.net.conf"
ssh_exec "cp /tmp/lux-on.org.conf /etc/nginx/sites-available/lux-on.org && cp /tmp/pipiska.net.conf /etc/nginx/sites-available/pipiska.net"
ssh_exec "ln -sf /etc/nginx/sites-available/lux-on.org /etc/nginx/sites-enabled/ && ln -sf /etc/nginx/sites-available/pipiska.net /etc/nginx/sites-enabled/"

echo ""
echo "7️⃣ Установка зависимостей для клиентского сайта..."
ssh_exec "cd $BASE_DIR/app && npm install"

echo ""
echo "8️⃣ Установка зависимостей для админки..."
ssh_exec "cd $BASE_DIR/admin_nextjs && npm install"

echo ""
echo "9️⃣ Сборка клиентского сайта..."
ssh_exec "cd $BASE_DIR/app && npm run build"

echo ""
echo "🔟 Сборка админки..."
ssh_exec "cd $BASE_DIR/admin_nextjs && npm run build"

echo ""
echo "1️⃣1️⃣ Настройка Python окружения для бота..."
ssh_exec "cd $BASE_DIR/bot && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"

echo ""
echo "1️⃣2️⃣ Проверка конфигурации nginx..."
ssh_exec "nginx -t"

echo ""
echo "1️⃣3️⃣ Перезапуск nginx..."
ssh_exec "systemctl restart nginx && systemctl enable nginx"

echo ""
echo "1️⃣4️⃣ Получение SSL сертификатов..."
echo "   Получение сертификата для lux-on.org..."
ssh_exec "certbot --nginx -d lux-on.org -d www.lux-on.org --non-interactive --agree-tos --email admin@lux-on.org --redirect" || echo "⚠️ Не удалось получить сертификат для lux-on.org (возможно, домен еще не настроен)"

echo ""
echo "   Получение сертификата для pipiska.net..."
ssh_exec "certbot --nginx -d pipiska.net -d www.pipiska.net --non-interactive --agree-tos --email admin@pipiska.net --redirect" || echo "⚠️ Не удалось получить сертификат для pipiska.net (возможно, домен еще не настроен)"

echo ""
echo "1️⃣5️⃣ Настройка PM2..."
ssh_exec "cd $BASE_DIR/app && pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js"
ssh_exec "cd $BASE_DIR/admin_nextjs && pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js"
ssh_exec "cd $BASE_DIR/bot && pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js"
ssh_exec "pm2 save && pm2 startup"

echo ""
echo "✅ Настройка сервера завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте переменные окружения в .env файлах:"
echo "   - $BASE_DIR/app/.env.local"
echo "   - $BASE_DIR/admin_nextjs/.env"
echo "   - $BASE_DIR/bot/.env"
echo ""
echo "2. Настройте DNS записи для доменов:"
echo "   - lux-on.org -> $SERVER_IP"
echo "   - pipiska.net -> $SERVER_IP"
echo ""
echo "3. После настройки DNS повторите получение SSL сертификатов:"
echo "   certbot --nginx -d lux-on.org -d www.lux-on.org"
echo "   certbot --nginx -d pipiska.net -d www.pipiska.net"
echo ""
echo "4. Проверьте статус сервисов:"
echo "   pm2 status"
echo "   systemctl status nginx"
echo ""
echo "5. Для просмотра логов:"
echo "   pm2 logs"
echo "   tail -f /var/log/nginx/error.log"

