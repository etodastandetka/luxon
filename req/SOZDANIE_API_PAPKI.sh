#!/bin/bash
# Скрипт для создания папки api и файла payments.php на сервере

echo "════════════════════════════════════════════════════"
echo "  СОЗДАНИЕ ПАПКИ API И PHP ФАЙЛА"
echo "════════════════════════════════════════════════════"
echo ""

# Путь к веб-директории (может отличаться в зависимости от сервера)
WEB_DIR="/var/www/html"  # Для Apache
# WEB_DIR="/usr/share/nginx/html"  # Для Nginx
# WEB_DIR="/home/user/public_html"  # Для пользовательских серверов

echo "1. Создаю папку api..."
sudo mkdir -p $WEB_DIR/api
echo "✅ Папка создана: $WEB_DIR/api"
echo ""

echo "2. Создаю файл payments.php..."
sudo touch $WEB_DIR/api/payments.php
echo "✅ Файл создан: $WEB_DIR/api/payments.php"
echo ""

echo "3. Устанавливаю права доступа..."
sudo chmod 755 $WEB_DIR/api
sudo chmod 644 $WEB_DIR/api/payments.php
echo "✅ Права установлены"
echo ""

echo "4. Устанавливаю владельца (обычно www-data для Apache)..."
sudo chown www-data:www-data $WEB_DIR/api/payments.php
# или для nginx:
# sudo chown www-data:www-data $WEB_DIR/api/payments.php
echo "✅ Владелец установлен"
echo ""

echo "════════════════════════════════════════════════════"
echo "ГОТОВО! Теперь можно редактировать через nano:"
echo ""
echo "  sudo nano $WEB_DIR/api/payments.php"
echo ""
echo "════════════════════════════════════════════════════"

