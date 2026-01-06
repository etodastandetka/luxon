#!/bin/bash
# Скрипт для настройки сервера LUXON

SERVER_IP="147.45.99.111"
SERVER_USER="root"
SERVER_PASS="madSvQb*v*2rPU"
REPO_URL="https://github.com/etodastandetka/ls.git"
BASE_DIR="/var/www/luxon"

echo "🚀 Начинаем настройку сервера LUXON..."

# Функция для выполнения команд на сервере
ssh_exec() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$1"
}

# Функция для копирования файлов
scp_copy() {
    sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no "$1" "$SERVER_USER@$SERVER_IP:$2"
}

echo "📦 Обновление системы..."
ssh_exec "apt-get update && apt-get upgrade -y"

echo "📦 Установка необходимых пакетов..."
ssh_exec "apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv pm2 build-essential"

echo "📁 Создание структуры папок..."
ssh_exec "mkdir -p $BASE_DIR && mkdir -p /var/log/nginx && mkdir -p /var/log/pm2"

echo "📥 Клонирование репозитория..."
ssh_exec "cd $BASE_DIR && git clone $REPO_URL . || (cd $BASE_DIR && git pull)"

echo "✅ Базовая настройка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Настройка переменных окружения"
echo "2. Установка зависимостей"
echo "3. Настройка nginx"
echo "4. Получение SSL сертификатов"
echo "5. Запуск приложений через PM2"

